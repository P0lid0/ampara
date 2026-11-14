import pytest
from tests.fabrica import payload_valido, CHAVE_SERVICO, CHAVE_POLICIA


def test_health_sem_chave(client):
    r = client.get("/health")
    assert r.status_code == 200 and r.json() == {"status": "ok"}


@pytest.mark.parametrize("cab", [{}, {"X-Chave-Servico": ""}, {"X-Chave-Servico": "errada"},
                                 {"X-Chave-Servico": "chavé-ç".encode("utf-8")}, {"X-Chave-Policia": CHAVE_POLICIA}])
def test_post_sem_chave_de_servico_valida_retorna_401(client, cab):
    r = client.post("/ocorrencias", json=payload_valido(), headers=cab)
    assert r.status_code == 401 and r.json() == {"detail": "Chave inválida ou ausente."}


@pytest.mark.parametrize("var", ["PONTE_CHAVE_SERVICO"])
def test_chave_nao_configurada_falha_fechado(client, monkeypatch, var):  # Review Focus 3
    monkeypatch.setenv(var, "")
    for cab in ({"X-Chave-Servico": ""}, {}):
        assert client.post("/ocorrencias", json=payload_valido(), headers=cab).status_code == 401
    monkeypatch.delenv(var)
    assert client.post("/ocorrencias", json=payload_valido(), headers={"X-Chave-Servico": ""}).status_code == 401
