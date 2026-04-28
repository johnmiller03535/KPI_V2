from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime


class KpiValueInput(BaseModel):
    """Значение одного KPI от сотрудника."""
    role_id: str
    indicator: str
    criterion: str
    formula_type: str
    weight: float
    plan_value: str
    fact_value: Optional[float] = None     # для числовых KPI
    base_value: Optional[float] = None     # знаменатель для процентных
    summary: Optional[str] = None         # текст для binary_auto (после AI + правок)


class SubmissionDraftUpdate(BaseModel):
    """Обновление черновика — частичное сохранение."""
    bin_discipline_summary: Optional[str] = None
    bin_schedule_summary: Optional[str] = None
    bin_safety_summary: Optional[str] = None
    kpi_values: Optional[list[KpiValueInput]] = None


class SubmissionResponse(BaseModel):
    id: str
    employee_redmine_id: str
    employee_login: str
    period_id: str
    period_name: str
    position_id: Optional[str]
    role_name: Optional[str] = None
    redmine_issue_id: Optional[int]
    status: str
    bin_discipline_summary: Optional[str]
    bin_schedule_summary: Optional[str]
    bin_safety_summary: Optional[str]
    kpi_values: Optional[Any]
    summary_text: Optional[str] = None
    summary_loaded_at: Optional[datetime] = None
    ai_generated_at: Optional[datetime]
    reviewer_comment: Optional[str]
    submitted_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class NumericFactInput(BaseModel):
    fact_value: float


class BinaryManualOverride(BaseModel):
    note: Optional[str] = None
    score: Optional[float] = None  # 0 или 100


class SubmissionNumericUpdate(BaseModel):
    """Ввод фактических значений числовых KPI и комментариев к бинарным."""
    numeric_values: Optional[dict[str, NumericFactInput]] = None      # criterion → fact
    binary_manual_overrides: Optional[dict[str, BinaryManualOverride]] = None  # criterion → override


class ScoreResponse(BaseModel):
    submission_id: str
    partial_score: Optional[float]
    total_weight: int
    scored_weight: int
    completion_pct: float
    status: str


class AISummaryResponse(BaseModel):
    criteria: dict
    general_summary: str
    discipline_summary: str
    time_entries_count: int
