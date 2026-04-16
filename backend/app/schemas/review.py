from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime, date


class ReviewDecision(BaseModel):
    """Решение руководителя по отчёту."""
    approved: bool
    comment: Optional[str] = None


class SubmissionForReview(BaseModel):
    """Отчёт сотрудника для просмотра руководителем."""
    id: str
    employee_redmine_id: str
    employee_login: str
    employee_full_name: Optional[str]
    period_id: str
    period_name: str
    position_id: Optional[str]
    role_name: Optional[str]
    status: str
    bin_discipline_summary: Optional[str]
    bin_schedule_summary: Optional[str]
    bin_safety_summary: Optional[str]
    kpi_values: Optional[list[Any]]
    submitted_at: Optional[datetime]
    ai_generated_at: Optional[datetime]

    class Config:
        from_attributes = True


class DeputyAssignmentCreate(BaseModel):
    deputy_redmine_id: str
    deputy_login: str
    date_from: date
    date_to: Optional[date] = None
    comment: Optional[str] = None


class DeputyAssignmentResponse(BaseModel):
    id: str
    manager_redmine_id: str
    deputy_redmine_id: str
    deputy_login: str
    date_from: date
    date_to: Optional[date]
    is_active: bool
    comment: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True
