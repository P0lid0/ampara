"""Leitura e limpeza das planilhas de ocorrencias da SSP-SP.

Fonte: SPDadosCriminais_<ano>.xlsx (https://www.ssp.sp.gov.br/estatistica/dados-mensais). A planilha mistura
todas as naturezas e nao tem coluna de celular (SSP_CELULAR: PROXY em docs/riscos-dia1.md), entao o filtro de
objeto vira o proxy "roubo ou furto em via publica" (proxy=True).
"""
from __future__ import annotations

import csv
import io
import re
import unicodedata
from pathlib import Path
from typing import Literal, Sequence

import numpy as np
import pandas as pd

from ampara_ml.area import FORA, area_ids

COORD_MIN_FRACAO = 0.70
MIN_USADAS = 20_000
ANO_MINIMO = pd.Timestamp("2000-01-01")

# Nomes reais da planilha (docs/dados-ssp-colunas.md), ja normalizados. `objeto` nao existe nos arquivos
# 2022-2025; fica como candidato opcional caso outro recorte traga a coluna.
MAPA_PADRAO: dict[str, list[str]] = {
    "data": ["DATA_OCORRENCIA_BO", "DATA_OCORRENCIA", "DATA_FATO"],
    "hora": ["HORA_OCORRENCIA_BO", "HORA_OCORRENCIA", "HORA_FATO"],
    "lat": ["LATITUDE", "LAT"],
    "lng": ["LONGITUDE", "LONG", "LNG"],
    "municipio": ["NOME_MUNICIPIO", "MUNICIPIO", "CIDADE"],
    "objeto": ["OBJETO", "SUBTIPO_OBJETO", "DESCR_SUBTIPO_OBJETO", "DESCR_TIPO_OBJETO"],
    "rubrica": ["RUBRICA", "NATUREZA"],
    "local": ["DESCR_TIPOLOCAL", "DESCR_SUBTIPOLOCAL", "LOCAL", "TIPO_LOCAL"],
}
OBRIGATORIAS = ("data", "hora", "lat", "lng", "municipio")
_MUNICIPIOS_SP = {"SAO PAULO", "S PAULO"}

CHAVES_RESUMO = (
    "linhas_lidas", "descartadas_municipio", "descartadas_objeto", "descartadas_data",
    "descartadas_hora", "descartadas_coord", "descartadas_fora_grade", "usadas",
)


class ColunaAusente(ValueError):
    def __init__(self, faltando: list[str]):
        super().__init__(f"colunas obrigatorias nao encontradas: {faltando}")
        self.faltando = faltando


def normalizar_texto(s) -> str:
    if s is None:
        return ""
    s = unicodedata.normalize("NFKD", str(s))
    s = "".join(c for c in s if not unicodedata.combining(c)).upper()
    s = re.sub(r"[^A-Z0-9]+", " ", s)
    return s.strip()


def normalizar_coluna(nome: str) -> str:
    return normalizar_texto(nome).replace(" ", "_")


def mapear_colunas(colunas: Sequence[str], mapa: dict[str, list[str]] = MAPA_PADRAO) -> dict[str, str]:
    """canonica -> nome original. ColunaAusente se faltar alguma obrigatoria."""
    por_norm: dict[str, str] = {}
    for c in colunas:
        por_norm.setdefault(normalizar_coluna(c), c)
    achadas: dict[str, str] = {}
    for canonica, candidatos in mapa.items():
        for cand in candidatos:
            if cand in por_norm:
                achadas[canonica] = por_norm[cand]
                break
    faltando = [c for c in OBRIGATORIAS if c in mapa and c not in achadas]
    if faltando:
        raise ColunaAusente(faltando)
    return achadas


def parse_coordenada(valor) -> float:
    if valor is None:
        return float("nan")
    if isinstance(valor, (int, float, np.integer, np.floating)):
        v = float(valor)
    else:
        txt = str(valor).strip().replace(",", ".")
        try:
            v = float(txt)
        except ValueError:
            return float("nan")
    if not np.isfinite(v) or v == 0 or abs(v) > 180:
        return float("nan")
    return v


