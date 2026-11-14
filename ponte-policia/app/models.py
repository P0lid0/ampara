"""Modelos da Ponte Polícia: ocorrência, trilha pós-roubo e retornos."""
from datetime import datetime
from uuid import UUID

from sqlalchemy import Enum, Float, ForeignKey, Index, Integer, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base, UTCDateTime
from app.dominio import (
    MENSAGEM_PADRAO_RECEBIDA,
    ErroTransicaoInvalida,
    OrigemGatilho,
    StatusOcorrencia,
    TipoOcorrencia,
    pode_transitar,
)


def _enum(classe):
    # Sem values_callable o banco gravaria o nome (RECEBIDA) em vez do valor (recebida).
    return Enum(classe, native_enum=False, length=20,
                values_callable=lambda e: [m.value for m in e])


class Ocorrencia(Base):
    __tablename__ = "ocorrencias"
    __table_args__ = (Index("ix_ocorrencias_area_ts", "area_id", "ts"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    protocolo: Mapped[str | None] = mapped_column(String(20), unique=True, nullable=True)
    origem_id: Mapped[UUID] = mapped_column(Uuid, unique=True, nullable=False)
    area_id: Mapped[str] = mapped_column(String(16), nullable=False)
    ts: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False)
    tipo: Mapped[TipoOcorrencia] = mapped_column(_enum(TipoOcorrencia), nullable=False)
    origem_gatilho: Mapped[OrigemGatilho] = mapped_column(_enum(OrigemGatilho), nullable=False)
    device_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[StatusOcorrencia] = mapped_column(_enum(StatusOcorrencia), nullable=False)
    recebida_em: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False)

    trilha: Mapped[list["TrilhaPosRoubo"]] = relationship(
        order_by="TrilhaPosRoubo.ordem", cascade="all, delete-orphan", back_populates="ocorrencia")
    retornos: Mapped[list["Retorno"]] = relationship(
        order_by="(Retorno.criado_em, Retorno.id)", cascade="all, delete-orphan",
        back_populates="ocorrencia")

    @classmethod
    def receber(cls, *, origem_id: UUID, area_id: str, ts: datetime, tipo: TipoOcorrencia,
                origem_gatilho: OrigemGatilho, device_hash: str,
                trilha: list[tuple[float, float, datetime]], agora: datetime) -> "Ocorrencia":
        oc = cls(origem_id=origem_id, area_id=area_id, ts=ts, tipo=tipo,
                 origem_gatilho=origem_gatilho, device_hash=device_hash,
                 status=StatusOcorrencia.RECEBIDA, recebida_em=agora)
        oc.trilha = [TrilhaPosRoubo(ordem=i, lat=lat, lng=lng, em=em)
                     for i, (lat, lng, em) in enumerate(trilha)]
        oc.retornos = []
        return oc

    def atribuir_protocolo(self) -> None:
        if self.id is None:
            raise ValueError("A ocorrência precisa ter id (faça flush antes).")
        self.protocolo = f"PP-{self.recebida_em.year}-{self.id:06d}"

    def mudar_status(self, novo: StatusOcorrencia, mensagem: str, agora: datetime) -> "Retorno":
        if not pode_transitar(self.status, novo):
            raise ErroTransicaoInvalida(self.status, novo)
        retorno = Retorno(status=novo, mensagem=mensagem, criado_em=agora)
        self.retornos.append(retorno)
        self.status = novo
        return retorno

    def retorno_atual(self) -> tuple[StatusOcorrencia, str, datetime]:
        if not self.retornos:
            return (StatusOcorrencia.RECEBIDA, MENSAGEM_PADRAO_RECEBIDA, self.recebida_em)
        r = self.retornos[-1]
        return (r.status, r.mensagem, r.criado_em)


class TrilhaPosRoubo(Base):
    __tablename__ = "trilha_pos_roubo"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ocorrencia_id: Mapped[int] = mapped_column(
        ForeignKey("ocorrencias.id", ondelete="CASCADE"), nullable=False, index=True)
    ordem: Mapped[int] = mapped_column(Integer, nullable=False)
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lng: Mapped[float] = mapped_column(Float, nullable=False)
    em: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False)

    ocorrencia: Mapped[Ocorrencia] = relationship(back_populates="trilha")


class Retorno(Base):
    __tablename__ = "retornos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ocorrencia_id: Mapped[int] = mapped_column(
        ForeignKey("ocorrencias.id", ondelete="CASCADE"), nullable=False, index=True)
    status: Mapped[StatusOcorrencia] = mapped_column(_enum(StatusOcorrencia), nullable=False)
    mensagem: Mapped[str] = mapped_column(String(500), nullable=False)
    criado_em: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False)

    ocorrencia: Mapped[Ocorrencia] = relationship(back_populates="retornos")
