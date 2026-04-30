from __future__ import annotations
from datetime import date, datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel


# ─── Indicator ────────────────────────────────────────────────────────────────

class IndicatorCreate(BaseModel):
    code: Optional[str] = None
    name: str
    formula_type: str                           # binary_auto | binary_manual | threshold | multi_threshold | quarterly_threshold
    is_common: bool = False
    is_editable_per_role: bool = True
    # Критерий (создаётся вместе с показателем)
    criterion: str
    numerator_label: Optional[str] = None
    denominator_label: Optional[str] = None
    thresholds: Optional[list[dict]] = None     # [{condition, score}]
    sub_indicators: Optional[list[dict]] = None
    quarterly_thresholds: Optional[dict] = None
    cumulative: bool = False
    plan_value: Optional[str] = None
    common_text_positive: Optional[str] = None
    common_text_negative: Optional[str] = None


class IndicatorUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    is_editable_per_role: Optional[bool] = None
    is_common: Optional[bool] = None            # только hr, admin
    # Обновление критерия
    criterion: Optional[str] = None
    numerator_label: Optional[str] = None
    denominator_label: Optional[str] = None
    thresholds: Optional[list[dict]] = None
    sub_indicators: Optional[list[dict]] = None
    quarterly_thresholds: Optional[dict] = None
    cumulative: Optional[bool] = None
    plan_value: Optional[str] = None
    common_text_positive: Optional[str] = None
    common_text_negative: Optional[str] = None


class CriterionResponse(BaseModel):
    id: UUID
    indicator_id: UUID
    criterion: str
    numerator_label: Optional[str]
    denominator_label: Optional[str]
    thresholds: Optional[list[dict]]
    sub_indicators: Optional[list[dict]]
    quarterly_thresholds: Optional[dict]
    cumulative: bool
    plan_value: Optional[str]
    common_text_positive: Optional[str]
    common_text_negative: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class IndicatorResponse(BaseModel):
    id: UUID
    code: Optional[str]
    name: str
    formula_type: str
    is_common: bool
    is_editable_per_role: bool
    status: str
    version: int
    valid_from: Optional[date]
    valid_to: Optional[date]
    created_by: Optional[str]
    created_at: datetime
    updated_at: datetime
    criteria: list[CriterionResponse] = []
    used_in_cards_count: int = 0                # сколько карточек используют этот показатель

    class Config:
        from_attributes = True


class ApproveIndicatorRequest(BaseModel):
    valid_from: Optional[date] = None           # если не задано — начало следующего месяца


class RejectIndicatorRequest(BaseModel):
    comment: str


# ─── Role Card ────────────────────────────────────────────────────────────────

class CardIndicatorAdd(BaseModel):
    indicator_id: UUID
    criterion_id: Optional[UUID] = None
    weight: int
    order_num: int = 0
    override_criterion: Optional[str] = None
    override_thresholds: Optional[list[dict]] = None
    override_weight: Optional[int] = None


class CardIndicatorUpdate(BaseModel):
    weight: Optional[int] = None
    order_num: Optional[int] = None
    override_criterion: Optional[str] = None
    override_thresholds: Optional[list[dict]] = None
    override_weight: Optional[int] = None


class CardIndicatorResponse(BaseModel):
    id: UUID
    card_id: UUID
    indicator_id: UUID
    criterion_id: Optional[UUID]
    weight: int
    order_num: int
    override_criterion: Optional[str]
    override_thresholds: Optional[list[dict]]
    override_weight: Optional[int]
    # Денормализованные поля из indicators/criteria для удобства
    indicator_name: Optional[str] = None
    indicator_formula_type: Optional[str] = None
    criterion_text: Optional[str] = None
    is_common: Optional[bool] = None

    class Config:
        from_attributes = True


class CardResponse(BaseModel):
    id: UUID
    pos_id: int
    role_id: str
    role_name: Optional[str]
    version: int
    status: str
    valid_from: Optional[date]
    valid_to: Optional[date]
    created_by: Optional[str]
    approved_by: Optional[str]
    approved_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    indicators: list[CardIndicatorResponse] = []
    total_weight: int = 0

    class Config:
        from_attributes = True


class CardValidateResponse(BaseModel):
    valid: bool
    errors: list[str] = []
    warnings: list[str] = []


# ─── Import ───────────────────────────────────────────────────────────────────

class ImportResult(BaseModel):
    imported_indicators: int
    imported_criteria: int
    imported_cards: int
    imported_card_indicators: int
    errors: list[str] = []
