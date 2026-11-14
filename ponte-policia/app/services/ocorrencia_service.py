"""Regras de aplicação da ocorrência: registro idempotente por origem_id."""
from collections.abc import Callable
from datetime import datetime, timezone

from sqlalchemy.exc import IntegrityError

from app.models import Ocorrencia
from app.repositories.ocorrencia_repository import OcorrenciaRepository
from app.schemas import OcorrenciaCriar


def _utc(d: datetime) -> datetime:
    return d.replace(tzinfo=timezone.utc) if d.tzinfo is None else d.astimezone(timezone.utc)


class OcorrenciaService:
    def __init__(self, repo: OcorrenciaRepository, agora: Callable[[], datetime]):
        self._repo = repo
        self._agora = agora

    def registrar(self, dados: OcorrenciaCriar) -> tuple[Ocorrencia, bool]:
        existente = self._repo.buscar_por_origem(dados.origem_id)
        if existente is not None:
            return existente, False
        oc = Ocorrencia.receber(
            origem_id=dados.origem_id, area_id=dados.area_id, ts=_utc(dados.ts),
            tipo=dados.tipo, origem_gatilho=dados.origem_gatilho, device_hash=dados.device_hash,
            trilha=[(p.lat, p.lng, _utc(p.em)) for p in dados.trilha], agora=self._agora())
        try:
            self._repo.adicionar(oc)
            oc.atribuir_protocolo()
            self._repo.commit()
        except IntegrityError:
            # Outra requisição com o mesmo origem_id venceu a corrida: devolve a dela.
            self._repo.rollback()
            vencedor = self._repo.buscar_por_origem(dados.origem_id)
            if vencedor is None:
                raise
            return vencedor, False
        return oc, True
