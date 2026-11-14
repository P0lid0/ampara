import pytest
from app.area import area_id, centro, area_valida

def test_area_id_estacao_pinheiros():
    assert area_id(-23.5672490, -46.7019515) == "g051_026"

def test_area_id_canto_inferior_esquerdo():
    assert area_id(-23.80, -46.83) == "g000_000"

@pytest.mark.parametrize("lat,lng", [(-23.34, -46.60), (-23.90, -46.60), (-23.55, -46.30), (-23.55, -46.90),
                                     (-23.35, -46.60), (-23.55, -46.36)])   # limites superiores são exclusivos (contratos)
def test_fora_dos_limites(lat, lng):
    assert area_id(lat, lng) == "fora"

def test_limite_inferior_e_inclusivo_e_logo_abaixo_do_superior_ainda_e_area():
    assert area_id(-23.80, -46.83) == "g000_000"
    assert area_id(-23.3501, -46.3601) == "g099_095"

def test_centro_de_pinheiros():
    lat, lng = centro("g051_026")
    assert lat == pytest.approx(-23.56825) and lng == pytest.approx(-46.70015)

@pytest.mark.parametrize("a", ["fora", "g100_000", "g000_096", "xyz", "G051_026", "g51_26", ""])
def test_centro_invalido_ou_fora_e_none(a):
    assert centro(a) is None

@pytest.mark.parametrize("a", ["g000_000", "g051_026", "g099_095"])
def test_centro_volta_para_a_mesma_area(a):
    assert area_id(*centro(a)) == a

def test_area_valida():
    assert area_valida("g051_026") and area_valida("fora")
    assert not area_valida("g100_000") and not area_valida("g000_096") and not area_valida("lixo")


@pytest.mark.parametrize("lat,lng", [(float("nan"), -46.6), (-23.55, float("nan")), (float("inf"), -46.6),
                                     (-23.55, float("-inf")), (float("-inf"), float("inf"))])
def test_nan_e_infinito_caem_em_fora(lat, lng):
    assert area_id(lat, lng) == "fora"


def test_logo_abaixo_do_limite_superior_nunca_sai_da_grade():
    import math
    from app.area import LAT_MAX, LNG_MAX
    a = area_id(math.nextafter(LAT_MAX, -math.inf), math.nextafter(LNG_MAX, -math.inf))
    assert a == "g099_095" and area_valida(a) and centro(a) is not None
