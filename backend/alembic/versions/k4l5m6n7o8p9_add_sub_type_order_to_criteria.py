"""add sub_type and order to kpi_criteria

Revision ID: k4l5m6n7o8p9
Revises: j3k4l5m6n7o8
Create Date: 2026-05-03
"""
from alembic import op
import sqlalchemy as sa

revision = 'k4l5m6n7o8p9'
down_revision = 'j3k4l5m6n7o8'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('kpi_criteria', sa.Column('sub_type', sa.String(), nullable=True))
    op.add_column('kpi_criteria', sa.Column('order', sa.Integer(), server_default='0', nullable=False))


def downgrade():
    op.drop_column('kpi_criteria', 'order')
    op.drop_column('kpi_criteria', 'sub_type')
