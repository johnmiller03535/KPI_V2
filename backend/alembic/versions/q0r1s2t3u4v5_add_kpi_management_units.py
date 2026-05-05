"""add kpi_management_units table with 9 units

Revision ID: q0r1s2t3u4v5
Revises: p9q0r1s2t3u4
Branch Labels: None
Depends On: None
Create Date: 2026-05-05
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


revision = 'q0r1s2t3u4v5'
down_revision = 'p9q0r1s2t3u4'
branch_labels = None
depends_on = None

UNITS = [
    'I Руководство',
    'II Уп. организационного обеспечения, бюджетного учёта и финансовой отчётности',
    'III Уп. методологии развития ЕАСУЗ и технического обеспечения',
    'IV Правовое управление',
    'V Уп. сопровождения корпоративных закупок',
    'VI Уп. подготовки земельно-имущественных торгов',
    'VII Уп. проведения, мониторинга и аналитики ЗИТ',
    'VIII Уп. цифровой трансформации и организации проектной деятельности',
    'IX Уп. анализа и автоматизации данных',
]


def upgrade():
    op.create_table(
        'kpi_management_units',
        sa.Column('id', sa.SmallInteger(), primary_key=True, autoincrement=True),
        sa.Column('name', sa.String(), nullable=False, unique=True),
    )
    for name in UNITS:
        op.execute(text(f"INSERT INTO kpi_management_units (name) VALUES ('{name}')"))


def downgrade():
    op.drop_table('kpi_management_units')
