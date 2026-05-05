from __future__ import annotations
from datetime import date, datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel


# ─── Indicator ────────────────────────────────────────────────────────────────

# Допустимые типы показателей:
#   binary_auto        — AI оценивает автоматически (0/100)
#   binary_manual      — Руководитель вводит ✅/❌ (0/100)
#   multi_binary       — Руководитель по каждому подпоказателю (sub_type="sub_binary")
#   threshold          — числитель/знаменатель, единые пороги (0/50/100)
#   multi_threshold    — подпоказатели с собственными числитель/знаменатель и порогами
#   quarterly_threshold— числитель/знаменатель, пороги по Q1-Q4
#   absolute_threshold — одно абсолютное число, единые или квартальные пороги (is_quarterly)
#   multi_mixed        — подпоказатели смешанных типов: threshold + binary_manual

# sub_indicators структура по типам:
#   multi_binary: [{"id": uuid, "name": "...", "sub_type": "sub_binary",
#                   "formula_desc": "...", "positive_text": "...", "negative_text": "..."}]
#   multi_threshold: [{"id": uuid, "name": "...", "sub_type": "sub_threshold",
#                      "formula_desc": "...", "numerator_label": "...", "denominator_label": "...",
#                      "cumulative": false, "rules": [...]}]
#   multi_mixed: [{"id": uuid, "name": "...", "sub_type": "threshold"|"binary_manual",
#                  "formula_desc": "...", "positive_text": "...", "negative_text": "...",
#                  "numerator_label": "...", "denominator_label": "...",
#                  "cumulative": false, "rules": [...]}]

class IndicatorCreate(BaseModel):
    code: Optional[str] = None
    name: str
    formula_type: str                           # binary_auto | binary_manual | multi_binary | threshold | multi_threshold | quarterly_threshold | absolute_threshold | multi_mixed
    is_common: bool = False
    is_editable_per_role: bool = True
    indicator_group: Optional[str] = None
    unit_name: Optional[str] = None              # Управление-владелец показателя
    default_weight: Optional[int] = None         # Дефолтный вес для is_common показателей
    # Критерий (создаётся вместе с показателем)
    criterion: str
    numerator_label: Optional[str] = None
    denominator_label: Optional[str] = None
    thresholds: Optional[list[dict]] = None     # [{op, value, score}]
    sub_indicators: Optional[list[dict]] = None  # структура зависит от formula_type (см. выше)
    quarterly_thresholds: Optional[dict] = None  # {q1: [{op, value, score}], q2: ..., q3: ..., q4: ...}
    cumulative: bool = False
    plan_value: Optional[str] = None
    common_text_positive: Optional[str] = None
    common_text_negative: Optional[str] = None
    value_label: Optional[str] = None           # для absolute_threshold: подпись поля ввода
    is_quarterly: bool = False                  # для absolute_threshold: квартальные пороги
    formula_desc: Optional[str] = None          # методика расчёта (показывается сотруднику)


class IndicatorUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    # TODO: АУДИТ 2026-05-04 — смена типа разрешена временно
    formula_type: Optional[str] = None          # binary_auto | binary_manual | multi_binary | threshold | multi_threshold | quarterly_threshold | absolute_threshold | multi_mixed
    is_editable_per_role: Optional[bool] = None
    is_common: Optional[bool] = None            # только hr, admin
    indicator_group: Optional[str] = None
    unit_name: Optional[str] = None
    default_weight: Optional[int] = None
    # Обновление критерия
    criterion: Optional[str] = None
    numerator_label: Optional[str] = None
    denominator_label: Optional[str] = None
    thresholds: Optional[list[dict]] = None      # [{op, value, score}]
    sub_indicators: Optional[list[dict]] = None  # структура зависит от formula_type (см. IndicatorCreate)
    quarterly_thresholds: Optional[dict] = None  # {q1: [{op, value, score}], q2: ..., q3: ..., q4: ...}
    cumulative: Optional[bool] = None
    plan_value: Optional[str] = None
    common_text_positive: Optional[str] = None
    common_text_negative: Optional[str] = None
    value_label: Optional[str] = None           # для absolute_threshold: подпись поля ввода
    is_quarterly: Optional[bool] = None         # для absolute_threshold: квартальные пороги
    formula_desc: Optional[str] = None          # методика расчёта (показывается сотруднику)


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
    sub_type: Optional[str] = None
    order: int = 0
    value_label: Optional[str] = None
    is_quarterly: bool = False
    formula_desc: Optional[str] = None
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
    indicator_group: Optional[str] = None
    unit_name: Optional[str] = None
    default_weight: Optional[int] = None
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
    indicator_group: Optional[str] = None

    class Config:
        from_attributes = True


class CardResponse(BaseModel):
    id: UUID
    pos_id: int
    role_id: str
    role_name: Optional[str]
    unit: Optional[str] = None
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
