"""Contratos de entrada e saída da Ponte Polícia (JSON em snake_case)."""
from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.area import area_valida
from app.dominio import OrigemGatilho, StatusOcorrencia, TipoOcorrencia


class TrilhaPonto(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    em: datetime


class OcorrenciaCriar(BaseModel):
    model_config = ConfigDict(extra="forbid")

    origem_id: UUID
    area_id: str
    ts: datetime
    tipo: TipoOcorrencia
    origem_gatilho: OrigemGatilho
    device_hash: str = Field(pattern=r"^[0-9a-f]{64}$")
    trilha: list[TrilhaPonto] = Field(default_factory=list, max_length=500)

    @field_validator("area_id")
    @classmethod
    def _area_na_grade(cls, v: str) -> str:
        if not area_valida(v):
            raise ValueError("area_id fora da grade.")
        return v


class ProtocoloResposta(BaseModel):
    protocolo: str
    status: StatusOcorrencia


class RetornoResposta(BaseModel):
    protocolo: str
    status: StatusOcorrencia
    mensagem: str
    atualizado_em: datetime


class StatusAtualizar(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal[StatusOcorrencia.EM_ANALISE, StatusOcorrencia.ATENDIDA, StatusOcorrencia.DESCARTADA]
    mensagem: str = Field(min_length=1, max_length=500)


class OcorrenciaResumo(BaseModel):
    protocolo: str
    area_id: str
    ts: datetime
    tipo: TipoOcorrencia
    status: StatusOcorrencia
    origem_gatilho: OrigemGatilho


class HotspotResposta(BaseModel):
    area_id: str
    lat: float
    lng: float
    total: int
    risco_previsto: Literal["baixo", "medio", "alto"]


# --- Corpos de erro (só documentação: os handlers de app/erros.py montam o JSON) ---

class ErroSimples(BaseModel):
    """401, 404, 409 e os 422 de corpo que não é JSON ou aninhado demais."""
    detail: str


class AchadoPiiResposta(BaseModel):
    campo: str = Field(description="Caminho do campo no payload; chave do remetente vira <chave>.")
    classe: Literal["Cpf", "Email", "Telefone", "Imei", "Nome"]


class ErroPii(BaseModel):
    """422 de payload com dado pessoal: diz onde e de que classe, nunca o valor."""
    detail: str
    achados: list[AchadoPiiResposta]


class ErroValidacaoItem(BaseModel):
    loc: list[str | int]
    msg: str


class ErroValidacao(BaseModel):
    """422 de validação: sem o valor enviado (o handler descarta input e ctx)."""
    detail: list[ErroValidacaoItem]


ERRO_422_CORPO = {"model": ErroValidacao | ErroPii | ErroSimples}
