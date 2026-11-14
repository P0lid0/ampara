"""Conexão com o banco: Base declarativa, tipo de data em UTC, engine e sessão."""
from collections.abc import Iterator
from datetime import datetime, timezone
from functools import lru_cache

from sqlalchemy import DateTime, Engine, create_engine
from sqlalchemy.orm import DeclarativeBase, Session
from sqlalchemy.types import TypeDecorator

from app.config import get_settings


class Base(DeclarativeBase):
    pass


class UTCDateTime(TypeDecorator):
    """Grava sempre em UTC (datas sem fuso valem UTC) e devolve sempre datas com fuso UTC."""

    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)


@lru_cache(maxsize=4)
def _engine_para(url: str) -> Engine:
    return create_engine(url, pool_pre_ping=True)


def get_engine() -> Engine:
    return _engine_para(get_settings().db_url)


def get_session() -> Iterator[Session]:
    with Session(get_engine(), expire_on_commit=False) as sessao:
        yield sessao
