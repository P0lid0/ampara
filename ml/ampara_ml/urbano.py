"""Features urbanas por celula: densidade populacional do distrito (IBGE) e pontos de iluminacao (GeoSampa)."""
from __future__ import annotations

import io
import re
import unicodedata
from collections.abc import Sequence
from pathlib import Path

import geopandas as gpd
import pandas as pd
import requests

from ampara_ml.area import area_ids as _area_ids
from ampara_ml.area import centro
from ampara_ml.config import DIR_BRUTOS
from ampara_ml.geosampa import TIMEOUT_S, WFS_URL

CRS_GEO = "EPSG:4326"
CRS_M = "EPSG:31983"  # SIRGAS 2000 / UTM 23S
COL_COD_DISTRITO = "cd_distrito_municipal"
COL_NOME_DISTRITO = "nm_distrito_municipal"
SIDRA_URL = "https://apisidra.ibge.gov.br/values/t/9923/n10/in%20n6%203550308/p/2022"

# GeoSampa x IBGE: nome_norm do poligono -> nome_norm da populacao. Preenchido no join real (ver README).
ALIASES_DISTRITO: dict[str, str] = {}


def normalizar_nome(s: str) -> str:
    sem_acento = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii")
    so_texto = re.sub(r"[^A-Za-z0-9 ]+", " ", sem_acento)
    return re.sub(r"\s+", " ", so_texto).strip().upper()


def carregar_distritos(caminho: Path, col_cod: str = COL_COD_DISTRITO, col_nome: str = COL_NOME_DISTRITO) -> gpd.GeoDataFrame:
    g = gpd.read_file(caminho)
    if g.crs is None:
        g = g.set_crs(CRS_GEO)
    g = g.to_crs(CRS_GEO)
    return gpd.GeoDataFrame(
        {
            "cod_distrito": g[col_cod].astype(int).to_numpy(),
            "nome_norm": g[col_nome].map(normalizar_nome).to_numpy(),
            "geometry": g.geometry.to_numpy(),
        },
        crs=CRS_GEO,
    )


def baixar_populacao(destino: Path = DIR_BRUTOS / "ibge" / "populacao_distritos_2022.csv") -> Path:
    """Censo 2022, populacao residente por distrito de Sao Paulo (SIDRA, tabela 9923)."""
    destino = Path(destino)
    if destino.exists():
        return destino
    r = requests.get(SIDRA_URL, timeout=TIMEOUT_S)
    r.raise_for_status()
    linhas = r.json()[1:]  # a 1a linha e o cabecalho
    df = pd.DataFrame({
        "cod_ibge": [x["D1C"] for x in linhas],
        "distrito": [x["D1N"].split(" - ")[0] for x in linhas],
        "populacao": [int(x["V"]) for x in linhas],
    })
    destino.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(destino, index=False, encoding="utf-8", lineterminator="\n")
    return destino


def carregar_populacao(caminho: Path, col_nome: str = "distrito", col_pop: str = "populacao") -> pd.DataFrame:
    df = pd.read_csv(caminho, encoding="utf-8")
    return pd.DataFrame({
        "nome_norm": df[col_nome].map(normalizar_nome),
        "populacao": df[col_pop].astype(int),
    })


def densidade_populacional(
    distritos: gpd.GeoDataFrame, populacao: pd.DataFrame, aliases: dict[str, str] | None = None
) -> pd.DataFrame:
    aliases = ALIASES_DISTRITO if aliases is None else aliases
    if populacao["nome_norm"].duplicated().any():
        dup = sorted(populacao.loc[populacao["nome_norm"].duplicated(keep=False), "nome_norm"].unique())
        raise ValueError("populacao com nomes duplicados: " + ", ".join(dup))
    d = pd.DataFrame({
        "cod_distrito": distritos["cod_distrito"].to_numpy(),
        "nome_norm": distritos["nome_norm"].to_numpy(),
        "area_km2": (distritos.geometry.to_crs(CRS_M).area / 1e6).to_numpy(),
    })
    d["chave"] = d["nome_norm"].map(lambda n: aliases.get(n, n))
    m = d.merge(populacao[["nome_norm", "populacao"]].rename(columns={"nome_norm": "chave"}), on="chave", how="left", validate="many_to_one")
    faltando = m.loc[m["populacao"].isna(), "nome_norm"]
    if len(faltando):
        raise ValueError("distritos sem população: " + ", ".join(sorted(faltando)))
    m["densidade_hab_km2"] = m["populacao"] / m["area_km2"]
    return m[["cod_distrito", "densidade_hab_km2"]].reset_index(drop=True)


