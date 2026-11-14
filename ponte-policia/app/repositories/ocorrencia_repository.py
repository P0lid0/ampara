"""Acesso a dados da ocorrência."""
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Ocorrencia


class OcorrenciaRepository:
    def __init__(self, session: Session):
        self._session = session

    def buscar_por_origem(self, origem_id: UUID) -> Ocorrencia | None:
        return self._session.scalar(select(Ocorrencia).where(Ocorrencia.origem_id == origem_id))

    def buscar_por_protocolo(self, protocolo: str) -> Ocorrencia | None:
        return self._session.scalar(select(Ocorrencia).where(Ocorrencia.protocolo == protocolo))

    def adicionar(self, oc: Ocorrencia) -> None:
        self._session.add(oc)
        self._session.flush()

    def commit(self) -> None:
        self._session.commit()

    def rollback(self) -> None:
        self._session.rollback()
