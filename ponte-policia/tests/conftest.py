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


@pytest.fixture
def url_pg_teste():
    """URL do PostgreSQL de teste. Recusa apontar para o banco de verdade: os testes
    que a usam fazem downgrade até base e apagariam as tabelas da demonstração."""
    import os

    from sqlalchemy.engine import make_url
    url = os.environ.get("PONTE_DB_TEST", "")
    if not url:
        pytest.skip("PONTE_DB_TEST ausente")
    if url == os.environ.get("PONTE_DB") or not (make_url(url).database or "").endswith("_test"):
        pytest.fail("PONTE_DB_TEST precisa ser um banco próprio, com nome terminado em _test.")
    return url


@pytest.fixture
def alembic_cfg(url_pg_teste, monkeypatch):
    from pathlib import Path

    from alembic.config import Config
    raiz = Path(__file__).resolve().parent.parent
    monkeypatch.setenv("PONTE_DB", url_pg_teste)
    cfg = Config(str(raiz / "alembic.ini"))
    cfg.set_main_option("script_location", str(raiz / "alembic"))
    return cfg
