"""Testes de geosampa.py (dados SINTETICOS; so o teste marcado `rede` acessa o WFS)."""
import json
from urllib.parse import parse_qs, urlparse

import numpy as np
import pandas as pd
import pytest
import requests

from ampara_ml.area import centro
from ampara_ml.geosampa import (
    WFS_URL,
    baixar_camada,
    carregar_pontos,
    distancia_minima_m,
    features_celulas,
    parse_capabilities,
    url_getfeature,
)

XML = (
    '<wfs:WFS_Capabilities xmlns:wfs="http://www.opengis.net/wfs/2.0"><wfs:FeatureTypeList>'
    "<wfs:FeatureType><wfs:Name>geoportal:a</wfs:Name></wfs:FeatureType>"
    "<wfs:FeatureType><wfs:Name>geoportal:b</wfs:Name></wfs:FeatureType>"
    "</wfs:FeatureTypeList></wfs:WFS_Capabilities>"
)


def test_parse_capabilities():
    assert parse_capabilities(XML) == ["geoportal:a", "geoportal:b"]


def test_url_getfeature():
    qs = parse_qs(urlparse(url_getfeature("geoportal:x", 20000)).query)
    assert qs["typeNames"] == ["geoportal:x"] and qs["startIndex"] == ["20000"] and qs["count"] == ["10000"]
    assert qs["request"] == ["GetFeature"] and qs["srsName"] == ["EPSG:4326"]
    assert qs["version"] == ["2.0.0"] and qs["outputFormat"] == ["application/json"]


def _geojson(feicoes):
    return {"type": "FeatureCollection", "features": [{"type": "Feature", "properties": {}, "geometry": g} for g in feicoes]}


def test_carregar_pontos_corrige_eixos(tmp_path):
    quad = [[-46.66, -23.56], [-46.64, -23.56], [-46.64, -23.54], [-46.66, -23.54], [-46.66, -23.56]]
    caminho = tmp_path / "c.geojson"
    caminho.write_text(json.dumps(_geojson([
        {"type": "Point", "coordinates": [-46.70, -23.56]},
        {"type": "Point", "coordinates": [-23.57, -46.71]},
        {"type": "Polygon", "coordinates": [quad]},
    ])), encoding="utf-8")
    df = carregar_pontos(caminho)
    assert df.lat.round(2).tolist() == [-23.56, -23.57, -23.55] and df.lng.round(2).tolist() == [-46.70, -46.71, -46.65]


def test_distancia_minima():
    d = distancia_minima_m(np.array([-23.5672]), np.array([-46.7019]), np.array([-23.5582, -24.0]), np.array([-46.7019, -46.7]))
    assert abs(d[0] - 1000) < 5


def test_alvo_vazio():
    with pytest.raises(ValueError):
        distancia_minima_m(np.array([-23.5]), np.array([-46.7]), np.array([]), np.array([]))


def test_features_celulas():
    lat0, lng0 = centro("g051_026")
    est = pd.DataFrame({"lat": [lat0, -23.3], "lng": [lng0, -46.4]})
    dele = pd.DataFrame({"lat": [lat0 + 0.009], "lng": [lng0]})
    f = features_celulas(["g051_026", "g000_000"], est, dele)
    assert list(f.columns) == ["area_id", "lat", "lng", "dist_estacao_m", "dist_delegacia_m"]
    assert f.dist_estacao_m.iloc[0] < 1 and abs(f.dist_delegacia_m.iloc[0] - 1000) < 5 and not f.isna().any().any()


def test_baixar_camada_reaproveita_arquivo(tmp_path, monkeypatch):
    def nao_deve_chamar(*a, **k):
        raise AssertionError("nao deveria acessar a rede")
    monkeypatch.setattr(requests, "get", nao_deve_chamar)
    (tmp_path / "geoportal_x.geojson").write_text("{}", encoding="utf-8")
    assert baixar_camada("geoportal:x", tmp_path) == tmp_path / "geoportal_x.geojson"


def test_baixar_camada_pagina_ate_esgotar(tmp_path, monkeypatch):
    paginas = [_geojson([{"type": "Point", "coordinates": [-46.7, -23.5]}] * 2), _geojson([{"type": "Point", "coordinates": [-46.6, -23.5]}])]
    chamadas = []

    class R:
        def __init__(self, j): self.j = j
        def raise_for_status(self): pass
        def json(self): return self.j

    def falso(url, timeout=None, **k):
        chamadas.append(url)
        return R(paginas[len(chamadas) - 1])
    monkeypatch.setattr(requests, "get", falso)
    caminho = baixar_camada("geoportal:x", tmp_path, pagina=2)
    assert len(chamadas) == 2
    assert len(json.loads(caminho.read_text(encoding="utf-8"))["features"]) == 3


@pytest.mark.rede
def test_wfs_responde():
    r = requests.get(WFS_URL, params={"service": "WFS", "request": "GetCapabilities"}, timeout=60)
    r.raise_for_status()
    assert len(parse_capabilities(r.text)) >= 1