_HORA = re.compile(r"^\s*(\d{1,2})(?:[:hH.]\s*\d{1,2}(?:[:.]\d{1,2})?)?\s*$")


def parse_hora(valor) -> int | None:
    if valor is None:
        return None
    if isinstance(valor, (int, np.integer)):
        h = int(valor)
    elif isinstance(valor, (float, np.floating)):
        if not np.isfinite(valor) or valor != int(valor):
            return None
        h = int(valor)
    else:
        txt = str(valor).strip()
        if re.fullmatch(r"\d{1,2}\.0+", txt):
            txt = txt.split(".")[0]
        m = _HORA.match(txt)
        if m is None:
            return None
        h = int(m.group(1))
    return h if 0 <= h <= 23 else None


# ---------------------------------------------------------------- leitura

def _ler_csv(caminho: Path) -> pd.DataFrame:
    bruto = caminho.read_bytes()
    texto = ""
    for enc in ("utf-8-sig", "latin-1"):
        try:
            texto = bruto.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    primeira = texto.split("\n", 1)[0]
    try:
        sep = csv.Sniffer().sniff(primeira, delimiters=",;\t|").delimiter
    except csv.Error:
        sep = ","
    return pd.read_csv(io.StringIO(texto), sep=sep, dtype=str, keep_default_na=False)


def _celula_para_texto(v) -> str:
    return "" if v is None else str(v)


def _blocos_xlsx(caminho: Path, mapa: dict[str, list[str]]):
    """Gera um DataFrame (so com as colunas mapeadas) por aba que tenha as colunas obrigatorias."""
    from openpyxl import load_workbook

    wb = load_workbook(caminho, read_only=True, data_only=True)
    try:
        for ws in wb.worksheets:
            linhas = ws.iter_rows(values_only=True)
            cab = next(linhas, None)
            if not cab:
                continue
            nomes = [_celula_para_texto(c) for c in cab]
            try:
                m = mapear_colunas(nomes, mapa)
            except ColunaAusente:
                continue  # aba de dicionario/notas
            colunas = list(m)
            posicoes = [nomes.index(m[c]) for c in colunas]
            dados = [[_celula_para_texto(l[p]) if p < len(l) else "" for p in posicoes] for l in linhas]
            yield pd.DataFrame(dados, columns=colunas, dtype=str)
    finally:
        wb.close()


def _blocos(caminho: Path, mapa: dict[str, list[str]]):
    sufixo = caminho.suffix.lower()
    if sufixo == ".xlsx":
        yield from _blocos_xlsx(caminho, mapa)
    elif sufixo == ".csv":
        df = _ler_csv(caminho)
        m = mapear_colunas(list(df.columns), mapa)
        yield df[list(m.values())].rename(columns={v: k for k, v in m.items()})
    else:
        raise ValueError(f"formato nao suportado: {caminho.name}")


# ---------------------------------------------------------------- limpeza

def _coord_vetor(serie: pd.Series) -> np.ndarray:
    v = pd.to_numeric(serie.astype(str).str.strip().str.replace(",", ".", regex=False), errors="coerce").to_numpy(dtype=float, copy=True)
    ruim = ~np.isfinite(v) | (v == 0) | (np.abs(v) > 180)
    v[ruim] = np.nan
    return v


