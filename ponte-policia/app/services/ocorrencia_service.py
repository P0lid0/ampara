"""Regras de aplicação da ocorrência: registro idempotente por origem_id."""
from collections.abc import Callable
from datetime import datetime, timezone

from sqlalchemy.exc import IntegrityError

from app.dominio import OcorrenciaNaoEncontrada, StatusOcorrencia
from app.models import Ocorrencia
from app.repositories.ocorrencia_repository import OcorrenciaRepository
from app.schemas import OcorrenciaCriar, OcorrenciaResumo, RetornoResposta


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

    def _buscar(self, protocolo: str, para_atualizar: bool = False) -> Ocorrencia:
        oc = self._repo.buscar_por_protocolo(protocolo, para_atualizar)
        if oc is None:
            raise OcorrenciaNaoEncontrada(protocolo)
        return oc

    @staticmethod
    def _retorno(oc: Ocorrencia) -> RetornoResposta:
        status, mensagem, em = oc.retorno_atual()
        return RetornoResposta(protocolo=oc.protocolo, status=status, mensagem=mensagem,
                               atualizado_em=_utc(em))

    def obter_retorno(self, protocolo: str) -> RetornoResposta:
        return self._retorno(self._buscar(protocolo))

    def atualizar_status(self, protocolo: str, novo: StatusOcorrencia, mensagem: str) -> RetornoResposta:
        oc = self._buscar(protocolo, para_atualizar=True)
        oc.mudar_status(novo, mensagem, self._agora())
        self._repo.commit()
        return self._retorno(oc)

    def listar(self, status: StatusOcorrencia | None) -> list[OcorrenciaResumo]:
        return [OcorrenciaResumo(protocolo=o.protocolo, area_id=o.area_id, ts=_utc(o.ts), tipo=o.tipo,
                                 status=o.status, origem_gatilho=o.origem_gatilho)
                for o in self._repo.listar(status)]
