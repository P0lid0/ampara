"""inicial

Revision ID: 0001
Revises: 
Create Date: 2026-11-14 18:09:34.281426
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ### comandos gerados pelo Alembic e revisados ###
    op.create_table('ocorrencias',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('protocolo', sa.String(length=20), nullable=True),
    sa.Column('origem_id', sa.Uuid(), nullable=False),
    sa.Column('area_id', sa.String(length=16), nullable=False),
    sa.Column('ts', sa.DateTime(timezone=True), nullable=False),
    sa.Column('tipo', sa.Enum('roubo_celular', 'furto_celular', name='tipoocorrencia', native_enum=False, length=20), nullable=False),
    sa.Column('origem_gatilho', sa.Enum('chaveiro', 'web', 'guardiao', 'impacto', name='origemgatilho', native_enum=False, length=20), nullable=False),
    sa.Column('device_hash', sa.String(length=64), nullable=False),
    sa.Column('status', sa.Enum('recebida', 'em_analise', 'atendida', 'descartada', name='statusocorrencia', native_enum=False, length=20), nullable=False),
    sa.Column('recebida_em', sa.DateTime(timezone=True), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('origem_id'),
    sa.UniqueConstraint('protocolo')
    )
    op.create_index('ix_ocorrencias_area_ts', 'ocorrencias', ['area_id', 'ts'], unique=False)
    op.create_table('retornos',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('ocorrencia_id', sa.Integer(), nullable=False),
    sa.Column('status', sa.Enum('recebida', 'em_analise', 'atendida', 'descartada', name='statusocorrencia', native_enum=False, length=20), nullable=False),
    sa.Column('mensagem', sa.String(length=280), nullable=False),
    sa.Column('criado_em', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['ocorrencia_id'], ['ocorrencias.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_retornos_ocorrencia_id'), 'retornos', ['ocorrencia_id'], unique=False)
    op.create_table('trilha_pos_roubo',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('ocorrencia_id', sa.Integer(), nullable=False),
    sa.Column('ordem', sa.Integer(), nullable=False),
    sa.Column('lat', sa.Float(), nullable=False),
    sa.Column('lng', sa.Float(), nullable=False),
    sa.Column('em', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['ocorrencia_id'], ['ocorrencias.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_trilha_pos_roubo_ocorrencia_id'), 'trilha_pos_roubo', ['ocorrencia_id'], unique=False)
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### comandos gerados pelo Alembic e revisados ###
    op.drop_index(op.f('ix_trilha_pos_roubo_ocorrencia_id'), table_name='trilha_pos_roubo')
    op.drop_table('trilha_pos_roubo')
    op.drop_index(op.f('ix_retornos_ocorrencia_id'), table_name='retornos')
    op.drop_table('retornos')
    op.drop_index('ix_ocorrencias_area_ts', table_name='ocorrencias')
    op.drop_table('ocorrencias')
    # ### end Alembic commands ###
