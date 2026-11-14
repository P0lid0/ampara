import pytest
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy import create_engine, inspect

import app.models  # noqa: F401  (registra as tabelas no metadata)
from app.db import Base

pytestmark = pytest.mark.postgres


def test_upgrade_cria_tabelas_e_downgrade_remove(url_pg_teste, alembic_cfg):
    engine = create_engine(url_pg_teste)
    try:
        command.downgrade(alembic_cfg, "base")
        command.upgrade(alembic_cfg, "head")
        assert set(inspect(engine).get_table_names()) == {
            "ocorrencias", "trilha_pos_roubo", "retornos", "alembic_version"}
        # As migrações descrevem exatamente os models (o SQLite da suíte cria pelo model e
        # não aplica VARCHAR(n); só aqui uma migração esquecida apareceria).
        with engine.connect() as conn:
            diff = compare_metadata(MigrationContext.configure(conn, opts={"compare_type": True}),
                                    Base.metadata)
        assert diff == []
        colunas = {c["name"]: c for c in inspect(engine).get_columns("retornos")}
        assert colunas["mensagem"]["type"].length == 500
        command.downgrade(alembic_cfg, "base")
        assert set(inspect(engine).get_table_names()) == {"alembic_version"}
    finally:
        engine.dispose()
