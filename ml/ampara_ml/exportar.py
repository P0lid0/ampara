"""Exportacao do risco.csv: previsao por area x dia da semana x faixa horaria, validada antes de gravar."""
from __future__ import annotations

import re
from pathlib import Path

import numpy as np
import pandas as pd

from ampara_ml.area import centro
from ampara_ml.config import CLASSES, DIR_SAIDA

CABECALHO_RISCO = "area_id,lat,lng,dia_semana,faixa,classe,prob_alto"
_COLUNAS = CABECALHO_RISCO.split(",")
_PADRAO_AREA = re.compile(r"^g\d{3}_\d{3}$")
_TOLERANCIA_GRAUS = 1e-5
_COMBINACOES = 7 * 8


def gerar_risco(modelo, X_futuro: pd.DataFrame, chave_futuro: pd.DataFrame) -> pd.DataFrame:
    classes = [int(c) for c in modelo.classes_]
    if 2 not in classes:
        raise ValueError(f"o modelo nao conhece a classe 2 (alto): classes_ = {classes}")
    proba = np.asarray(modelo.predict_proba(X_futuro), dtype=float)
    coluna_alto = classes.index(2)
    # argmax devolve a posicao em classes_; traduz para o codigo da classe antes de indexar CLASSES
    codigo = np.asarray(classes)[proba.argmax(axis=1)]
    chave = chave_futuro.reset_index(drop=True)
    return pd.DataFrame({
        "area_id": chave["area_id"].to_numpy(),
        "lat": chave["lat"].to_numpy(dtype=float),
        "lng": chave["lng"].to_numpy(dtype=float),
        "dia_semana": chave["dia_semana"].to_numpy(dtype=int),
        "faixa": chave["faixa"].to_numpy(dtype=int),
        "classe": [CLASSES[c] for c in codigo],
        "prob_alto": proba[:, coluna_alto],
    })


def _falha(df: pd.DataFrame, mascara: pd.Series, motivo: str) -> None:
    if mascara.any():
        i = mascara.idxmax()
        raise ValueError(f"risco invalido ({motivo}), primeira linha ruim (indice {i}): {df.loc[i].to_dict()}")


def _validar(df: pd.DataFrame) -> pd.DataFrame:
    if df.columns.tolist() != _COLUNAS:
        raise ValueError(f"colunas do risco devem ser exatamente {_COLUNAS}; veio {df.columns.tolist()}")
    df = df.reset_index(drop=True)
    _falha(df, df.isna().any(axis=1), "valor ausente")
    _falha(df, ~df["area_id"].astype(str).map(lambda a: bool(_PADRAO_AREA.match(a))),
           "area_id fora do padrao gNNN_NNN")
    for col in ("lat", "lng", "prob_alto", "dia_semana", "faixa"):
        try:
            df[col] = pd.to_numeric(df[col])
        except (ValueError, TypeError) as e:
            raise ValueError(f"coluna {col} nao numerica: {e}") from e
    _falha(df, pd.Series(~np.isfinite(df[["lat", "lng", "prob_alto"]].to_numpy(dtype=float)).all(axis=1)),
           "numero nao finito")
    _falha(df, ~df["dia_semana"].isin(range(7)), "dia_semana fora de 0..6")
    _falha(df, ~df["faixa"].isin(range(8)), "faixa fora de 0..7")
    _falha(df, ~df["classe"].isin(CLASSES), "classe desconhecida")
    _falha(df, (df["prob_alto"] < 0) | (df["prob_alto"] > 1), "prob_alto fora de [0,1]")
    centros = df["area_id"].map(centro)
    dlat = (df["lat"] - centros.map(lambda c: c[0])).abs()
    dlng = (df["lng"] - centros.map(lambda c: c[1])).abs()
    _falha(df, (dlat > _TOLERANCIA_GRAUS) | (dlng > _TOLERANCIA_GRAUS), "lat/lng longe do centro da area")
    _falha(df, df.duplicated(["area_id", "dia_semana", "faixa"], keep="first"),
           "chave area_id+dia_semana+faixa repetida")
    por_area = df.groupby("area_id").size()
    incompletas = por_area[por_area != _COMBINACOES]
    if len(incompletas):
        raise ValueError(f"area {incompletas.index[0]} tem {incompletas.iloc[0]} combinacoes de dia x faixa, "
                         f"esperado {_COMBINACOES}")
    return df


def salvar_risco(df: pd.DataFrame, destino: Path = DIR_SAIDA / "risco.csv") -> Path:
    df = _validar(df)
    saida = pd.DataFrame({
        "area_id": df["area_id"].astype(str),
        "lat": df["lat"].map("{:.5f}".format),
        "lng": df["lng"].map("{:.5f}".format),
        "dia_semana": df["dia_semana"].astype(int).astype(str),
        "faixa": df["faixa"].astype(int).astype(str),
        "classe": df["classe"],
        "prob_alto": df["prob_alto"].map("{:.4f}".format),
    })
    destino = Path(destino)
    destino.parent.mkdir(parents=True, exist_ok=True)
    texto = CABECALHO_RISCO + "\n" + "".join(",".join(l) + "\n" for l in saida.itertuples(index=False, name=None))
    destino.write_bytes(texto.encode("utf-8"))
    return destino
