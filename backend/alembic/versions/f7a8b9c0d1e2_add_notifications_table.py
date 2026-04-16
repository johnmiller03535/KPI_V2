"""add notifications table

Revision ID: f7a8b9c0d1e2
Revises: e6f7a8b9c0d1
Create Date: 2026-04-16 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'f7a8b9c0d1e2'
down_revision: Union[str, None] = 'e6f7a8b9c0d1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'notifications',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('recipient_redmine_id', sa.String(), nullable=False),
        sa.Column('recipient_login', sa.String(), nullable=False),
        sa.Column('recipient_telegram_id', sa.String(), nullable=True),
        sa.Column(
            'notification_type',
            sa.Enum(
                'employee_reminder_3d',
                'employee_reminder_1d',
                'manager_reminder_3d',
                'manager_reminder_1d',
                'admin_no_telegram',
                name='notificationtype',
            ),
            nullable=False,
        ),
        sa.Column('text', sa.Text(), nullable=False),
        sa.Column('period_id', sa.String(), nullable=True),
        sa.Column('period_name', sa.String(), nullable=True),
        sa.Column('submission_id', sa.String(), nullable=True),
        sa.Column(
            'status',
            sa.Enum(
                'pending',
                'sent',
                'failed',
                'skipped',
                name='notificationstatus',
            ),
            nullable=False,
        ),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('dedup_key', sa.String(), nullable=True),
        sa.Column('sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
        ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('dedup_key'),
    )
    op.create_index('ix_notifications_recipient_redmine_id', 'notifications', ['recipient_redmine_id'])
    op.create_index('ix_notifications_dedup_key', 'notifications', ['dedup_key'])


def downgrade() -> None:
    op.drop_index('ix_notifications_dedup_key', table_name='notifications')
    op.drop_index('ix_notifications_recipient_redmine_id', table_name='notifications')
    op.drop_table('notifications')
    op.execute('DROP TYPE IF EXISTS notificationtype')
    op.execute('DROP TYPE IF EXISTS notificationstatus')
