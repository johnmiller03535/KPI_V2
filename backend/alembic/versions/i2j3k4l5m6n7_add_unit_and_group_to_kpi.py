"""add unit and indicator_group to kpi tables

Revision ID: i2j3k4l5m6n7
Revises: h1i2j3k4l5m6
Create Date: 2026-05-01

"""
from alembic import op
import sqlalchemy as sa

revision = 'i2j3k4l5m6n7'
down_revision = 'h1i2j3k4l5m6'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('kpi_indicators', sa.Column('indicator_group', sa.String(), nullable=True))
    op.add_column('kpi_role_cards', sa.Column('unit', sa.String(), nullable=True))


def downgrade():
    op.drop_column('kpi_role_cards', 'unit')
    op.drop_column('kpi_indicators', 'indicator_group')
