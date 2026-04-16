"""add kpi_submissions table

Revision ID: d5e6f7a8b9c0
Revises: c3d4e5f6a7b8
Create Date: 2026-04-14 19:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd5e6f7a8b9c0'
down_revision: Union[str, None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'kpi_submissions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('employee_redmine_id', sa.String(), nullable=False),
        sa.Column('employee_login', sa.String(), nullable=False),
        sa.Column('period_id', sa.UUID(), nullable=False),
        sa.Column('period_name', sa.String(), nullable=False),
        sa.Column('position_id', sa.String(), nullable=True),
        sa.Column('redmine_issue_id', sa.Integer(), nullable=True),
        sa.Column('status', sa.Enum('draft', 'submitted', 'approved', 'rejected', name='submissionstatus'), nullable=False),
        sa.Column('bin_discipline_summary', sa.Text(), nullable=True),
        sa.Column('bin_schedule_summary', sa.Text(), nullable=True),
        sa.Column('bin_safety_summary', sa.Text(), nullable=True),
        sa.Column('kpi_values', sa.JSON(), nullable=True),
        sa.Column('ai_raw_summary', sa.Text(), nullable=True),
        sa.Column('ai_generated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('reviewer_redmine_id', sa.String(), nullable=True),
        sa.Column('reviewer_login', sa.String(), nullable=True),
        sa.Column('reviewer_comment', sa.Text(), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('submitted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_kpi_submissions_employee_redmine_id'), 'kpi_submissions', ['employee_redmine_id'], unique=False)
    op.create_index(op.f('ix_kpi_submissions_period_id'), 'kpi_submissions', ['period_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_kpi_submissions_period_id'), table_name='kpi_submissions')
    op.drop_index(op.f('ix_kpi_submissions_employee_redmine_id'), table_name='kpi_submissions')
    op.drop_table('kpi_submissions')
    op.execute("DROP TYPE IF EXISTS submissionstatus")
