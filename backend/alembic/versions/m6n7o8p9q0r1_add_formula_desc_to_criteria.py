"""add formula_desc to kpi_criteria

Revision ID: m6n7o8p9q0r1
Revises: l5m6n7o8p9q0
Create Date: 2026-05-04

"""
from alembic import op
import sqlalchemy as sa

revision = 'm6n7o8p9q0r1'
down_revision = 'l5m6n7o8p9q0'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('kpi_criteria', sa.Column('formula_desc', sa.Text(), nullable=True))


def downgrade():
    op.drop_column('kpi_criteria', 'formula_desc')
