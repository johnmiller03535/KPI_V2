"""add unit_name to kpi_indicators

Revision ID: n7o8p9q0r1s2
Revises: m6n7o8p9q0r1
Create Date: 2026-05-04

"""
from alembic import op
import sqlalchemy as sa

revision = 'n7o8p9q0r1s2'
down_revision = 'm6n7o8p9q0r1'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('kpi_indicators', sa.Column('unit_name', sa.String(), nullable=True))


def downgrade():
    op.drop_column('kpi_indicators', 'unit_name')
