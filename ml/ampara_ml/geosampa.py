"""Features do GeoSampa (WFS publico da Prefeitura de SP): distancia a estacao e a delegacia."""
from __future__ import annotations

import json
import xml.etree.ElementTree as ET
from collections.abc import Sequence
from pathlib import Path
from urllib.parse import urlencode

import numpy as np
import pandas as pd
import requests
from shapely.geometry import shape
from sklearn.neighbors import BallTree

from ampara_ml.area import centro
from ampara_ml.config import DIR_BRUTOS

WFS_URL = "https://wfs.geosampa.prefeitura.sp.gov.br/geoserver/ows"
RAIO_TERRA_M = 6371008.8
TIMEOUT_S = 120

# Camadas confirmadas no GetCapabilities de 2026-11-14 (ver ml/dados/README.md).
# "delegacia" usa o ponto da delegacia (equipamento_policia_civil); delegacia_policia_civil
# e o poligono da area de cada DP e nao serve para distancia.
# "iluminacao" fica mapeada, mas NAO foi baixada: 662.945 feicoes, acima do limite que exige ok do Pedro.
CAMADAS: dict[str, list[str]] = {
    "estacao": ["geoportal:estacao_metro", "geoportal:estacao_trem"],
    "delegacia": ["geoportal:equipamento_policia_civil"],
    "iluminacao": ["geoportal:iluminacao_publica"],
    "distrito": ["geoportal:distrito_municipal"],
}


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def parse_capabilities(xml: str) -> list[str]:
    raiz = ET.fromstring(xml)
    nomes = []
    for tipo in raiz.iter():
        if _local(tipo.tag) == "FeatureType":
            nomes += [(n.text or "").strip() for n in tipo if _local(n.tag) == "Name"]
    return nomes


def url_getfeature(camada: str, inicio: int, pagina: int = 10000, url: str = WFS_URL) -> str:
    q = {
        "service": "WFS", "version": "2.0.0", "request": "GetFeature", "typeNames": camada,
        "outputFormat": "application/json", "srsName": "EPSG:4326",
        "count": pagina, "startIndex": inicio,
    }
    return url + "?" + urlencode(q, safe=":/")


def baixar_camada(camada: str, destino_dir: Path = DIR_BRUTOS / "geosampa", pagina: int = 10000) -> Path:
    destino_dir = Path(destino_dir)
    destino = destino_dir / (camada.replace(":", "_") + ".geojson")
    if destino.exists():
        return destino
    feicoes: list[dict] = []
    inicio = 0
    while True:
        r = requests.get(url_getfeature(camada, inicio, pagina), timeout=TIMEOUT_S)
        r.raise_for_status()
        lote = r.json().get("features", [])
        feicoes.extend(lote)
        if len(lote) < pagina:
            break
        inicio += pagina
    destino_dir.mkdir(parents=True, exist_ok=True)
    tmp = destino.with_suffix(".tmp")
    tmp.write_text(json.dumps({"type": "FeatureCollection", "features": feicoes}), encoding="utf-8")
    tmp.replace(destino)
    return destino


def carregar_pontos(caminho: Path) -> pd.DataFrame:
    dados = json.loads(Path(caminho).read_text(encoding="utf-8"))
    lat, lng = [], []
    for f in dados.get("features", []):
        if not f.get("geometry"):
            continue
        c = shape(f["geometry"]).centroid
        if c.is_empty:
            continue
        x, y = c.x, c.y
        if -25 <= x <= -22 and -48 <= y <= -45:  # eixos invertidos (lat, lng)
            x, y = y, x
        lng.append(x)
        lat.append(y)
    return pd.DataFrame({"lat": lat, "lng": lng}, dtype=float)


def carregar_grupo(chave: str) -> pd.DataFrame:
    partes = [carregar_pontos(baixar_camada(c)) for c in CAMADAS[chave]]
    return pd.concat(partes, ignore_index=True)


def distancia_minima_m(lat, lng, alvo_lat, alvo_lng) -> np.ndarray:
    alvo_lat = np.asarray(alvo_lat, dtype=float)
    alvo_lng = np.asarray(alvo_lng, dtype=float)
    if alvo_lat.size == 0:
        raise ValueError("alvo vazio")
    arvore = BallTree(np.radians(np.column_stack([alvo_lat, alvo_lng])), metric="haversine")
    pts = np.radians(np.column_stack([np.asarray(lat, dtype=float), np.asarray(lng, dtype=float)]))
    d, _ = arvore.query(pts, k=1)
    return d[:, 0] * RAIO_TERRA_M


def features_celulas(area_ids: Sequence[str], estacoes: pd.DataFrame, delegacias: pd.DataFrame) -> pd.DataFrame:
    centros = [centro(a) for a in area_ids]
    lat = np.array([c[0] for c in centros])
    lng = np.array([c[1] for c in centros])
    return pd.DataFrame({
        "area_id": list(area_ids),
        "lat": lat,
        "lng": lng,
        "dist_estacao_m": distancia_minima_m(lat, lng, estacoes["lat"].to_numpy(), estacoes["lng"].to_numpy()),
        "dist_delegacia_m": distancia_minima_m(lat, lng, delegacias["lat"].to_numpy(), delegacias["lng"].to_numpy()),
    })
