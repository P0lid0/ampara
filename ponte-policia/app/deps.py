"""Dependências de injeção da Ponte Polícia."""
from collections.abc import Callable
from datetime import datetime, timezone

from fastapi import Depends
from sqlalchemy.orm import Session

from app.db import get_session
from app.repositories.ocorrencia_repository import OcorrenciaRepository
from app.services.hotspot_service import HotspotService
from app.services.ocorrencia_service import OcorrenciaService


def _agora_utc() -> datetime:
    return datetime.now(timezone.utc)


def get_agora() -> Callable[[], datetime]:
    return _agora_utc


def get_ocorrencia_service(
    session: Session = Depends(get_session),
    agora: Callable[[], datetime] = Depends(get_agora),
) -> OcorrenciaService:
    return OcorrenciaService(OcorrenciaRepository(session), agora)


def get_hotspot_service(
    session: Session = Depends(get_session),
    agora: Callable[[], datetime] = Depends(get_agora),
) -> HotspotService:
    return HotspotService(OcorrenciaRepository(session), agora)
