"""Dataset de modelagem: features, cortes de classe calculados so no treino e X_futuro."""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

from ampara_ml.classes import calcular_cortes, rotular
from ampara_ml.clima import juntar_clima
from ampara_ml.divisao import dividir_temporal

FEATURES_BASE = ["lat", "lng", "dia_semana", "faixa", "trimestre", "dist_estacao_m", "dist_delegacia_m",
                 "clima_temp_media", "clima_chuva_mm", "cont_ant_1", "cont_ant_4", "area_ant_4"]
FEATURES_EXTRA = ["densidade_pop_hab_km2", "iluminacao_n"]
COLUNAS_GEO = ["area_id", "lat", "lng", "dist_estacao_m", "dist_delegacia_m"]
CHAVE_FUTURO = ["area_id", "lat", "lng", "dia_semana", "faixa"]


@dataclass(frozen=True)
class Dataset:
    features: list[str]
    X_treino: pd.DataFrame
    X_teste: pd.DataFrame
    X_futuro: pd.DataFrame
    y_treino: np.ndarray
    y_teste: np.ndarray
    p_treino: pd.Series
    p_teste: pd.Series
    chave_futuro: pd.DataFrame
    cortes: tuple[int, int]
    inicio_teste: str


def _checar_features(d: pd.DataFrame, features: list[str]) -> None:
    v = d[features].to_numpy(dtype=float)
    ruim = ~np.isfinite(v)
    if ruim.any():
        areas = sorted(d.loc[ruim.any(axis=1), "area_id"].unique().tolist())
        colunas = [c for c, r in zip(features, ruim.any(axis=0)) if r]
        raise ValueError(f"sem feature: colunas {colunas}, area_id {areas[:10]}"
                         f"{' (+%d)' % (len(areas) - 10) if len(areas) > 10 else ''}")


def montar_dataset(painel: pd.DataFrame, geo: pd.DataFrame, clima: pd.DataFrame, inicio_teste: str,
                   urbano: pd.DataFrame | None = None,
                   quantis: tuple[float, float] = (0.50, 0.85)) -> Dataset:
    features = FEATURES_BASE + (FEATURES_EXTRA if urbano is not None else [])
    d = juntar_clima(painel, clima).merge(geo[COLUNAS_GEO], on="area_id", how="left")
    if urbano is not None:
        d = d.merge(urbano[["area_id"] + FEATURES_EXTRA], on="area_id", how="left")
    _checar_features(d, features)

    futuro = d[d["contagem"].isna()]
    historico = d[d["contagem"].notna()]
    treino, teste = dividir_temporal(historico, inicio_teste)
    cortes = calcular_cortes(treino["contagem"].to_numpy(), quantis)
    return Dataset(
        features=features,
        X_treino=treino[features].reset_index(drop=True),
        X_teste=teste[features].reset_index(drop=True),
        X_futuro=futuro[features].reset_index(drop=True),
        y_treino=rotular(treino["contagem"].to_numpy(), cortes),
        y_teste=rotular(teste["contagem"].to_numpy(), cortes),
        p_treino=treino["periodo"].reset_index(drop=True),
        p_teste=teste["periodo"].reset_index(drop=True),
        chave_futuro=futuro[CHAVE_FUTURO].reset_index(drop=True),
        cortes=cortes,
        inicio_teste=inicio_teste,
    )
