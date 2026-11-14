import pytest
from datetime import datetime
from tests.fabrica import payload_valido, HS, CHAVE_POLICIA, CHAVE_SERVICO, AGORA
from app.dominio import MENSAGEM_PADRAO_RECEBIDA

HP = {"X-Chave-Policia": CHAVE_POLICIA}

@pytest.fixture
def protocolo(client):
    return client.post("/ocorrencias", json=payload_valido(), headers=HS).json()["protocolo"]

def patch(client, proto, status, msg="Equipe acionada.", headers=HP):
    return client.patch(f"/ocorrencias/{proto}/status", json={"status": status, "mensagem": msg}, headers=headers)

def test_retorno_inicial_e_recebida_com_mensagem_padrao(client, protocolo):
    r = client.get(f"/ocorrencias/{protocolo}/retorno", headers=HS)
    j = r.json()
    assert r.status_code == 200 and j["protocolo"] == protocolo and j["status"] == "recebida"
    assert j["mensagem"] == MENSAGEM_PADRAO_RECEBIDA
    assert datetime.fromisoformat(j["atualizado_em"]) == AGORA and j["atualizado_em"].endswith("Z")   # UTC com Z

def test_protocolo_inexistente_retorna_404(client):
    assert client.get("/ocorrencias/PP-2026-999999/retorno", headers=HS).status_code == 404
    assert patch(client, "PP-2026-999999", "em_analise").status_code == 404

def test_fluxo_completo_ate_atendida(client, protocolo):
    r = patch(client, protocolo, "em_analise", "Em análise pela equipe.")
    assert r.status_code == 200 and r.json()["status"] == "em_analise"
    assert patch(client, protocolo, "atendida", "Atendida. Obrigado.").status_code == 200
    j = client.get(f"/ocorrencias/{protocolo}/retorno", headers=HS).json()
    assert (j["status"], j["mensagem"]) == ("atendida", "Atendida. Obrigado.")

def test_em_analise_pode_ser_descartada(client, protocolo):
    patch(client, protocolo, "em_analise")
    assert patch(client, protocolo, "descartada").status_code == 200

@pytest.mark.parametrize("sequencia", [["atendida"], ["descartada"], ["em_analise", "em_analise"],
                                       ["em_analise", "atendida", "descartada"], ["em_analise", "descartada", "atendida"]])
def test_transicao_invalida_retorna_409_e_nao_muda_o_status(client, protocolo, sequencia):
    for s in sequencia[:-1]:
        assert patch(client, protocolo, s).status_code == 200
    assert patch(client, protocolo, sequencia[-1]).status_code == 409
    assert client.get(f"/ocorrencias/{protocolo}/retorno", headers=HS).json()["status"] == (sequencia[-2] if len(sequencia) > 1 else "recebida")

def test_status_recebida_nao_e_aceito_no_patch(client, protocolo):
    assert patch(client, protocolo, "recebida").status_code == 422

@pytest.mark.parametrize("msg", ["", "x" * 501])
def test_mensagem_fora_do_limite_retorna_422(client, protocolo, msg):
    assert patch(client, protocolo, "em_analise", msg).status_code == 422

def test_mensagem_com_acentos_e_emoji_e_aceita(client, protocolo):
    assert patch(client, protocolo, "em_analise", "Equipe a caminho — obrigado 🙏").status_code == 200

def test_mensagem_com_pii_retorna_422_sem_ecoar(client, protocolo):
    r = patch(client, protocolo, "em_analise", "Ligue para (11) 91234-5678")
    assert r.status_code == 422 and "91234-5678" not in r.text
    assert client.get(f"/ocorrencias/{protocolo}/retorno", headers=HS).json()["status"] == "recebida"

@pytest.mark.parametrize("cab", [{}, {"X-Chave-Servico": CHAVE_SERVICO}, {"X-Chave-Policia": "errada"}])
def test_patch_exige_chave_da_policia(client, protocolo, cab):
    assert patch(client, protocolo, "em_analise", headers=cab).status_code == 401

@pytest.mark.parametrize("cab", [{}, {"X-Chave-Policia": CHAVE_POLICIA}])
def test_get_retorno_exige_chave_de_servico(client, protocolo, cab):
    assert client.get(f"/ocorrencias/{protocolo}/retorno", headers=cab).status_code == 401

def test_mensagem_de_500_caracteres_e_persistida_inteira(client, protocolo):
    msg = "y" * 500
    assert patch(client, protocolo, "em_analise", msg).status_code == 200
    assert client.get(f"/ocorrencias/{protocolo}/retorno", headers=HS).json()["mensagem"] == msg
