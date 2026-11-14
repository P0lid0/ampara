"""Contratos de entrada e saída da Ponte Polícia (JSON em snake_case)."""
from datetime import datetime
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
