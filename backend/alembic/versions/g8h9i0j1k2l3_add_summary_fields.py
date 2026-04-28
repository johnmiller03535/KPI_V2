"""add summary_text and summary_loaded_at to kpi_submissions

Revision ID: g8h9i0j1k2l3
Revises: f7a8b9c0d1e2
Create Date: 2026-04-28 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'g8h9i0j1k2l3'
down_revision: Union[str, None] = 'f7a8b9c0d1e2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('kpi_submissions', sa.Column('summary_text', sa.Text(), nullable=True))
    op.add_column('kpi_submissions', sa.Column('summary_loaded_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('kpi_submissions', 'summary_loaded_at')
    op.drop_column('kpi_submissions', 'summary_text')
