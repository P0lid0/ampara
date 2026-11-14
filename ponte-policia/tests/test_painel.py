from tests.fabrica import payload_valido, HS, CHAVE_POLICIA

def test_painel_e_html_com_os_elementos_do_contrato(client):
    r = client.get("/policia")
    assert r.status_code == 200 and r.headers["content-type"].startswith("text/html")
    for marca in ('id="mapa"', 'id="tabela-hotspots"', 'id="tabela-ocorrencias"', 'id="filtro-status"',
                  'id="form-status"', 'id="campo-chave"', "leaflet@1.9.4"):
        assert marca in r.text

def test_painel_nao_embute_chave_nem_dados(client):
    protocolo = client.post("/ocorrencias", json=payload_valido(), headers=HS).json()["protocolo"]
    r = client.get("/policia")
    assert CHAVE_POLICIA not in r.text and protocolo not in r.text and "g051_026" not in r.text

def test_painel_nao_usa_innerhtml(client):
    assert "innerHTML" not in client.get("/policia").text

def test_api_base_vem_do_prefixo_encaminhado(client):
    assert 'const API_BASE = "/ponte";' in client.get("/policia", headers={"X-Forwarded-Prefix": "/ponte"}).text
    assert 'const API_BASE = "";' in client.get("/policia").text

def test_prefixo_malicioso_e_ignorado(client):
    r = client.get("/policia", headers={"X-Forwarded-Prefix": '";alert(1);//'})
    assert 'const API_BASE = "";' in r.text and "alert(1)" not in r.text

def test_painel_fora_do_openapi(client):
    assert "/policia" not in client.get("/openapi.json").json()["paths"]


def test_botoes_com_altura_minima_de_48px(client):
    assert "min-height:48px" in client.get("/policia").text
