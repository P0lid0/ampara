import logging
import pytest
from datetime import datetime, timezone
from sqlalchemy import select, func
from app.models import Ocorrencia, TrilhaPosRoubo
from tests.fabrica import payload_valido, HS


def total(session):
    return session.scalar(select(func.count()).select_from(Ocorrencia))


def test_post_valido_retorna_201_e_protocolo(client):
    r = client.post("/ocorrencias", json=payload_valido(), headers=HS)
    assert r.status_code == 201
    assert r.json() == {"protocolo": "PP-2026-000001", "status": "recebida"}


def test_mesmo_origem_id_retorna_200_e_o_mesmo_protocolo(client, session):
    p = payload_valido()
    a = client.post("/ocorrencias", json=p, headers=HS)
    b = client.post("/ocorrencias", json=p, headers=HS)
    assert (a.status_code, b.status_code) == (201, 200) and a.json() == b.json()
    assert total(session) == 1


def test_origens_diferentes_geram_protocolos_sequenciais(client):
    client.post("/ocorrencias", json=payload_valido(), headers=HS)
    r = client.post("/ocorrencias", json=payload_valido(), headers=HS)
    assert r.json()["protocolo"] == "PP-2026-000002"


def test_trilha_gravada_em_ordem(client, session):
    t = [{"lat": -23.56 - i / 1000, "lng": -46.70, "em": "2026-11-16T11:3%d:00Z" % i} for i in range(3)]
    client.post("/ocorrencias", json=payload_valido(trilha=t), headers=HS)
    pontos = session.scalars(select(TrilhaPosRoubo).order_by(TrilhaPosRoubo.ordem)).all()
    assert [p.ordem for p in pontos] == [0, 1, 2]


def test_ts_com_offset_gravado_em_utc(client, session):
    client.post("/ocorrencias", json=payload_valido(ts="2026-11-16T08:30:00-03:00"), headers=HS)
    assert session.scalars(select(Ocorrencia)).one().ts == datetime(2026, 11, 16, 11, 30, tzinfo=timezone.utc)


INVALIDOS = [{"tipo": "outro"}, {"origem_gatilho": "sms"}, {"device_hash": "abc"}, {"device_hash": "A" * 64},
             {"area_id": "xyz"}, {"area_id": "g999_999"}, {"origem_id": "nao-e-uuid"}, {"ts": "ontem"},
             {"foo": "bar"}, {"trilha": [{"lat": 91, "lng": 0, "em": "2026-11-16T11:30:00Z"}]},
             {"trilha": [{"lat": -23.5, "lng": -46.7, "em": "2026-11-16T11:30:00Z"}] * 501}]


@pytest.mark.parametrize("troca", INVALIDOS)
def test_payload_invalido_retorna_422(client, session, troca):
    assert client.post("/ocorrencias", json=payload_valido(**troca), headers=HS).status_code == 422
    assert total(session) == 0


def test_campo_obrigatorio_ausente_retorna_422(client):
    p = payload_valido()
    del p["device_hash"]
    assert client.post("/ocorrencias", json=p, headers=HS).status_code == 422


def test_json_invalido_retorna_422(client):
    r = client.post("/ocorrencias", content="{", headers={**HS, "Content-Type": "application/json"})
    assert r.status_code == 422


def test_422_de_validacao_nao_ecoa_o_valor_enviado(client):  # Review Focus 1
    r = client.post("/ocorrencias", json=payload_valido(tipo="valor-secreto-xyz"), headers=HS)
    assert r.status_code == 422 and "valor-secreto-xyz" not in r.text


def test_422_de_uuid_e_data_nao_ecoa_o_valor_enviado(client):
    r = client.post("/ocorrencias", json=payload_valido(origem_id="zzsecretozz", ts="ontemsecretoxx"), headers=HS)
    assert r.status_code == 422 and "secreto" not in r.text
    assert all(set(e) == {"loc", "msg"} for e in r.json()["detail"])


PII = [("observacao", "CPF 529.982.247-25", "Cpf", "529.982.247-25"),
       ("contato", "(11) 91234-5678", "Telefone", "91234-5678"),
       ("aparelho", "490154203237518", "Imei", "490154203237518"),
       ("email", "fulano@exemplo.com", "Email", "fulano@exemplo.com"),
       ("nome", "Maria Souza", "Nome", "Maria Souza")]


@pytest.mark.parametrize("campo,valor,classe,segredo", PII)
def test_pii_em_campo_extra_retorna_422_sem_ecoar(client, session, campo, valor, classe, segredo):  # Review Focus 1
    r = client.post("/ocorrencias", json=payload_valido(**{campo: valor}), headers=HS)
    assert r.status_code == 422
    assert r.json()["achados"] == [{"campo": campo, "classe": classe}]
    assert segredo not in r.text and total(session) == 0


def test_pii_dentro_de_campo_estruturado_tambem_e_barrada(client):
    r = client.post("/ocorrencias", json=payload_valido(area_id="fulano@exemplo.com"), headers=HS)
    assert r.status_code == 422 and r.json()["achados"][0]["classe"] == "Email"


def test_pii_na_trilha_e_barrada(client):
    t = [{"lat": -23.5, "lng": -46.7, "em": "2026-11-16T11:30:00Z", "obs": "liga 11 91234-5678"}]
    r = client.post("/ocorrencias", json=payload_valido(trilha=t), headers=HS)
    assert r.json()["achados"] == [{"campo": "trilha[0].obs", "classe": "Telefone"}]


def test_log_nao_contem_o_valor_da_pii(client, caplog):  # Review Focus 1
    with caplog.at_level(logging.DEBUG):
        client.post("/ocorrencias", json=payload_valido(observacao="529.982.247-25"), headers=HS)
    assert "529.982.247-25" not in caplog.text and "Cpf" in caplog.text


def test_corrida_na_idempotencia_devolve_o_vencedor(session):  # Review Focus 4
    from app.repositories.ocorrencia_repository import OcorrenciaRepository
    from app.services.ocorrencia_service import OcorrenciaService
    from app.schemas import OcorrenciaCriar
    from tests.fabrica import AGORA
    dados = OcorrenciaCriar(**payload_valido())
    repo = OcorrenciaRepository(session)
    servico = OcorrenciaService(repo, lambda: AGORA)
    vencedor, criada = servico.registrar(dados)
    assert criada is True
    original = repo.buscar_por_origem
    chamadas = iter([None])  # a 1ª consulta "não vê" o vencedor
    repo.buscar_por_origem = lambda oid: next(chamadas, None) or original(oid)
    perdedor, criada2 = servico.registrar(dados)
    assert criada2 is False and perdedor.protocolo == vencedor.protocolo and total(session) == 1


def test_corrida_real_viola_unicidade_e_devolve_o_vencedor(session):
    from app.repositories.ocorrencia_repository import OcorrenciaRepository
    from app.services.ocorrencia_service import OcorrenciaService
    from app.schemas import OcorrenciaCriar
    from tests.fabrica import AGORA
    dados = OcorrenciaCriar(**payload_valido())
    repo = OcorrenciaRepository(session)
    servico = OcorrenciaService(repo, lambda: AGORA)
    vencedor, _ = servico.registrar(dados)
    original = repo.buscar_por_origem
    consultas = []

    def cega_na_primeira(oid):
        consultas.append(oid)
        return None if len(consultas) == 1 else original(oid)

    repo.buscar_por_origem = cega_na_primeira
    perdedor, criada = servico.registrar(dados)
    assert len(consultas) == 2 and criada is False
    assert perdedor.protocolo == vencedor.protocolo and total(session) == 1
