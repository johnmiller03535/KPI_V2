"""add default_weight to kpi_indicators

Revision ID: o8p9q0r1s2t3
Revises: n7o8p9q0r1s2
Create Date: 2026-05-04

"""
from alembic import op
import sqlalchemy as sa

revision = 'o8p9q0r1s2t3'
down_revision = 'n7o8p9q0r1s2'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('kpi_indicators', sa.Column('default_weight', sa.Integer(), nullable=True))


def downgrade():
    op.drop_column('kpi_indicators', 'default_weight')
