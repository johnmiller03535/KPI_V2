"""add periods and period_exceptions tables

Revision ID: c3d4e5f6a7b8
Revises: a1b2c3d4e5f6
Create Date: 2026-04-14 18:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ### periods table ###
    op.create_table(
        'periods',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('period_type', sa.Enum('monthly', 'quarterly', 'yearly', name='periodtype'), nullable=False),
        sa.Column('year', sa.Integer(), nullable=False),
        sa.Column('month', sa.Integer(), nullable=True),
        sa.Column('quarter', sa.Integer(), nullable=True),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('date_start', sa.Date(), nullable=False),
        sa.Column('date_end', sa.Date(), nullable=False),
        sa.Column('submit_deadline', sa.Date(), nullable=False),
        sa.Column('review_deadline', sa.Date(), nullable=False),
        sa.Column('status', sa.Enum('draft', 'active', 'review', 'closed', name='periodstatus'), nullable=False),
        sa.Column('redmine_tasks_created', sa.Boolean(), nullable=True),
        sa.Column('redmine_tasks_count', sa.Integer(), nullable=True),
        sa.Column('created_by', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    # ### period_exceptions table ###
    op.create_table(
        'period_exceptions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('period_id', sa.UUID(), nullable=False),
        sa.Column('employee_redmine_id', sa.String(), nullable=False),
        sa.Column('employee_login', sa.String(), nullable=False),
        sa.Column('exception_type', sa.Enum('dismissed', 'transferred', 'excluded', 'maternity', name='exceptiontype'), nullable=False),
        sa.Column('event_date', sa.Date(), nullable=True),
        sa.Column('new_position_id', sa.String(), nullable=True),
        sa.Column('new_department_code', sa.String(), nullable=True),
        sa.Column('comment', sa.Text(), nullable=True),
        sa.Column('created_by', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_period_exceptions_period_id'), 'period_exceptions', ['period_id'], unique=False)
    op.create_index(op.f('ix_period_exceptions_employee_redmine_id'), 'period_exceptions', ['employee_redmine_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_period_exceptions_employee_redmine_id'), table_name='period_exceptions')
    op.drop_index(op.f('ix_period_exceptions_period_id'), table_name='period_exceptions')
    op.drop_table('period_exceptions')
    op.drop_table('periods')
    op.execute("DROP TYPE IF EXISTS exceptiontype")
    op.execute("DROP TYPE IF EXISTS periodstatus")
    op.execute("DROP TYPE IF EXISTS periodtype")
