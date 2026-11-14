"""Dois PATCH simultâneos no PostgreSQL real: o estado terminal não pode ser reaberto."""
import threading

import pytest
from alembic import command
from sqlalchemy import create_engine, delete, func, select
from sqlalchemy.orm import Session

from app.dominio import ErroTransicaoInvalida, StatusOcorrencia as S
from app.models import Ocorrencia, Retorno, TrilhaPosRoubo
from app.repositories.ocorrencia_repository import OcorrenciaRepository
from app.schemas import OcorrenciaCriar
from app.services.ocorrencia_service import OcorrenciaService
from tests.fabrica import AGORA, payload_valido

pytestmark = pytest.mark.postgres


def test_patch_simultaneo_nao_reabre_estado_terminal(url_pg_teste, alembic_cfg):
    command.upgrade(alembic_cfg, "head")
    engine = create_engine(url_pg_teste)
    try:
        with Session(engine, expire_on_commit=False) as s:
            servico = OcorrenciaService(OcorrenciaRepository(s), lambda: AGORA)
            oc, _ = servico.registrar(OcorrenciaCriar(**payload_valido()))
            servico.atualizar_status(oc.protocolo, S.EM_ANALISE, "Em análise.")
            protocolo, oc_id = oc.protocolo, oc.id

        a_leu, liberar_a = threading.Event(), threading.Event()
        resultado: dict[str, object] = {}

        def agora_que_pausa():
            # Chamado depois da leitura e antes do commit: o agente A "pensa" aqui.
            a_leu.set()
            liberar_a.wait(10)
            return AGORA

        def agente(nome, novo, agora):
            with Session(engine, expire_on_commit=False) as s:
                try:
                    OcorrenciaService(OcorrenciaRepository(s), agora).atualizar_status(protocolo, novo, "Fim.")
                    resultado[nome] = "ok"
                except ErroTransicaoInvalida:
                    resultado[nome] = "409"

        a = threading.Thread(target=agente, args=("A", S.ATENDIDA, agora_que_pausa))
        b = threading.Thread(target=agente, args=("B", S.DESCARTADA, lambda: AGORA))
        a.start()
        assert a_leu.wait(10)
        b.start()
        b.join(0.5)
        b_esperou = b.is_alive()          # com a trava, B espera A terminar
        liberar_a.set()
        a.join(10)
        b.join(10)
        assert not a.is_alive() and not b.is_alive()
        assert b_esperou and resultado == {"A": "ok", "B": "409"}
        with Session(engine) as s:
            assert s.get(Ocorrencia, oc_id).status == S.ATENDIDA
            assert s.scalar(select(func.count()).select_from(Retorno).where(Retorno.ocorrencia_id == oc_id)) == 2
    finally:
        with Session(engine) as s:
            s.execute(delete(Retorno))
            s.execute(delete(TrilhaPosRoubo))
            s.execute(delete(Ocorrencia))
            s.commit()
        engine.dispose()
