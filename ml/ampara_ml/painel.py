"""Painel area x periodo x dia da semana x faixa, com defasagens que nunca enxergam o proprio alvo."""
from __future__ import annotations

from typing import Sequence

import numpy as np
import pandas as pd

from ampara_ml.config import MIN_OCORR_CELULA
from ampara_ml.divisao import periodo_de, proximo_periodo

_FIM_TRIMESTRE = {1: (3, 31), 2: (6, 30), 3: (9, 30), 4: (12, 31)}


def _fim_do_periodo(p: str) -> pd.Timestamp:
    ano, tri = p.split("T")
    mes, dia = _FIM_TRIMESTRE[int(tri)]
    return pd.Timestamp(int(ano), mes, dia)


def periodos_completos(datas: pd.Series, tolerancia_dias: int = 7) -> list[str]:
    """Todos os trimestres do primeiro ao ultimo dado; descarta o ultimo se estiver parcial."""
    d = pd.to_datetime(datas)
    primeiro = periodo_de(pd.Series([d.min()])).iloc[0]
    ultimo = periodo_de(pd.Series([d.max()])).iloc[0]
    lista = [primeiro]
    while lista[-1] != ultimo:
        lista.append(proximo_periodo(lista[-1]))
    if d.max() < _fim_do_periodo(ultimo) - pd.Timedelta(days=tolerancia_dias):
        lista.pop()
    return lista


def selecionar_areas(oc_treino: pd.DataFrame, min_ocorrencias: int = MIN_OCORR_CELULA) -> list[str]:
    """Areas com pelo menos `min_ocorrencias` linhas. So o treino entra."""
    n = oc_treino["area_id"].value_counts()
    return sorted(n[n >= min_ocorrencias].index.tolist())


def _defasagem_media(s: pd.Series, grupo: list) -> pd.Series:
    """Media dos ate 4 valores anteriores (sem o atual), dentro do grupo."""
    ant = s.groupby(grupo).shift(1)
    return ant.groupby(grupo).transform(lambda x: x.rolling(4, min_periods=1).mean())


def montar_painel(oc: pd.DataFrame, areas: Sequence[str], periodos: Sequence[str],
                  incluir_futuro: bool = True) -> pd.DataFrame:
    periodos = sorted(periodos)
    todos = periodos + ([proximo_periodo(periodos[-1])] if incluir_futuro else [])

    d = pd.to_datetime(oc["data"])
    base = pd.DataFrame({
        "area_id": oc["area_id"].to_numpy(),
        "periodo": periodo_de(d).to_numpy(),
        "dia_semana": d.dt.day_of_week.to_numpy(),
        "faixa": (oc["hora"].astype(int) // 3).to_numpy(),
    })
    base = base[base["area_id"].isin(areas) & base["periodo"].isin(periodos)]
    chaves = ["area_id", "periodo", "dia_semana", "faixa"]
    cont = base.groupby(chaves).size()

    idx = pd.MultiIndex.from_product([list(areas), todos, range(7), range(8)], names=chaves)
    p = cont.reindex(idx, fill_value=0).rename("contagem").reset_index()
    if incluir_futuro:
        p["contagem"] = p["contagem"].astype(float)
        p.loc[p["periodo"] == todos[-1], "contagem"] = np.nan

    # defasagens: ordem cronologica dentro de cada (area, dia, faixa)
    p = p.sort_values(["area_id", "dia_semana", "faixa", "periodo"], kind="stable").reset_index(drop=True)
    slot = ["area_id", "dia_semana", "faixa"]
    p["cont_ant_1"] = p.groupby(slot)["contagem"].shift(1)
    p["cont_ant_4"] = _defasagem_media(p["contagem"], [p[c] for c in slot])

    # total da area (todos os slots) por periodo; o periodo futuro nao tem total real
    total = p[p["periodo"].isin(periodos)].groupby(["area_id", "periodo"])["contagem"].sum()
    total = total.reindex(pd.MultiIndex.from_product([list(areas), todos], names=["area_id", "periodo"]))
    total = total.sort_index()
    area_ant = _defasagem_media(total, [total.index.get_level_values("area_id")])
    p["area_ant_4"] = area_ant.reindex(pd.MultiIndex.from_frame(p[["area_id", "periodo"]])).to_numpy()

    p = p[p["periodo"] != periodos[0]].copy()
    p["ano"] = p["periodo"].str[:4].astype(int)
    p["trimestre"] = p["periodo"].str[5:].astype(int)
    cols = ["area_id", "periodo", "ano", "trimestre", "dia_semana", "faixa",
            "contagem", "cont_ant_1", "cont_ant_4", "area_ant_4"]
    return (p[cols].sort_values(["periodo", "area_id", "dia_semana", "faixa"], kind="stable")
            .reset_index(drop=True))
