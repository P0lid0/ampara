import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401  (registra as tabelas no metadata)
from app.db import Base


@pytest.fixture
def engine():
    eng = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(eng)
    yield eng
    eng.dispose()


@pytest.fixture
def session(engine):
    with Session(engine, expire_on_commit=False) as s:
        yield s


@pytest.fixture
def chaves(monkeypatch):
    from tests.fabrica import CHAVE_POLICIA, CHAVE_SERVICO
    monkeypatch.setenv("PONTE_CHAVE_SERVICO", CHAVE_SERVICO)
    monkeypatch.setenv("PONTE_CHAVE_POLICIA", CHAVE_POLICIA)
    return {"servico": CHAVE_SERVICO, "policia": CHAVE_POLICIA}


@pytest.fixture
def client(engine, session, chaves):
    from fastapi.testclient import TestClient

    from app.db import get_session
    from app.deps import get_agora
    from app.main import create_app
    from tests.fabrica import AGORA

    app = create_app()
    app.dependency_overrides[get_session] = lambda: session
    app.dependency_overrides[get_agora] = lambda: (lambda: AGORA)
    with TestClient(app) as c:
        yield c
