"""Acesso a dados da ocorrência."""
from datetime import datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.dominio import StatusOcorrencia
from app.models import Ocorrencia


class OcorrenciaRepository:
    def __init__(self, session: Session):
        self._session = session

    def buscar_por_origem(self, origem_id: UUID) -> Ocorrencia | None:
        return self._session.scalar(select(Ocorrencia).where(Ocorrencia.origem_id == origem_id))

    def buscar_por_protocolo(self, protocolo: str) -> Ocorrencia | None:
        return self._session.scalar(select(Ocorrencia).where(Ocorrencia.protocolo == protocolo))

    def listar(self, status: StatusOcorrencia | None, limite: int = 200) -> list[Ocorrencia]:
        consulta = select(Ocorrencia)
        if status is not None:
            consulta = consulta.where(Ocorrencia.status == status)
        consulta = consulta.order_by(Ocorrencia.ts.desc(), Ocorrencia.id.desc()).limit(limite)
        return list(self._session.scalars(consulta))

    def contar_por_area(self, desde: datetime) -> list[tuple[str, int]]:
        consulta = (select(Ocorrencia.area_id, func.count())
                    .where(Ocorrencia.ts >= desde, Ocorrencia.status != StatusOcorrencia.DESCARTADA)
                    .group_by(Ocorrencia.area_id))
        return [(area, total) for area, total in self._session.execute(consulta)]

    def adicionar(self, oc: Ocorrencia) -> None:
        self._session.add(oc)
        self._session.flush()

    def commit(self) -> None:
        self._session.commit()

    def rollback(self) -> None:
        self._session.rollback()
