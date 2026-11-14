import pytest
from datetime import timedelta
from tests.fabrica import payload_valido, HS, AGORA, CHAVE_POLICIA, CHAVE_SERVICO

HP = {"X-Chave-Policia": CHAVE_POLICIA}
def enviar(client, minutos_atras=10, **extra):
    ts = (AGORA - timedelta(minutes=minutos_atras)).isoformat()
    return client.post("/ocorrencias", json=payload_valido(ts=ts, **extra), headers=HS).json()["protocolo"]

def test_lista_vazia_sem_ocorrencias(client):
    r = client.get("/ocorrencias", headers=HP)
    assert r.status_code == 200 and r.json() == []

def test_lista_traz_os_campos_do_contrato_e_nada_alem(client):
    p = enviar(client)
    item = client.get("/ocorrencias", headers=HP).json()[0]
    assert set(item) == {"protocolo", "area_id", "ts", "tipo", "status", "origem_gatilho"}
    assert item["protocolo"] == p and item["status"] == "recebida" and item["ts"].endswith("Z")

def test_ordem_e_do_mais_recente_para_o_mais_antigo(client):
    a = enviar(client, minutos_atras=30); b = enviar(client, minutos_atras=5)
    assert [i["protocolo"] for i in client.get("/ocorrencias", headers=HP).json()] == [b, a]

def test_filtro_por_status(client):
    a = enviar(client); b = enviar(client)
    client.patch(f"/ocorrencias/{b}/status", json={"status": "em_analise", "mensagem": "ok"}, headers=HP)
    assert [i["protocolo"] for i in client.get("/ocorrencias", params={"status": "em_analise"}, headers=HP).json()] == [b]
    assert [i["protocolo"] for i in client.get("/ocorrencias", params={"status": "recebida"}, headers=HP).json()] == [a]
    assert len(client.get("/ocorrencias", headers=HP).json()) == 2

def test_status_desconhecido_retorna_422(client):
    assert client.get("/ocorrencias", params={"status": "foo"}, headers=HP).status_code == 422

@pytest.mark.parametrize("cab", [{}, {"X-Chave-Servico": CHAVE_SERVICO}, {"X-Chave-Policia": "errada"}])
def test_listagem_exige_chave_da_policia(client, cab):
    assert client.get("/ocorrencias", headers=cab).status_code == 401

def test_listagem_nao_vaza_device_hash(client):
    enviar(client)
    assert "device_hash" not in client.get("/ocorrencias", headers=HP).text

def test_desempate_por_id_decrescente_com_mesmo_ts(client):
    a = enviar(client, minutos_atras=10); b = enviar(client, minutos_atras=10)
    assert [i["protocolo"] for i in client.get("/ocorrencias", headers=HP).json()] == [b, a]
