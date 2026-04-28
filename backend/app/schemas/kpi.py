from pydantic import BaseModel
from typing import Literal, Optional


KpiFormulaType = Literal[
    "binary_auto",
    "binary_manual",
    "threshold",
    "multi_threshold",
    "quarterly_threshold",
]

KpiType = Literal["binary_auto", "binary_manual", "numeric"]


class KpiItem(BaseModel):
    pos_id: int
    role_id: str
    indicator: str
    criterion: str
    plan_value: str
    weight: int
    is_common: bool
    formula_type: KpiFormulaType
    formula_desc: str
    thresholds: str
    cumulative: bool
    kpi_type: KpiType


class KpiStructure(BaseModel):
    role_id: str
    binary_auto: list[KpiItem]
    binary_manual: list[KpiItem]
    numeric: list[KpiItem]
    total_weight: int


class KpiResult(BaseModel):
    # Идентификация
    indicator: str
    criterion: str
    formula_type: str
    weight: int
    is_common: bool
    cumulative: bool
    kpi_type: str

    # Результат оценки
    score: Optional[float] = None       # 0.0–100.0 или None если не оценено
    confidence: Optional[int] = None    # 0–100, только для binary_auto
    summary: Optional[str] = None       # AI-текст, только для binary_auto

    # Флаги состояния
    awaiting_manual_input: bool = False  # binary_manual без оценки
    requires_fact_input: bool = False    # numeric без введённого факта
    fact_value: Optional[float] = None   # введённый сотрудником факт
    parsed_thresholds: Optional[list[dict]] = None  # для numeric KPI
    requires_review: bool = False        # confidence < 80
    ai_low_confidence: bool = False      # уверенность AI < 50% (новый флоу)


class KpiEngineResult(BaseModel):
    kpi_results: list[KpiResult]

    # Итоговые метрики
    partial_score: Optional[float] = None  # взвешенный % по оценённым KPI
    total_weight: int
    scored_weight: int
    completion_pct: float

    # Системные флаги
    system_flags: dict


class BinaryManualUpdate(BaseModel):
    kpi_index: int
    score: int       # допустимые значения: 0 или 100 (проверяется в endpoint)
    comment: str = ""


class PendingManualResponse(BaseModel):
    submission_id: str
    employee_name: str
    pending_count: int
    pending_items: list[dict]
