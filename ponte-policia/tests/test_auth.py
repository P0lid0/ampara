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


ROTAS_POR_CHAVE = [("PONTE_CHAVE_SERVICO", "X-Chave-Servico", "POST", "/ocorrencias"),
                   ("PONTE_CHAVE_POLICIA", "X-Chave-Policia", "GET", "/hotspots")]


@pytest.mark.parametrize("modo", ["vazia", "ausente"])
@pytest.mark.parametrize("var,cab,metodo,rota", ROTAS_POR_CHAVE, ids=["servico", "policia"])
def test_chave_nao_configurada_falha_fechado(client, monkeypatch, var, cab, metodo, rota, modo):  # Review Focus 3
    if modo == "vazia":
        monkeypatch.setenv(var, "")
    else:
        monkeypatch.delenv(var, raising=False)
    corpo = {"json": payload_valido()} if metodo == "POST" else {}
    for enviado in ({}, {cab: ""}, {cab: "x"}, {cab: "chavé-ç".encode("utf-8")}):
        assert client.request(metodo, rota, headers=enviado, **corpo).status_code == 401
