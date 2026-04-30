"""add kpi constructor tables

Revision ID: h1i2j3k4l5m6
Revises: g8h9i0j1k2l3
Create Date: 2026-04-30 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB


revision: str = 'h1i2j3k4l5m6'
down_revision: Union[str, None] = 'g8h9i0j1k2l3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # kpi_indicators
    op.create_table(
        'kpi_indicators',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('code', sa.String(), nullable=True, unique=True),
        sa.Column('name', sa.Text(), nullable=False),
        sa.Column('formula_type', sa.String(), nullable=False),
        sa.Column('is_common', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('is_editable_per_role', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('status', sa.String(), nullable=False, server_default='draft'),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('valid_from', sa.Date(), nullable=True),
        sa.Column('valid_to', sa.Date(), nullable=True),
        sa.Column('created_by', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index('ix_kpi_indicators_status', 'kpi_indicators', ['status'])
    op.create_index('ix_kpi_indicators_formula_type', 'kpi_indicators', ['formula_type'])
    op.create_index('ix_kpi_indicators_is_common', 'kpi_indicators', ['is_common'])

    # kpi_criteria
    op.create_table(
        'kpi_criteria',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('indicator_id', UUID(as_uuid=True), sa.ForeignKey('kpi_indicators.id'), nullable=False),
        sa.Column('criterion', sa.Text(), nullable=False),
        sa.Column('numerator_label', sa.Text(), nullable=True),
        sa.Column('denominator_label', sa.Text(), nullable=True),
        sa.Column('thresholds', JSONB(), nullable=True),
        sa.Column('sub_indicators', JSONB(), nullable=True),
        sa.Column('quarterly_thresholds', JSONB(), nullable=True),
        sa.Column('cumulative', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('plan_value', sa.String(), nullable=True),
        sa.Column('common_text_positive', sa.Text(), nullable=True),
        sa.Column('common_text_negative', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index('ix_kpi_criteria_indicator_id', 'kpi_criteria', ['indicator_id'])

    # kpi_role_cards
    op.create_table(
        'kpi_role_cards',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('pos_id', sa.Integer(), nullable=False),
        sa.Column('role_id', sa.String(), nullable=False),
        sa.Column('role_name', sa.Text(), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('status', sa.String(), nullable=False, server_default='draft'),
        sa.Column('valid_from', sa.Date(), nullable=True),
        sa.Column('valid_to', sa.Date(), nullable=True),
        sa.Column('created_by', sa.String(), nullable=True),
        sa.Column('approved_by', sa.String(), nullable=True),
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index('ix_kpi_role_cards_pos_id', 'kpi_role_cards', ['pos_id'])
    op.create_index('ix_kpi_role_cards_role_id', 'kpi_role_cards', ['role_id'])
    op.create_index('ix_kpi_role_cards_status', 'kpi_role_cards', ['status'])

    # kpi_role_card_indicators
    op.create_table(
        'kpi_role_card_indicators',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('card_id', UUID(as_uuid=True), sa.ForeignKey('kpi_role_cards.id', ondelete='CASCADE'), nullable=False),
        sa.Column('indicator_id', UUID(as_uuid=True), sa.ForeignKey('kpi_indicators.id'), nullable=False),
        sa.Column('criterion_id', UUID(as_uuid=True), sa.ForeignKey('kpi_criteria.id'), nullable=True),
        sa.Column('weight', sa.Integer(), nullable=False),
        sa.Column('order_num', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('override_criterion', sa.Text(), nullable=True),
        sa.Column('override_thresholds', JSONB(), nullable=True),
        sa.Column('override_weight', sa.Integer(), nullable=True),
        sa.UniqueConstraint('card_id', 'indicator_id', name='uq_card_indicator'),
    )
    op.create_index('ix_kpi_role_card_indicators_card_id', 'kpi_role_card_indicators', ['card_id'])

    # kpi_change_requests
    op.create_table(
        'kpi_change_requests',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('type', sa.String(), nullable=False),
        sa.Column('entity_id', UUID(as_uuid=True), nullable=True),
        sa.Column('payload', JSONB(), nullable=False),
        sa.Column('status', sa.String(), nullable=False, server_default='pending'),
        sa.Column('requested_by', sa.String(), nullable=False),
        sa.Column('reviewed_by', sa.String(), nullable=True),
        sa.Column('review_comment', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index('ix_kpi_change_requests_status', 'kpi_change_requests', ['status'])


def downgrade() -> None:
    op.drop_table('kpi_change_requests')
    op.drop_table('kpi_role_card_indicators')
    op.drop_table('kpi_role_cards')
    op.drop_table('kpi_criteria')
    op.drop_table('kpi_indicators')
