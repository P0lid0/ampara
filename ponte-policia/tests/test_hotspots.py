import pytest
from datetime import timedelta
from tests.fabrica import payload_valido, HS, AGORA, CHAVE_POLICIA, CHAVE_SERVICO
from app.area import centro

HP = {"X-Chave-Policia": CHAVE_POLICIA}
def enviar(client, area="g051_026", minutos_atras=10, **extra):
    ts = (AGORA - timedelta(minutes=minutos_atras)).isoformat()
    return client.post("/ocorrencias", json=payload_valido(area_id=area, ts=ts, **extra), headers=HS)
def hot(client, **params): return client.get("/hotspots", params=params, headers=HP)

def test_sem_dados_retorna_lista_vazia(client):
    assert hot(client).json() == []

def test_agrupa_por_area_ordena_e_calcula_centro_e_risco(client):
    for _ in range(3): enviar(client, "g051_026")
    enviar(client, "g052_031")
    j = hot(client).json()
    assert [(h["area_id"], h["total"], h["risco_previsto"]) for h in j] == [("g051_026", 3, "medio"), ("g052_031", 1, "baixo")]
    assert (j[0]["lat"], j[0]["lng"]) == pytest.approx(centro("g051_026"))
    assert set(j[0]) == {"area_id", "lat", "lng", "total", "risco_previsto"}

def test_cinco_ocorrencias_sao_risco_alto(client):
    for _ in range(5): enviar(client)
    assert hot(client).json()[0]["risco_previsto"] == "alto"

def test_borda_da_janela_inclui_exato_e_exclui_um_minuto_a_mais(client):         # Review Focus 5
    enviar(client, minutos_atras=60); enviar(client, "g052_031", minutos_atras=61)
    assert [h["area_id"] for h in hot(client, janela_min=60).json()] == ["g051_026"]
    assert len(hot(client, janela_min=120).json()) == 2

def test_janela_padrao_e_60_minutos(client):
    enviar(client, minutos_atras=61)
    assert hot(client).json() == []

def test_ts_com_offset_conta_no_mesmo_instante(client):                          # Review Focus 5
    client.post("/ocorrencias", headers=HS, json=payload_valido(ts="2026-11-16T08:30:00-03:00"))  # = 11:30Z, 30 min antes de AGORA
    assert hot(client, janela_min=45).json()[0]["total"] == 1

@pytest.mark.parametrize("valor", ["0", "-5", "abc", "10081", ""])
def test_janela_invalida_retorna_422(client, valor):                              # Review Focus 5
    assert client.get("/hotspots", params={"janela_min": valor}, headers=HP).status_code == 422

def test_descartada_nao_conta(client):                                           # Review Focus 5
    p = enviar(client).json()["protocolo"]
    for s in ("em_analise", "descartada"):
        client.patch(f"/ocorrencias/{p}/status", json={"status": s, "mensagem": "ok"}, headers=HP)
    assert hot(client).json() == []

def test_area_fora_da_grade_nao_aparece(client):                                  # Review Focus 5
    enviar(client, "fora"); enviar(client, "g051_026")
    assert [h["area_id"] for h in hot(client).json()] == ["g051_026"]

@pytest.mark.parametrize("cab", [{}, {"X-Chave-Servico": CHAVE_SERVICO}])
def test_hotspots_exige_chave_da_policia(client, cab):
    assert client.get("/hotspots", headers=cab).status_code == 401

@pytest.mark.parametrize("total,risco", [(1, "baixo"), (2, "medio"), (4, "medio"), (5, "alto"), (50, "alto")])
def test_risco_por_total(total, risco):
    from app.services.hotspot_service import risco_por_total
    assert risco_por_total(total) == risco
