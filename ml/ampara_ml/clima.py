"""Clima historico da cidade (Open-Meteo Historical Weather API), agregado por periodo, dia e faixa."""
from __future__ import annotations

import time
from pathlib import Path
from urllib.parse import urlencode

import pandas as pd
import requests

from ampara_ml.config import DIR_BRUTOS
from ampara_ml.divisao import periodo_de

LAT_CLIMA = -23.5505
LNG_CLIMA = -46.6333  # um ponto para a cidade inteira: limitacao registrada no relatorio
OPEN_METEO_URL = "https://archive-api.open-meteo.com/v1/archive"
TIMEOUT_S = 120
ESPERA_429_S = 5
TENTATIVAS_429 = 3
CHAVES = ["periodo", "dia_semana", "faixa"]
COLUNAS_CLIMA = ["clima_temp_media", "clima_chuva_mm"]


def url_open_meteo(inicio: str, fim: str) -> str:
    q = {
        "latitude": LAT_CLIMA, "longitude": LNG_CLIMA,
        "start_date": inicio, "end_date": fim,
        "hourly": "temperature_2m,precipitation", "timezone": "America/Sao_Paulo",
    }
    return OPEN_METEO_URL + "?" + urlencode(q, safe=",/")


def _get_json(url: str) -> dict:
    """GET com ate 3 novas tentativas (espera de 5 s) em HTTP 429."""
    for tentativa in range(TENTATIVAS_429 + 1):
        r = requests.get(url, timeout=TIMEOUT_S)
        if r.status_code == 429 and tentativa < TENTATIVAS_429:
            time.sleep(ESPERA_429_S)
            continue
        r.raise_for_status()
        return r.json()
    raise RuntimeError("inalcancavel")


def _anos(inicio: str, fim: str) -> list[tuple[str, str]]:
    ini, f = pd.Timestamp(inicio), pd.Timestamp(fim)
    return [(max(ini, pd.Timestamp(a, 1, 1)).strftime("%Y-%m-%d"),
             min(f, pd.Timestamp(a, 12, 31)).strftime("%Y-%m-%d"))
            for a in range(ini.year, f.year + 1)]


def baixar_clima(inicio: str, fim: str, destino: Path = DIR_BRUTOS / "clima_horario.csv") -> Path:
    destino = Path(destino)
    if destino.exists():
        return destino
    partes = []
    for ini_a, fim_a in _anos(inicio, fim):
        h = _get_json(url_open_meteo(ini_a, fim_a))["hourly"]
        partes.append(pd.DataFrame({k: h[k] for k in ("time", "temperature_2m", "precipitation")}))
    destino.parent.mkdir(parents=True, exist_ok=True)
    pd.concat(partes, ignore_index=True).to_csv(destino, index=False)
    return destino


def agregar_clima(horario: pd.DataFrame) -> pd.DataFrame:
    """Temperatura media e chuva media por dia (mm) em cada (periodo, dia_semana, faixa)."""
    t = pd.to_datetime(horario["time"])
    d = pd.DataFrame({
        "periodo": periodo_de(t).to_numpy(), "dia_semana": t.dt.day_of_week.to_numpy(),
        "faixa": (t.dt.hour // 3).to_numpy(), "data": t.dt.normalize().to_numpy(),
        "temp": horario["temperature_2m"].to_numpy(), "chuva": horario["precipitation"].to_numpy(),
    })
    g = d.groupby(CHAVES, sort=True)
    r = pd.DataFrame({
        "clima_temp_media": g["temp"].mean(),
        "clima_chuva_mm": g["chuva"].sum() / g["data"].nunique(),
    }).reset_index()
    return r


def _mesmo_trimestre_ano_anterior(p: str) -> str:
    ano, tri = p.split("T")
    return f"{int(ano) - 1}T{tri}"


def juntar_clima(painel: pd.DataFrame, clima: pd.DataFrame) -> pd.DataFrame:
    """Left join por (periodo, dia_semana, faixa); periodo sem clima (o futuro) usa o mesmo trimestre do ano anterior."""
    out = painel.drop(columns=[c for c in COLUNAS_CLIMA if c in painel.columns]).merge(clima, on=CHAVES, how="left")
    falta = out[COLUNAS_CLIMA].isna().any(axis=1)
    if falta.any():
        ref = clima.rename(columns={"periodo": "_p_ref"})
        aux = out.loc[falta, CHAVES].copy()
        aux["_p_ref"] = aux["periodo"].map(_mesmo_trimestre_ano_anterior)
        aux = aux.reset_index().merge(ref, on=["_p_ref", "dia_semana", "faixa"], how="left").set_index("index")
        for c in COLUNAS_CLIMA:
            out.loc[falta, c] = aux[c]
    if out[COLUNAS_CLIMA].isna().any(axis=None):
        ruins = sorted(out.loc[out[COLUNAS_CLIMA].isna().any(axis=1), "periodo"].unique())
        raise ValueError(f"sem clima para os periodos {ruins}, nem no mesmo trimestre do ano anterior")
    return out
