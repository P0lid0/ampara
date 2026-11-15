"""Modelos (XGBoost e Random Forest), busca de hiperparametros com CV temporal e avaliacao.

A escolha de hiperparametros usa so o treino (CV temporal); o teste e avaliado uma vez, no modelo final.
"""
from __future__ import annotations

import time
from typing import Any, Callable

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, confusion_matrix, f1_score
from sklearn.model_selection import ParameterGrid, ParameterSampler
from sklearn.utils.class_weight import compute_sample_weight
from xgboost import XGBClassifier

from ampara_ml.config import SEED

GRADE_XGB = {"n_estimators": [100, 200, 400], "max_depth": [3, 5, 7, 9], "learning_rate": [0.03, 0.1, 0.3]}
GRADE_RF = {"n_estimators": [100, 300], "max_depth": [8, 16, None], "min_samples_leaf": [1, 5, 20]}
N_COMBINACOES_XGB = 12
N_COMBINACOES_RF = 6

_LABELS = [0, 1, 2]


def fabrica_xgb(params: dict) -> XGBClassifier:
    return XGBClassifier(objective="multi:softprob", num_class=3, tree_method="hist",
                         random_state=SEED, n_jobs=-1, **params)


def fabrica_rf(params: dict) -> RandomForestClassifier:
    return RandomForestClassifier(class_weight="balanced_subsample", max_samples=0.5,
                                  random_state=SEED, n_jobs=-1, **params)


def ajustar(estimador, X: pd.DataFrame, y: np.ndarray):
    """Treina; o XGBoost nao tem class_weight, entao usa sample_weight balanceado."""
    y = np.asarray(y)
    if isinstance(estimador, XGBClassifier):
        if not np.array_equal(np.unique(y), _LABELS):
            raise ValueError(f"XGBoost exige as 3 classes {_LABELS} no treino; recebeu {np.unique(y).tolist()}")
        estimador.fit(X, y, sample_weight=compute_sample_weight("balanced", y))
    else:
        estimador.fit(X, y)
    return estimador


def _f1(y, pred) -> float:
    return float(f1_score(y, pred, labels=_LABELS, average="macro", zero_division=0))


def buscar_hiperparametros(fabrica: Callable[[dict], Any], grade: dict, X: pd.DataFrame, y: np.ndarray,
                           splits: list[tuple[np.ndarray, np.ndarray]], n_combinacoes: int,
                           seed: int = SEED) -> pd.DataFrame:
    n = min(n_combinacoes, len(ParameterGrid(grade)))
    y = np.asarray(y)
    linhas = []
    for params in ParameterSampler(grade, n_iter=n, random_state=seed):
        t0 = time.perf_counter()
        notas = []
        for tr, va in splits:
            modelo = ajustar(fabrica(params), X.iloc[tr], y[tr])
            notas.append(_f1(y[va], modelo.predict(X.iloc[va])))
        linhas.append({**params, "f1_macro_cv": float(np.mean(notas)), "f1_desvio_cv": float(np.std(notas)),
                       "tempo_s": time.perf_counter() - t0})
    tabela = pd.DataFrame(linhas)
    # max_depth=None precisa continuar None (dtype object), nao NaN
    for col, valores in grade.items():
        if any(v is None for v in valores):
            tabela[col] = pd.Series([r[col] for r in linhas], dtype=object)
    return tabela.sort_values("f1_macro_cv", ascending=False, kind="stable").reset_index(drop=True)


def treinar_final(fabrica, params: dict, X_treino, y_treino):
    return ajustar(fabrica(params), X_treino, np.asarray(y_treino))


def avaliar(modelo, X, y) -> dict:
    y = np.asarray(y)
    pred = modelo.predict(X)
    return {
        "f1_macro": _f1(y, pred),
        "accuracy": float(accuracy_score(y, pred)),
        "matriz": confusion_matrix(y, pred, labels=_LABELS).tolist(),
    }


def curva_aprendizado(fabrica, params: dict, X_treino, y_treino, X_teste, y_teste,
                      fracoes=(0.2, 0.4, 0.6, 0.8, 1.0)) -> pd.DataFrame:
    """Treina com as primeiras linhas (ordem cronologica do treino) e mede F1 no proprio subconjunto e no teste."""
    y_treino = np.asarray(y_treino)
    linhas = []
    for f in fracoes:
        n = max(1, int(round(len(X_treino) * f)))
        m = treinar_final(fabrica, params, X_treino.iloc[:n], y_treino[:n])
        linhas.append({"fracao": f, "n_treino": n,
                       "f1_treino": avaliar(m, X_treino.iloc[:n], y_treino[:n])["f1_macro"],
                       "f1_teste": avaliar(m, X_teste, y_teste)["f1_macro"]})
    return pd.DataFrame(linhas)
