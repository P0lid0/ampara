"""Area do mapa, faixa horaria e dia da semana (mesma regra do C#, ver contratos)."""
from __future__ import annotations

import datetime
import re

import numpy as np

from ampara_ml.config import LAT_MAX, LAT_MIN, LNG_MAX, LNG_MIN, PASSO_LAT, PASSO_LNG

FORA = "fora"
_MAX_LINHA = round((LAT_MAX - LAT_MIN) / PASSO_LAT) - 1
_MAX_COLUNA = round((LNG_MAX - LNG_MIN) / PASSO_LNG) - 1
_PADRAO = re.compile(r"^g(\d{3})_(\d{3})$")


def area_ids(lat: np.ndarray, lng: np.ndarray) -> np.ndarray:
    """Versao vetorizada (unica implementacao da regra). Retorna dtype object."""
    lat = np.asarray(lat, dtype=float)
    lng = np.asarray(lng, dtype=float)
    fora = (lat < LAT_MIN) | (lat >= LAT_MAX) | (lng < LNG_MIN) | (lng >= LNG_MAX) | np.isnan(lat) | np.isnan(lng)
    lat_ok = np.where(fora, LAT_MIN, lat)
    lng_ok = np.where(fora, LNG_MIN, lng)
    # np.minimum: protege o indice contra arredondamento de ponto flutuante
    # logo abaixo do limite superior (grade de 100 x 96 celulas).
    linha = np.minimum(np.floor((lat_ok - LAT_MIN) / PASSO_LAT).astype(int), _MAX_LINHA)
    coluna = np.minimum(np.floor((lng_ok - LNG_MIN) / PASSO_LNG).astype(int), _MAX_COLUNA)
    nomes = [
        FORA if f else f"g{li:03d}_{co:03d}"
        for f, li, co in zip(fora.ravel().tolist(), linha.ravel().tolist(), coluna.ravel().tolist())
    ]
    saida = np.empty(len(nomes), dtype=object)
    saida[:] = nomes
    return saida.reshape(lat.shape)


def area_id(lat: float, lng: float) -> str:
    return str(area_ids(np.array([lat]), np.array([lng]))[0])


def centro(area_id: str) -> tuple[float, float]:
    m = _PADRAO.match(area_id) if isinstance(area_id, str) else None
    if m is None:
        raise ValueError(f"area_id invalido: {area_id!r}")
    linha, coluna = int(m.group(1)), int(m.group(2))
    return (LAT_MIN + (linha + 0.5) * PASSO_LAT, LNG_MIN + (coluna + 0.5) * PASSO_LNG)


def faixa(hora: int) -> int:
    if not 0 <= hora <= 23:
        raise ValueError(f"hora fora de 0..23: {hora}")
    return hora // 3


def dia_semana(d: datetime.date) -> int:
    """0 = segunda ... 6 = domingo."""
    return d.weekday()
