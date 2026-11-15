import csv
from datetime import date
from pathlib import Path

import numpy as np
import pytest

from ampara_ml.area import area_id, area_ids, centro, dia_semana, faixa

FIXTURE = Path(__file__).parent / "fixtures" / "area_casos.csv"


def test_area_id_pinheiros():
    assert area_id(-23.5672490, -46.7019515) == "g051_026"


def test_canto_inferior_esquerdo():
    assert area_id(-23.80, -46.83) == "g000_000"


@pytest.mark.parametrize(
    "lat,lng",
    [(-23.90, -46.5), (-23.30, -46.5), (-23.5, -46.9), (-23.5, -46.3), (-23.35, -46.5), (-23.5, -46.36)],
)
def test_fora(lat, lng):
    # limites superiores exclusivos (contratos)
    assert area_id(lat, lng) == "fora"


def test_logo_abaixo_do_limite_superior_e_area():
    assert area_id(-23.3501, -46.3601) == "g099_095"


def test_centro():
    lat, lng = centro("g051_026")
    assert lat == pytest.approx(-23.56825, abs=1e-9)
    assert lng == pytest.approx(-46.70015, abs=1e-9)


@pytest.mark.parametrize("invalido", ["fora", "x"])
def test_centro_invalido(invalido):
    with pytest.raises(ValueError):
        centro(invalido)


def test_vetorizado_igual_escalar():
    # SINTETICO: pontos inventados, um fora dos limites
    lat = np.array([-23.5672490, -23.80, -23.5505, -23.5614, -23.3501, -23.90])
    lng = np.array([-46.7019515, -46.83, -46.6333, -46.6559, -46.3601, -46.5])
    esperado = [area_id(a, b) for a, b in zip(lat, lng)]
    assert list(area_ids(lat, lng)) == esperado
    assert esperado.count("fora") == 1
    assert area_ids(lat, lng).dtype == object


def test_faixa():
    assert [faixa(h) for h in (0, 2, 3, 14, 23)] == [0, 0, 1, 4, 7]
    with pytest.raises(ValueError):
        faixa(24)
    with pytest.raises(ValueError):
        faixa(-1)


def test_dia_semana():
    assert dia_semana(date(2026, 11, 14)) == 5
    assert dia_semana(date(2026, 11, 16)) == 0


def test_casos_de_referencia_csv():
    with FIXTURE.open(newline="", encoding="utf-8") as f:
        linhas = list(csv.DictReader(f))
    assert len(linhas) == 5
    for r in linhas:
        assert area_id(float(r["lat"]), float(r["lng"])) == r["area_id"]
