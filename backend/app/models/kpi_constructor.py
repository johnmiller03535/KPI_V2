from sqlalchemy import (
    Column, String, Boolean, Integer, Text, Date, DateTime,
    ForeignKey, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
import uuid

from app.database import Base


class KpiIndicator(Base):
    """Библиотека показателей KPI."""
    __tablename__ = "kpi_indicators"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String, unique=True, nullable=True)           # IND_001
    name = Column(Text, nullable=False)
    formula_type = Column(String, nullable=False)               # binary_auto | binary_manual | threshold | ...
    is_common = Column(Boolean, default=False, nullable=False)
    is_editable_per_role = Column(Boolean, default=True, nullable=False)
    indicator_group = Column(String, nullable=True)  # Classification group
    status = Column(String, default="draft", nullable=False)    # draft | active | archived
    version = Column(Integer, default=1, nullable=False)
    valid_from = Column(Date, nullable=True)
    valid_to = Column(Date, nullable=True)                      # NULL = текущая версия
    created_by = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class KpiCriterion(Base):
    """Критерий и формула показателя."""
    __tablename__ = "kpi_criteria"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    indicator_id = Column(UUID(as_uuid=True), ForeignKey("kpi_indicators.id"), nullable=False, index=True)
    criterion = Column(Text, nullable=False)
    numerator_label = Column(Text, nullable=True)               # подпись числителя
    denominator_label = Column(Text, nullable=True)             # подпись знаменателя
    thresholds = Column(JSONB, nullable=True)                   # [{condition, score}, ...]
    sub_indicators = Column(JSONB, nullable=True)               # для multi_threshold
    quarterly_thresholds = Column(JSONB, nullable=True)         # {Q1: {...}, Q2: {...}, ...}
    sub_type = Column(String, nullable=True)   # 'sub_binary' for multi_binary sub-items
    order = Column(Integer, default=0, nullable=False)
    cumulative = Column(Boolean, default=False, nullable=False)
    plan_value = Column(String, nullable=True)
    common_text_positive = Column(Text, nullable=True)
    common_text_negative = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class KpiRoleCard(Base):
    """Карточка KPI-показателей для должности."""
    __tablename__ = "kpi_role_cards"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pos_id = Column(Integer, nullable=False, index=True)
    role_id = Column(String, nullable=False, index=True)
    role_name = Column(Text, nullable=True)
    unit = Column(String, nullable=True)  # Подразделение/unit
    version = Column(Integer, default=1, nullable=False)
    status = Column(String, default="draft", nullable=False)    # draft | active | archived
    valid_from = Column(Date, nullable=True)
    valid_to = Column(Date, nullable=True)
    created_by = Column(String, nullable=True)
    approved_by = Column(String, nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class KpiRoleCardIndicator(Base):
    """Показатель в карточке должности."""
    __tablename__ = "kpi_role_card_indicators"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    card_id = Column(UUID(as_uuid=True), ForeignKey("kpi_role_cards.id", ondelete="CASCADE"), nullable=False, index=True)
    indicator_id = Column(UUID(as_uuid=True), ForeignKey("kpi_indicators.id"), nullable=False)
    criterion_id = Column(UUID(as_uuid=True), ForeignKey("kpi_criteria.id"), nullable=True)
    weight = Column(Integer, nullable=False)
    order_num = Column(Integer, default=0, nullable=False)
    # override полей для конкретной должности
    override_criterion = Column(Text, nullable=True)
    override_thresholds = Column(JSONB, nullable=True)
    override_weight = Column(Integer, nullable=True)

    __table_args__ = (
        UniqueConstraint("card_id", "indicator_id", name="uq_card_indicator"),
    )


class KpiChangeRequest(Base):
    """Запрос на изменение показателя или карточки."""
    __tablename__ = "kpi_change_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    type = Column(String, nullable=False)                       # new_indicator | edit_indicator | add_to_card | remove_from_card
    entity_id = Column(UUID(as_uuid=True), nullable=True)
    payload = Column(JSONB, nullable=False)
    status = Column(String, default="pending", nullable=False)  # pending | approved | rejected
    requested_by = Column(String, nullable=False)
    reviewed_by = Column(String, nullable=True)
    review_comment = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
