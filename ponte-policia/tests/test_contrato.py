import json
import pathlib

import pytest

from app.pii import detectar_pii
from app.schemas import (HotspotResposta, OcorrenciaCriar, OcorrenciaResumo, ProtocoloResposta,
                         RetornoResposta, StatusAtualizar, TrilhaPonto)

DIR = pathlib.Path(__file__).parent / "contrato"
C = json.loads((DIR / "contrato.json").read_text(encoding="utf-8"))


def props(m):
    return set(m.model_json_schema()["properties"])


def test_schema_do_post_igual_ao_contrato():
    s = OcorrenciaCriar.model_json_schema()
    assert set(s["properties"]) == set(C["POST /ocorrencias"]["campos"])
    assert set(s["required"]) == set(C["POST /ocorrencias"]["obrigatorios"])
    assert s["additionalProperties"] is False
    assert s["$defs"]["TipoOcorrencia"]["enum"] == C["POST /ocorrencias"]["tipo"]
    assert s["$defs"]["OrigemGatilho"]["enum"] == C["POST /ocorrencias"]["origem_gatilho"]
    assert props(TrilhaPonto) == set(C["POST /ocorrencias"]["trilha_campos"])


def test_schemas_de_resposta_iguais_ao_contrato():
    assert props(ProtocoloResposta) == set(C["POST /ocorrencias"]["resposta"])
    assert props(RetornoResposta) == set(C["retorno"])
    assert props(HotspotResposta) == set(C["hotspot"])
    assert props(OcorrenciaResumo) == set(C["resumo"])
    assert props(StatusAtualizar) == set(C["PATCH status"]["campos"])


def test_patch_aceita_so_os_tres_status_do_contrato():
    enum = StatusAtualizar.model_json_schema()["properties"]["status"]["enum"]
    assert enum == C["PATCH status"]["status"]


def test_rotas_do_openapi_iguais_ao_contrato(client):
    paths = client.get("/openapi.json").json()["paths"]
    achadas = {(m.upper(), p) for p, ops in paths.items() for m in ops}
    assert achadas == {tuple(r) for r in C["rotas"]}


def test_esquemas_de_seguranca_usam_os_cabecalhos_do_contrato(client):
    esq = client.get("/openapi.json").json()["components"]["securitySchemes"]
    assert {k: v["name"] for k, v in esq.items()} == C["seguranca"]
    assert all(v["in"] == "header" for v in esq.values())


def test_exemplo_do_contrato_e_aceito_e_sem_pii(client):
    from tests.fabrica import HS
    assert OcorrenciaCriar(**C["exemplo"]) and detectar_pii(C["exemplo"]) == []
    assert client.post("/ocorrencias", json=C["exemplo"], headers=HS).status_code == 201


def test_exemplo_gerado_pela_api_valida_no_schema(client):
    from tests.fabrica import HS
    arq = DIR / "exemplo_da_api.json"          # gravado pelo cliente da Ponte do plano 02
    if not arq.exists():
        pytest.skip("plano 02 ainda não gravou exemplo_da_api.json")
    ex = json.loads(arq.read_text(encoding="utf-8"))
    OcorrenciaCriar(**ex)
    assert detectar_pii(ex) == []
    assert client.post("/ocorrencias", json=ex, headers=HS).status_code in (200, 201)


def test_risco_previsto_so_assume_os_valores_do_contrato():
    from app.services.hotspot_service import risco_por_total
    assert [risco_por_total(n) for n in (1, 2, 4, 5, 9)] == ["baixo", "medio", "medio", "alto", "alto"]
    assert set(map(risco_por_total, range(1, 20))) == set(C["risco_previsto"])


def test_documentacao_automatica_completa(client):
    doc = client.get("/openapi.json").json()
    assert doc["info"]["title"] == "Ponte Polícia — Ampara" and doc["info"]["version"] == "1.0.0"
    for caminho, ops in doc["paths"].items():
        for metodo, op in ops.items():
            assert op.get("summary") and op.get("description"), f"{metodo} {caminho} sem summary/description"
            if caminho != "/health":
                assert "401" in op["responses"], f"{metodo} {caminho} sem resposta 401 documentada"
    assert client.get("/docs").status_code == 200
