from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import date, datetime
from app.models.period import PeriodType, PeriodStatus
from app.models.period_exception import ExceptionType


class PeriodCreate(BaseModel):
    period_type: PeriodType
    year: int
    month: Optional[int] = None      # 1-12, для monthly
    quarter: Optional[int] = None    # 1-4, для quarterly
    name: str                        # "Март 2026"
    date_start: date
    date_end: date
    submit_deadline: date
    review_deadline: date

    @field_validator("month")
    @classmethod
    def validate_month(cls, v, info):
        if info.data.get("period_type") == PeriodType.monthly and v is None:
            raise ValueError("month обязателен для monthly периода")
        if v is not None and not (1 <= v <= 12):
            raise ValueError("month должен быть от 1 до 12")
        return v

    @field_validator("quarter")
    @classmethod
    def validate_quarter(cls, v, info):
        if info.data.get("period_type") == PeriodType.quarterly and v is None:
            raise ValueError("quarter обязателен для quarterly периода")
        if v is not None and not (1 <= v <= 4):
            raise ValueError("quarter должен быть от 1 до 4")
        return v


class PeriodResponse(BaseModel):
    id: str
    period_type: str
    year: int
    month: Optional[int]
    quarter: Optional[int]
    name: str
    date_start: date
    date_end: date
    submit_deadline: date
    review_deadline: date
    status: str
    redmine_tasks_created: bool
    redmine_tasks_count: int
    created_by: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class PeriodExceptionCreate(BaseModel):
    employee_redmine_id: str
    employee_login: str
    exception_type: ExceptionType
    event_date: Optional[date] = None
    new_position_id: Optional[str] = None
    new_department_code: Optional[str] = None
    comment: Optional[str] = None


class PeriodExceptionResponse(BaseModel):
    id: str
    period_id: str
    employee_redmine_id: str
    employee_login: str
    exception_type: str
    event_date: Optional[date]
    comment: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class CreateTasksResponse(BaseModel):
    created: int
    skipped: int
    errors: int
    dry_run: bool
