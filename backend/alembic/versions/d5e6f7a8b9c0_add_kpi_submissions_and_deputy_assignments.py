"""add kpi_submissions and deputy_assignments tables

Revision ID: d5e6f7a8b9c0
Revises: c3d4e5f6a7b8
Create Date: 2026-04-16 06:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'd5e6f7a8b9c0'
down_revision: Union[str, None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ### kpi_submissions table ###
    op.create_table(
        'kpi_submissions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('employee_redmine_id', sa.String(), nullable=False),
        sa.Column('employee_login', sa.String(), nullable=False),
        sa.Column('period_id', sa.UUID(), nullable=False),
        sa.Column('period_name', sa.String(), nullable=False),
        sa.Column('position_id', sa.String(), nullable=True),
        sa.Column(
            'status',
            sa.Enum('draft', 'submitted', 'approved', 'rejected', name='submissionstatus'),
            nullable=False,
        ),
        sa.Column('bin_discipline_text', sa.Text(), nullable=True),
        sa.Column('bin_schedule_text', sa.Text(), nullable=True),
        sa.Column('bin_safety_text', sa.Text(), nullable=True),
        sa.Column('bin_discipline_summary', sa.Text(), nullable=True),
        sa.Column('bin_schedule_summary', sa.Text(), nullable=True),
        sa.Column('bin_safety_summary', sa.Text(), nullable=True),
        sa.Column('ai_generated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('kpi_values', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('redmine_task_id', sa.String(), nullable=True),
        sa.Column('submitted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('reviewer_redmine_id', sa.String(), nullable=True),
        sa.Column('reviewer_login', sa.String(), nullable=True),
        sa.Column('reviewer_comment', sa.Text(), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_kpi_submissions_employee_redmine_id', 'kpi_submissions', ['employee_redmine_id'], unique=False)
    op.create_index('ix_kpi_submissions_period_id', 'kpi_submissions', ['period_id'], unique=False)
    op.create_index('ix_kpi_submissions_status', 'kpi_submissions', ['status'], unique=False)

    # ### deputy_assignments table ###
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

    op.drop_index('ix_kpi_submissions_status', table_name='kpi_submissions')
    op.drop_index('ix_kpi_submissions_period_id', table_name='kpi_submissions')
    op.drop_index('ix_kpi_submissions_employee_redmine_id', table_name='kpi_submissions')
    op.drop_table('kpi_submissions')
    op.execute("DROP TYPE IF EXISTS submissionstatus")