def _limpar_bloco(df: pd.DataFrame, municipio: str, proxy: bool, acc: dict) -> pd.DataFrame:
    acc["linhas_lidas"] += len(df)

    alvo = _MUNICIPIOS_SP if normalizar_texto(municipio) == "SAO PAULO" else {normalizar_texto(municipio)}
    ok = df["municipio"].map(normalizar_texto).isin(alvo)
    acc["descartadas_municipio"] += int((~ok).sum())
    df = df[ok]

    if proxy:
        if "rubrica" not in df.columns or "local" not in df.columns:
            raise ColunaAusente([c for c in ("rubrica", "local") if c not in df.columns])
        rub = df["rubrica"].map(normalizar_texto)
        loc = df["local"].map(normalizar_texto)
        ok = (rub.str.contains("ROUBO") | rub.str.contains("FURTO")) & loc.str.contains("VIA PUBLICA")
    elif "objeto" in df.columns:
        ok = df["objeto"].map(normalizar_texto).str.contains("CELULAR")
    else:
        ok = pd.Series(True, index=df.index)
    acc["descartadas_objeto"] += int((~ok).sum())
    df = df[ok]

    data = pd.to_datetime(df["data"].astype(str).str.strip(), dayfirst=True, format="mixed", errors="coerce").dt.normalize()
    ok = data.notna() & (data >= ANO_MINIMO)  # ano 0202 etc. e erro de digitacao
    acc["descartadas_data"] += int((~ok).sum())
    df, data = df[ok], data[ok]

    cache = {h: parse_hora(h) for h in df["hora"].unique()}
    hora = df["hora"].map(cache)
    ok = hora.notna()
    acc["descartadas_hora"] += int((~ok).sum())
    df, data, hora = df[ok], data[ok], hora[ok].astype(int)

    lat, lng = _coord_vetor(df["lat"]), _coord_vetor(df["lng"])
    ok = ~(np.isnan(lat) | np.isnan(lng))
    acc["descartadas_coord"] += int((~ok).sum())
    data, hora, lat, lng = data[ok], hora[ok], lat[ok], lng[ok]

    ids = area_ids(lat, lng)
    ok = ids != FORA
    acc["descartadas_fora_grade"] += int((~ok).sum())
    out = pd.DataFrame({
        "data": data.to_numpy()[ok],
        "hora": hora.to_numpy()[ok],
        "lat": lat[ok],
        "lng": lng[ok],
        "area_id": ids[ok],
    })
    acc["usadas"] += len(out)
    return out


def carregar_ssp(
    caminhos: Sequence[Path],
    mapa: dict[str, list[str]] = MAPA_PADRAO,
    municipio: str = "SAO PAULO",
    proxy: bool = False,
) -> tuple[pd.DataFrame, dict]:
    """Le as planilhas e devolve (DataFrame limpo, resumo). Ordem: municipio, objeto, data, hora, coord, grade."""
    acc = {k: 0 for k in CHAVES_RESUMO}
    partes: list[pd.DataFrame] = []
    for caminho in caminhos:
        for bloco in _blocos(Path(caminho), mapa):
            partes.append(_limpar_bloco(bloco, municipio, proxy, acc))
    if partes:
        df = pd.concat(partes, ignore_index=True)
    else:
        df = pd.DataFrame({"data": pd.Series(dtype="datetime64[ns]"), "hora": pd.Series(dtype=int),
                           "lat": pd.Series(dtype=float), "lng": pd.Series(dtype=float),
                           "area_id": pd.Series(dtype=object)})
    descartadas = sum(v for k, v in acc.items() if k.startswith("descartadas_"))
    assert acc["usadas"] + descartadas == acc["linhas_lidas"], acc
    return df, acc


def decidir_resolucao(resumo: dict) -> Literal["grade", "distrito"]:
    lidas = resumo.get("linhas_lidas", 0)
    # Base = linhas com municipio, objeto, data e hora validos: sem hora a linha nao serve a faixa
    # horaria, entao nao deve contar contra a qualidade da coordenada.
    base = lidas - sum(resumo.get(k, 0) for k in (
        "descartadas_municipio", "descartadas_objeto", "descartadas_data", "descartadas_hora"))
    usadas = resumo.get("usadas", 0)
    if base > 0 and usadas / base >= COORD_MIN_FRACAO and usadas >= MIN_USADAS:
        return "grade"
    return "distrito"
