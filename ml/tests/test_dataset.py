"""Testes de dataset.py (dados SINTETICOS)."""
import numpy as np
import pandas as pd
import pytest

from ampara_ml.dataset import FEATURES_BASE, FEATURES_EXTRA, montar_dataset
from ampara_ml.geosampa import features_celulas
from ampara_ml.painel import montar_painel

PER = ["2024T1", "2024T2", "2024T3", "2024T4", "2025T1"]
AREA = "g001_001"


@pytest.fixture
def geo():
    est = pd.DataFrame({"lat": [-23.55], "lng": [-46.63]})      # SINTETICO
    dele = pd.DataFrame({"lat": [-23.56], "lng": [-46.64]})     # SINTETICO
    return features_celulas([AREA], est, dele)


@pytest.fixture
def clima():
    linhas = [(p, d, f, 20.0, 1.0) for p in PER for d in range(7) for f in range(8)]
    return pd.DataFrame(linhas, columns=["periodo", "dia_semana", "faixa", "clima_temp_media", "clima_chuva_mm"])


@pytest.fixture
def urbano():
    return pd.DataFrame({"area_id": [AREA], "densidade_pop_hab_km2": [10000.0], "iluminacao_n": [12]})


@pytest.fixture
def painel(oc_sintetico):
    return montar_painel(oc_sintetico, [AREA], PER)


@pytest.fixture
def ds(painel, geo, clima):
    return montar_dataset(painel, geo, clima, "2025T1")


def test_features_base_e_extra(painel, geo, clima, urbano, ds):
    assert ds.features == FEATURES_BASE and list(ds.X_treino.columns) == FEATURES_BASE
    ds2 = montar_dataset(painel, geo, clima, "2025T1", urbano=urbano)
    assert ds2.features == FEATURES_BASE + FEATURES_EXTRA
    assert list(ds2.X_futuro.columns) == FEATURES_BASE + FEATURES_EXTRA
    assert "ano" not in ds.features and "contagem" not in ds.features


def test_divisao_e_futuro(ds):
    assert ds.p_treino.max() < "2025T1" == ds.p_teste.min()
    assert len(ds.X_futuro) == 56 and len(ds.chave_futuro) == 56
    assert list(ds.chave_futuro.columns) == ["area_id", "lat", "lng", "dia_semana", "faixa"]
    assert len(ds.X_treino) == len(ds.y_treino) == len(ds.p_treino)
    assert len(ds.X_teste) == len(ds.y_teste) == len(ds.p_teste) == 56
    assert ds.inicio_teste == "2025T1"


def test_cortes_so_no_treino(oc_sintetico, geo, clima, ds):
    assert ds.cortes == (3, 4)
    oc2 = pd.concat([oc_sintetico] + [oc_sintetico[oc_sintetico.data == "2025-01-06"]] * 99)
    ds_b = montar_dataset(montar_painel(oc2, [AREA], PER), geo, clima, "2025T1")
    assert ds_b.cortes == ds.cortes and ds.y_teste.max() == 2


def test_nan_nas_features_falha(painel, clima):
    est = pd.DataFrame({"lat": [-23.55], "lng": [-46.63]})
    geo_outra = features_celulas(["g002_002"], est, est)
    with pytest.raises(ValueError, match="sem feature"):
        montar_dataset(painel, geo_outra, clima, "2025T1")


def test_sem_nan_nem_inf(ds):
    for X in (ds.X_treino, ds.X_teste, ds.X_futuro):
        assert np.isfinite(X.to_numpy()).all()
