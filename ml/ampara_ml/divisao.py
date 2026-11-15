"""Periodos trimestrais, divisao treino/teste e validacao cruzada temporal (sem vazamento do futuro)."""
from __future__ import annotations

from typing import Sequence

import numpy as np
import pandas as pd
from sklearn.model_selection import TimeSeriesSplit


def periodo_de(datas: pd.Series) -> pd.Series:
    """'2024T3'. A ordem lexicografica das strings e a ordem cronologica."""
    d = pd.to_datetime(datas)
    return d.dt.year.astype(str) + "T" + ((d.dt.month - 1) // 3 + 1).astype(str)


def proximo_periodo(p: str) -> str:
    ano, tri = p.split("T")
    ano, tri = int(ano), int(tri)
    return f"{ano + 1}T1" if tri == 4 else f"{ano}T{tri + 1}"


def inicio_teste_padrao(periodos: Sequence[str], ano_teste: int = 2025) -> str:
    """`<ano_teste>T1` se houver >= 3 periodos desse ano; senao (plano B) o 4o periodo contando do fim."""
    unicos = sorted(set(periodos))
    if sum(p.startswith(f"{ano_teste}T") for p in unicos) >= 3:
        return f"{ano_teste}T1"
    return unicos[-4]


def dividir_temporal(painel: pd.DataFrame, inicio_teste: str) -> tuple[pd.DataFrame, pd.DataFrame]:
    treino = painel[painel["periodo"] < inicio_teste]
    teste = painel[painel["periodo"] >= inicio_teste]
    if treino.empty or teste.empty:
        raise ValueError(f"divisao em {inicio_teste} deixa treino ou teste vazio")
    return treino, teste


def cv_temporal(periodos: pd.Series, n_splits: int = 3) -> list[tuple[np.ndarray, np.ndarray]]:
    """Janela expansiva sobre os periodos unicos; devolve indices posicionais de linhas."""
    valores = np.asarray(periodos)
    unicos = np.array(sorted(set(valores.tolist())))
    splits = []
    for tr_p, va_p in TimeSeriesSplit(n_splits=n_splits).split(unicos):
        splits.append((np.flatnonzero(np.isin(valores, unicos[tr_p])),
                       np.flatnonzero(np.isin(valores, unicos[va_p]))))
    return splits
