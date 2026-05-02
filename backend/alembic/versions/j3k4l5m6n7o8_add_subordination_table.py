"""add subordination table

Revision ID: j3k4l5m6n7o8
Revises: i2j3k4l5m6n7
Create Date: 2026-05-02
"""
from alembic import op
import sqlalchemy as sa

revision = 'j3k4l5m6n7o8'
down_revision = 'i2j3k4l5m6n7'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'subordination',
        sa.Column('position_id', sa.String(), nullable=False),
        sa.Column('evaluator_id', sa.String(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('position_id'),
    )


def downgrade():
    op.drop_table('subordination')
