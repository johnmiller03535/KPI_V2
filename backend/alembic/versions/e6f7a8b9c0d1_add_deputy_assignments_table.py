"""add deputy_assignments table

Revision ID: e6f7a8b9c0d1
Revises: d5e6f7a8b9c0
Create Date: 2026-04-16 08:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e6f7a8b9c0d1'
down_revision: Union[str, None] = 'd5e6f7a8b9c0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'deputy_assignments',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('manager_redmine_id', sa.String(), nullable=False),
        sa.Column('manager_login', sa.String(), nullable=False),
        sa.Column('manager_position_id', sa.String(), nullable=True),
        sa.Column('deputy_redmine_id', sa.String(), nullable=False),
        sa.Column('deputy_login', sa.String(), nullable=False),
        sa.Column('date_from', sa.Date(), nullable=False),
        sa.Column('date_to', sa.Date(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('comment', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_deputy_assignments_manager_redmine_id', 'deputy_assignments', ['manager_redmine_id'], unique=False)
    op.create_index('ix_deputy_assignments_deputy_redmine_id', 'deputy_assignments', ['deputy_redmine_id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_deputy_assignments_deputy_redmine_id', table_name='deputy_assignments')
    op.drop_index('ix_deputy_assignments_manager_redmine_id', table_name='deputy_assignments')
    op.drop_table('deputy_assignments')
