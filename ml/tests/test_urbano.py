"""Testes de urbano.py (SINTETICO: poligonos e pontos inventados)."""
import geopandas as gpd
import pandas as pd
import pytest
from shapely.geometry import box

from ampara_ml.urbano import (
    contar_iluminacao,
    densidade_populacional,
    extrair_pontos,
    distrito_de_celulas,
    features_urbanas,
    normalizar_nome,
)


@pytest.fixture
def distritos() -> gpd.GeoDataFrame:
    """SINTETICO: Pinheiros (cod 1) e Mooca (cod 2) em EPSG:4326."""
    return gpd.GeoDataFrame(
        {
            "cod_distrito": [1, 2],
            "nome_norm": ["PINHEIROS", "MOOCA"],
            "geometry": [box(-46.71, -23.575, -46.69, -23.56), box(-46.62, -23.57, -46.60, -23.55)],
        },
        crs="EPSG:4326",
    )


def test_normalizar_nome():
    assert normalizar_nome("Moóca ") == "MOOCA" and normalizar_nome("Jd. Paulista") == "JD PAULISTA"


def test_densidade():
    d = gpd.GeoDataFrame({"cod_distrito": [1], "nome_norm": ["X"], "geometry": [box(0, 0, 2000, 2000)]}, crs="EPSG:31983")
    pop = pd.DataFrame({"nome_norm": ["X"], "populacao": [8000]})
    r = densidade_populacional(d, pop)
    assert r["densidade_hab_km2"].iloc[0] == pytest.approx(2000.0)


def test_densidade_sem_correspondencia_falha_listando():
    d = gpd.GeoDataFrame({"cod_distrito": [1], "nome_norm": ["JARDIM PAULISTA"], "geometry": [box(0, 0, 1000, 1000)]}, crs="EPSG:31983")
    pop = pd.DataFrame({"nome_norm": ["JD PAULISTA"], "populacao": [1000]})
    with pytest.raises(ValueError, match="distritos sem população: JARDIM PAULISTA"):
        densidade_populacional(d, pop)
    r = densidade_populacional(d, pop, aliases={"JARDIM PAULISTA": "JD PAULISTA"})
    assert len(r) == 1


def test_distrito_de_celulas(distritos):
    r = distrito_de_celulas(["g051_026", "g053_044", "g060_030"], distritos).set_index("area_id").cod_distrito
    assert r.tolist() == [1, 2, 1]  # a 3a esta fora de ambos: vence o mais proximo (Pinheiros)


def test_contar_iluminacao():
    pts = pd.DataFrame({"lat": [-23.5675] * 3 + [-23.5592, -23.9], "lng": [-46.7000] * 3 + [-46.6120, -46.5]})
    assert contar_iluminacao(pts).to_dict() == {"g051_026": 3, "g053_044": 1}


def test_features_urbanas_colunas_e_zero(distritos):
    dens = pd.DataFrame({"cod_distrito": [1, 2], "densidade_hab_km2": [1000.0, 2000.0]})
    ilum = pd.Series({"g051_026": 3}, name="iluminacao_n")
    r = features_urbanas(["g051_026", "g053_044"], distritos, dens, ilum)
    assert list(r.columns) == ["area_id", "densidade_pop_hab_km2", "iluminacao_n"]
    assert r["iluminacao_n"].tolist() == [3, 0]
    assert r["densidade_pop_hab_km2"].tolist() == [1000.0, 2000.0]
    assert not r.isna().any().any()


def test_densidade_populacao_duplicada_falha():
    d = gpd.GeoDataFrame({"cod_distrito": [1], "nome_norm": ["A"], "geometry": [box(0, 0, 1000, 1000)]}, crs="EPSG:31983")
    pop = pd.DataFrame({"nome_norm": ["A", "A"], "populacao": [1, 2]})
    with pytest.raises(ValueError, match="duplicados: A"):
        densidade_populacional(d, pop)


def test_extrair_pontos_valido_e_invalido():
    ok = extrair_pontos(pd.DataFrame({"FID": ["a", "b"], "ge_ponto": ["POINT (-46.7 -23.5)", "POINT(-4.6e1 -23.5)"]}))
    assert ok["lng"].tolist() == [-46.7, -46.0] and ok["lat"].tolist() == [-23.5, -23.5]
    with pytest.raises(ValueError, match="POINT"):
        extrair_pontos(pd.DataFrame({"FID": ["a"], "ge_ponto": ["POINT Z (-46.7 -23.5 1)"]}))


def test_contar_iluminacao_vazio():
    pts = pd.DataFrame({"lat": [], "lng": []})
    assert contar_iluminacao(pts).empty
