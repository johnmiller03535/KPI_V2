"""add absolute_threshold support: value_label and is_quarterly to kpi_criteria

Revision ID: l5m6n7o8p9q0
Revises: k4l5m6n7o8p9
Create Date: 2026-05-04

"""
from alembic import op
import sqlalchemy as sa

revision = 'l5m6n7o8p9q0'
down_revision = 'k4l5m6n7o8p9'
branch_labels = None
depends_on = None


def upgrade():
    # Новые поля в kpi_criteria для absolute_threshold
    op.add_column('kpi_criteria', sa.Column('value_label', sa.String(), nullable=True))
    op.add_column('kpi_criteria', sa.Column('is_quarterly', sa.Boolean(), server_default='false', nullable=False))


def downgrade():
    op.drop_column('kpi_criteria', 'is_quarterly')
    op.drop_column('kpi_criteria', 'value_label')
