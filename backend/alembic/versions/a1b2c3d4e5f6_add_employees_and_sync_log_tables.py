"""add employees and sync_log tables

Revision ID: a1b2c3d4e5f6
Revises: b59e2a9d5e0c
Create Date: 2026-04-14 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'b59e2a9d5e0c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ### employees table ###
    op.create_table(
        'employees',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('redmine_id', sa.String(), nullable=False),
        sa.Column('login', sa.String(), nullable=False),
        sa.Column('firstname', sa.String(), nullable=False),
        sa.Column('lastname', sa.String(), nullable=False),
        sa.Column('email', sa.String(), nullable=True),
        sa.Column('telegram_id', sa.String(), nullable=True),
        sa.Column('position_id', sa.String(), nullable=True),
        sa.Column('department_code', sa.String(), nullable=True),
        sa.Column('department_name', sa.String(), nullable=True),
        sa.Column('status', sa.Enum('active', 'dismissed', 'maternity', 'excluded', name='employeestatus'), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('last_synced_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_employees_redmine_id'), 'employees', ['redmine_id'], unique=True)
    op.create_index(op.f('ix_employees_login'), 'employees', ['login'], unique=False)
    op.create_index(op.f('ix_employees_position_id'), 'employees', ['position_id'], unique=False)

    # ### sync_log table ###
    op.create_table(
        'sync_log',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('sync_type', sa.String(), nullable=False),
        sa.Column('status', sa.Enum('success', 'partial', 'failed', name='syncstatus'), nullable=False),
        sa.Column('total', sa.Integer(), nullable=True),
        sa.Column('created_count', sa.Integer(), nullable=True),
        sa.Column('updated_count', sa.Integer(), nullable=True),
        sa.Column('dismissed_count', sa.Integer(), nullable=True),
        sa.Column('errors_count', sa.Integer(), nullable=True),
        sa.Column('details', sa.JSON(), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('finished_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('sync_log')
    op.drop_index(op.f('ix_employees_position_id'), table_name='employees')
    op.drop_index(op.f('ix_employees_login'), table_name='employees')
    op.drop_index(op.f('ix_employees_redmine_id'), table_name='employees')
    op.drop_table('employees')
    op.execute("DROP TYPE IF EXISTS employeestatus")
    op.execute("DROP TYPE IF EXISTS syncstatus")
