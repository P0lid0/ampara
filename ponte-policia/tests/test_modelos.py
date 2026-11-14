from datetime import timedelta
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from app.dominio import *
from app.models import Ocorrencia
from tests.fabrica import AGORA


def nova(origem_id=None, trilha=()):
    return Ocorrencia.receber(origem_id=origem_id or uuid4(), area_id="g051_026", ts=AGORA,
        tipo=TipoOcorrencia.ROUBO_CELULAR, origem_gatilho=OrigemGatilho.CHAVEIRO,
        device_hash="a" * 64, trilha=list(trilha), agora=AGORA)


def test_receber_cria_recebida_com_trilha_ordenada():
    oc = nova(trilha=[(-23.56, -46.70, AGORA), (-23.57, -46.71, AGORA)])
    assert oc.status == StatusOcorrencia.RECEBIDA and oc.recebida_em == AGORA
    assert [p.ordem for p in oc.trilha] == [0, 1] and oc.protocolo is None


def test_retorno_atual_sem_retornos_usa_o_padrao():
    assert nova().retorno_atual() == (StatusOcorrencia.RECEBIDA, MENSAGEM_PADRAO_RECEBIDA, AGORA)


def test_mudar_status_registra_retorno():
    oc, t = nova(), AGORA + timedelta(minutes=1)
    r = oc.mudar_status(StatusOcorrencia.EM_ANALISE, "Em análise", t)
    assert oc.status == StatusOcorrencia.EM_ANALISE and r.status == StatusOcorrencia.EM_ANALISE
    assert oc.retorno_atual() == (StatusOcorrencia.EM_ANALISE, "Em análise", t)


def test_mudar_status_invalido_levanta_e_nao_altera():
    oc = nova()
    with pytest.raises(ErroTransicaoInvalida):
        oc.mudar_status(StatusOcorrencia.ATENDIDA, "x", AGORA)
    assert oc.status == StatusOcorrencia.RECEBIDA and oc.retornos == []


def test_atribuir_protocolo_usa_ano_e_id(session):
    oc = nova(); session.add(oc); session.flush(); oc.atribuir_protocolo()
    assert oc.protocolo == f"PP-2026-{oc.id:06d}"


def test_roundtrip_devolve_utc_aware_e_enum(session):
    oc = nova(); session.add(oc); session.commit(); session.expire_all()
    lido = session.get(Ocorrencia, oc.id)
    assert lido.ts == AGORA and lido.ts.tzinfo is not None
    assert lido.status is StatusOcorrencia.RECEBIDA


def test_banco_guarda_o_valor_do_enum_e_nao_o_nome(session):
    session.add(nova()); session.commit()
    assert tuple(session.execute(text("select status, tipo, origem_gatilho from ocorrencias")).one()) == ("recebida", "roubo_celular", "chaveiro")


def test_origem_id_e_unico(session):
    o = uuid4(); session.add(nova(o)); session.commit()
    session.add(nova(o))
    with pytest.raises(IntegrityError):
        session.commit()
