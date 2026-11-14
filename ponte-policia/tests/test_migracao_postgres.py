import os
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect

pytestmark = pytest.mark.postgres

RAIZ = Path(__file__).resolve().parent.parent
URL_TESTE = os.environ.get("PONTE_DB_TEST", "")


@pytest.mark.skipif(not URL_TESTE, reason="PONTE_DB_TEST ausente")
def test_upgrade_cria_tabelas_e_downgrade_remove(monkeypatch):
    monkeypatch.setenv("PONTE_DB", URL_TESTE)
    cfg = Config(str(RAIZ / "alembic.ini"))
    cfg.set_main_option("script_location", str(RAIZ / "alembic"))
    engine = create_engine(URL_TESTE)
    try:
        command.downgrade(cfg, "base")
        command.upgrade(cfg, "head")
        assert set(inspect(engine).get_table_names()) == {
            "ocorrencias", "trilha_pos_roubo", "retornos", "alembic_version"}
        command.downgrade(cfg, "base")
        assert set(inspect(engine).get_table_names()) == {"alembic_version"}
    finally:
        engine.dispose()
