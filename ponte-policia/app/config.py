"""Configuração lida do ambiente a cada chamada (segredos nunca ficam em arquivo)."""
import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    db_url: str
    chave_servico: str
    chave_policia: str


def get_settings() -> Settings:
    return Settings(
        db_url=os.environ.get("PONTE_DB", ""),
        chave_servico=os.environ.get("PONTE_CHAVE_SERVICO", ""),
        chave_policia=os.environ.get("PONTE_CHAVE_POLICIA", ""),
    )
