"""Domínio da Ponte Polícia: enums dos contratos, máquina de estados e erros."""
from dataclasses import dataclass
from enum import Enum


class StatusOcorrencia(str, Enum):
    RECEBIDA = "recebida"
    EM_ANALISE = "em_analise"
    ATENDIDA = "atendida"
    DESCARTADA = "descartada"


class TipoOcorrencia(str, Enum):
    ROUBO_CELULAR = "roubo_celular"
    FURTO_CELULAR = "furto_celular"


class OrigemGatilho(str, Enum):
    CHAVEIRO = "chaveiro"
    WEB = "web"
    GUARDIAO = "guardiao"
    IMPACTO = "impacto"


S = StatusOcorrencia

TRANSICOES: dict[StatusOcorrencia, frozenset[StatusOcorrencia]] = {
    S.RECEBIDA: frozenset({S.EM_ANALISE}),
    S.EM_ANALISE: frozenset({S.ATENDIDA, S.DESCARTADA}),
    S.ATENDIDA: frozenset(),
    S.DESCARTADA: frozenset(),
}

MENSAGEM_PADRAO_RECEBIDA = "Ocorrência recebida pela polícia."


def pode_transitar(de: StatusOcorrencia, para: StatusOcorrencia) -> bool:
    return para in TRANSICOES.get(de, frozenset())


class ErroDeDominio(Exception):
    """Base dos erros de regra de negócio da Ponte."""


class ErroTransicaoInvalida(ErroDeDominio):
    def __init__(self, de: StatusOcorrencia, para: StatusOcorrencia):
        super().__init__(f"Transição inválida: {de.value} -> {para.value}")
        self.de = de
        self.para = para


class OcorrenciaNaoEncontrada(ErroDeDominio):
    def __init__(self, protocolo: str):
        super().__init__("Ocorrência não encontrada.")
        self.protocolo = protocolo


@dataclass(frozen=True)
class Hotspot:
    area_id: str
    lat: float
    lng: float
    total: int
    risco_previsto: str
