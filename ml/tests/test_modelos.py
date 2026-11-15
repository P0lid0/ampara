"""Testes de modelos.py com dados SINTETICOS (nenhum dado real)."""
import numpy as np
import pandas as pd
import pytest
from sklearn.model_selection import ParameterGrid
from sklearn.utils.class_weight import compute_sample_weight
from xgboost import XGBClassifier

from ampara_ml.divisao import cv_temporal
from ampara_ml.modelos import (
    GRADE_RF, GRADE_XGB, N_COMBINACOES_RF, N_COMBINACOES_XGB, ajustar, avaliar,
    buscar_hiperparametros, curva_aprendizado, fabrica_rf, fabrica_xgb, treinar_final,
)

PERIODOS = ["2024T1", "2024T2", "2024T3", "2024T4", "2025T1", "2025T2"]


def _dados():
    rng = np.random.default_rng(42)
    n = 900
    X = pd.DataFrame(rng.normal(size=(n, 3)), columns=["f1", "f2", "f3"])
    ruido = rng.normal(scale=0.1, size=n)
    y = np.where(X.f1 + ruido < -0.4, 0, np.where(X.f1 + ruido < 0.5, 1, 2))
    periodo = np.repeat(PERIODOS, 150)
    return X, y, pd.Series(periodo)


class _Fake:
    def __init__(self, preds):
        self._p = np.array(preds)

    def predict(self, X):
        return self._p


def test_grades_e_minimo_de_combinacoes():
    assert set(GRADE_XGB) == {"n_estimators", "max_depth", "learning_rate"}
    assert set(GRADE_RF) == {"n_estimators", "max_depth", "min_samples_leaf"}
    assert N_COMBINACOES_XGB >= 10 and N_COMBINACOES_XGB <= len(list(ParameterGrid(GRADE_XGB)))
    assert N_COMBINACOES_RF == 4


def test_busca_xgb():
    X, y, per = _dados()
    splits = cv_temporal(per, 3)
    grade = {"n_estimators": [5, 10], "max_depth": [2, 3], "learning_rate": [0.1, 0.3]}
    t = buscar_hiperparametros(fabrica_xgb, grade, X, y, splits, n_combinacoes=6)
    assert len(t) == 6
    assert {"f1_macro_cv", "f1_desvio_cv", "tempo_s", "n_estimators", "max_depth", "learning_rate"} <= set(t.columns)
    assert t.f1_macro_cv.is_monotonic_decreasing
    assert t.f1_macro_cv.between(0, 1).all() and t.f1_macro_cv.iloc[0] > 0.5


def test_busca_limita_ao_tamanho_da_grade():
    X, y, per = _dados()
    splits = cv_temporal(per, 3)
    grade = {"n_estimators": [5, 10], "max_depth": [2, 3], "learning_rate": [0.1]}
    t = buscar_hiperparametros(fabrica_xgb, grade, X, y, splits, n_combinacoes=50)
    assert len(t) == 4


def test_cv_so_no_treino():
    X, y, per = _dados()
    n_treino = 600  # 2024T1..2024T4
    splits = cv_temporal(per.iloc[:n_treino], 3)
    assert max(max(tr.max(), va.max()) for tr, va in splits) < n_treino
    grade = {"n_estimators": [5], "max_depth": [3, None], "min_samples_leaf": [1]}
    t = buscar_hiperparametros(fabrica_rf, grade, X.iloc[:n_treino], y[:n_treino], splits, n_combinacoes=2)
    assert len(t) == 2
    assert any(v is None for v in t.max_depth)  # None continua None, nao NaN


def test_avaliar_classe_ausente():
    X4 = pd.DataFrame({"f1": [0.0, 1.0, 2.0, 3.0]})
    m = avaliar(_Fake(preds=[0, 1, 1, 1]), X4, np.array([0, 1, 2, 2]))
    assert m["matriz"] == [[1, 0, 0], [0, 1, 0], [0, 2, 0]]
    assert m["f1_macro"] == pytest.approx(0.5)
    assert m["accuracy"] == pytest.approx(0.5)


@pytest.mark.parametrize("fabrica,params", [
    (fabrica_xgb, {"n_estimators": 10, "max_depth": 3, "learning_rate": 0.1}),
    (fabrica_rf, {"n_estimators": 10, "max_depth": 5, "min_samples_leaf": 1}),
])
def test_treino_deterministico(fabrica, params):
    X, y, _ = _dados()
    a = treinar_final(fabrica, params, X, y).predict(X)
    b = treinar_final(fabrica, params, X, y).predict(X)
    assert np.array_equal(a, b)


def test_ajustar_xgb_usa_peso_balanceado():
    X, y, _ = _dados()
    y = np.where(np.arange(len(y)) % 10 == 0, 2, np.where(y == 2, 1, y))  # classe 2 rara
    visto = {}

    class _Espia(XGBClassifier):
        def fit(self, X, y, sample_weight=None, **kw):
            visto["w"] = sample_weight
            visto["y"] = np.asarray(y)
            return super().fit(X, y, sample_weight=sample_weight, **kw)

    ajustar(_Espia(n_estimators=3, max_depth=2, objective="multi:softprob", num_class=3), X, y)
    w, yy = visto["w"], visto["y"]
    assert w is not None
    assert w[yy == 2][0] > w[yy == 0][0]
    assert w[yy == 2][0] > w[yy == 1][0]
    assert np.allclose(w, compute_sample_weight("balanced", yy))


def test_ajustar_xgb_classe_ausente_da_erro_claro():
    X, y, _ = _dados()
    mask = y != 1
    with pytest.raises(ValueError, match="classes"):
        ajustar(fabrica_xgb({"n_estimators": 3, "max_depth": 2, "learning_rate": 0.3}), X[mask], y[mask])


def test_curva_aprendizado():
    X, y, _ = _dados()
    c = curva_aprendizado(fabrica_xgb, {"n_estimators": 10, "max_depth": 3, "learning_rate": 0.1},
                          X.iloc[:600], y[:600], X.iloc[600:], y[600:])
    assert len(c) == 5 and c.n_treino.is_monotonic_increasing and c.n_treino.is_unique
    assert c.f1_treino.between(0, 1).all() and c.f1_teste.between(0, 1).all()
    assert list(c.columns) == ["fracao", "n_treino", "f1_treino", "f1_teste"]
