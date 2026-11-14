"""retornos.mensagem de 280 para 500 caracteres

Revision ID: 0002
Revises: 0001
Create Date: 2026-11-14 20:00:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '0002'
down_revision: Union[str, None] = '0001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column('retornos', 'mensagem', existing_type=sa.String(length=280),
                    type_=sa.String(length=500), existing_nullable=False)


def downgrade() -> None:
    op.alter_column('retornos', 'mensagem', existing_type=sa.String(length=500),
                    type_=sa.String(length=280), existing_nullable=False)