def distrito_de_celulas(area_ids: Sequence[str], distritos: gpd.GeoDataFrame) -> pd.DataFrame:
    ids = list(area_ids)
    centros = [centro(a) for a in ids]
    pts = gpd.GeoDataFrame(
        {"area_id": ids},
        geometry=gpd.points_from_xy([c[1] for c in centros], [c[0] for c in centros]),
        crs=CRS_GEO,
    )
    poligonos = distritos[["cod_distrito", "geometry"]].to_crs(CRS_GEO)
    dentro = gpd.sjoin(pts, poligonos, how="left", predicate="within")
    dentro = dentro[~dentro.index.duplicated(keep="first")]
    cod = dentro["cod_distrito"].copy()
    sem = cod.isna()
    if sem.any():
        perto = gpd.sjoin_nearest(
            pts.loc[sem[sem].index].to_crs(CRS_M), poligonos.to_crs(CRS_M), how="left"
        )
        perto = perto[~perto.index.duplicated(keep="first")]
        cod.loc[perto.index] = perto["cod_distrito"]
    return pd.DataFrame({"area_id": ids, "cod_distrito": cod.astype(int).to_numpy()})


def contar_iluminacao(pontos: pd.DataFrame) -> pd.Series:
    ids = _area_ids(pontos["lat"].to_numpy(), pontos["lng"].to_numpy())
    s = pd.Series(ids)
    s = s[s != "fora"]
    cont = s.value_counts().sort_index()
    cont.index.name = "area_id"
    cont.name = "iluminacao_n"
    return cont.astype(int)


def extrair_pontos(lote: pd.DataFrame) -> pd.DataFrame:
    """Converte o CSV do WFS (FID, ge_ponto em WKT) em fid, lng, lat; falha se algum WKT nao for POINT."""
    xy = lote["ge_ponto"].str.extract(r"POINT\s*\(\s*(-?[\d.eE+-]+)\s+(-?[\d.eE+-]+)\s*\)").astype(float)
    if xy.isna().any().any():
        raise ValueError("geometria de iluminacao fora do formato POINT (x y)")
    return pd.DataFrame({"fid": lote["FID"], "lng": xy[0], "lat": xy[1]})


def total_iluminacao() -> int:
    """Total de feicoes segundo o servidor (resultType=hits)."""
    r = requests.get(
        WFS_URL,
        params={"service": "WFS", "version": "2.0.0", "request": "GetFeature",
                "typeNames": "geoportal:iluminacao_publica", "resultType": "hits"},
        timeout=TIMEOUT_S,
    )
    r.raise_for_status()
    m = re.search(r'numberMatched="(\d+)"', r.text)
    if not m:
        raise ValueError("servidor nao informou numberMatched para iluminacao")
    return int(m.group(1))


def baixar_iluminacao(
    destino: Path = DIR_BRUTOS / "geosampa" / "iluminacao_publica_pontos.csv", pagina: int = 20000
) -> Path:
    """Iluminacao publica (GeoSampa, ~663 mil pontos) em CSV enxuto: so a geometria, ~57 MB no total.

    O GeoJSON completo teria ~330 MB; por isso o WFS e pedido como CSV com propertyName=ge_ponto.
    Salva so lat,lng. O servidor limita a resposta a 30.000 feicoes, por isso paginas de 20.000.
    """
    destino = Path(destino)
    if destino.exists():
        return destino
    esperado = total_iluminacao()
    partes: list[pd.DataFrame] = []
    inicio = 0
    while True:
        r = requests.get(
            WFS_URL,
            params={
                "service": "WFS", "version": "2.0.0", "request": "GetFeature",
                "typeNames": "geoportal:iluminacao_publica", "outputFormat": "csv",
                "srsName": "EPSG:4326", "propertyName": "ge_ponto",
                "sortBy": "cd_identificador_iluminacao_publica",
                "count": pagina, "startIndex": inicio,
            },
            timeout=TIMEOUT_S,
        )
        r.raise_for_status()
        lote = pd.read_csv(io.StringIO(r.content.decode("utf-8")), usecols=["FID", "ge_ponto"])
        if lote.empty:
            break
        partes.append(extrair_pontos(lote))
        inicio += len(lote)
        if inicio >= esperado:
            break
    if not partes:
        raise ValueError("iluminacao: nenhuma pagina recebida")
    df = pd.concat(partes, ignore_index=True).drop_duplicates("fid")[["lat", "lng"]]
    if len(df) != esperado:
        raise ValueError(f"iluminacao incompleta: {len(df)} pontos baixados, servidor informa {esperado}")
    destino.parent.mkdir(parents=True, exist_ok=True)
    tmp = destino.with_suffix(".tmp")
    df.to_csv(tmp, index=False, lineterminator="\n")
    tmp.replace(destino)
    return destino


def carregar_iluminacao(caminho: Path | None = None) -> pd.DataFrame:
    return pd.read_csv(caminho or baixar_iluminacao(), dtype=float)


def features_urbanas(
    area_ids: Sequence[str], distritos: gpd.GeoDataFrame, densidade: pd.DataFrame, iluminacao: pd.Series
) -> pd.DataFrame:
    base = distrito_de_celulas(area_ids, distritos).merge(densidade, on="cod_distrito", how="left")
    ilum = iluminacao.reindex(base["area_id"]).fillna(0).astype(int).to_numpy()
    return pd.DataFrame({
        "area_id": base["area_id"].to_numpy(),
        "densidade_pop_hab_km2": base["densidade_hab_km2"].to_numpy(dtype=float),
        "iluminacao_n": ilum,
    })
