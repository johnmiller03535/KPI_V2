import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from pydantic import BaseModel
from datetime import datetime

from app.database import get_db
from app.core.deps import require_role
from app.models.user import User, UserRole
from app.models.employee import Employee, EmployeeStatus
from app.models.period import Period, PeriodStatus
from app.models.kpi_submission import KpiSubmission, SubmissionStatus
from app.services.kpi_mapping_service import kpi_mapping_service
from app.config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/finance", tags=["finance"])


class ApprovedReportItem(BaseModel):
    submission_id: str
    employee_full_name: str
    employee_login: str
    department_code: str
    department_name: str
    position_id: Optional[str]
    role_name: Optional[str]
    period_id: str
    period_name: str
    redmine_issue_id: Optional[int]
    redmine_issue_url: Optional[str]
    approved_at: Optional[datetime]
    reviewer_login: Optional[str]
    pdf_available: bool


class DeptReadiness(BaseModel):
    department_code: str
    department_name: str
    total_employees: int
    approved_count: int
    pending_count: int
    is_complete: bool
    completion_pct: float


class PeriodSummary(BaseModel):
    period_id: str
    period_name: str
    period_type: str
    status: str
    total_approved: int
    total_employees: int
    completion_pct: float
    dept_readiness: list[DeptReadiness]


@router.get("/reports", response_model=list[ApprovedReportItem])
async def get_approved_reports(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.finance, UserRole.admin)),
    period_id: Optional[str] = Query(None),
    department_code: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
):
    """
    Список отчётов для финансового блока.
    По умолчанию показывает approved + submitted.
    """
    query = select(KpiSubmission)

    if status:
        query = query.where(KpiSubmission.status == status)
    else:
        query = query.where(
            KpiSubmission.status.in_([
                SubmissionStatus.approved,
                SubmissionStatus.submitted,
            ])
        )

    if period_id:
        query = query.where(KpiSubmission.period_id == period_id)

    result = await db.execute(query)
    submissions = result.scalars().all()

    # Загружаем всех нужных сотрудников одним запросом
    emp_ids = list({s.employee_redmine_id for s in submissions})
    emp_result = await db.execute(
        select(Employee).where(Employee.redmine_id.in_(emp_ids))
    )
    employees_map = {e.redmine_id: e for e in emp_result.scalars().all()}

    reports = []
    for sub in submissions:
        emp = employees_map.get(sub.employee_redmine_id)
        if not emp:
            continue

        if department_code and emp.department_code != department_code:
            continue

        role_info = kpi_mapping_service.get_role_info(sub.position_id) if sub.position_id else None
        redmine_url = None
        if sub.redmine_issue_id:
            redmine_url = f"{settings.redmine_url}/issues/{sub.redmine_issue_id}"

        reports.append(ApprovedReportItem(
            submission_id=str(sub.id),
            employee_full_name=emp.full_name,
            employee_login=emp.login,
            department_code=emp.department_code or "",
            department_name=emp.department_name or "",
            position_id=sub.position_id,
            role_name=role_info["role"] if role_info else None,
            period_id=str(sub.period_id),
            period_name=sub.period_name,
            redmine_issue_id=sub.redmine_issue_id,
            redmine_issue_url=redmine_url,
            approved_at=sub.reviewed_at,
            reviewer_login=sub.reviewer_login,
            pdf_available=bool(sub.redmine_issue_id),
        ))

    reports.sort(key=lambda r: (r.department_name, r.employee_full_name))
    return reports


@router.get("/periods/{period_id}/summary", response_model=PeriodSummary)
async def get_period_summary(
    period_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.finance, UserRole.admin)),
):
    """
    Сводка готовности по периоду — статус по подразделениям
    (частично / полностью готово).
    """
    period_result = await db.execute(
        select(Period).where(Period.id == period_id)
    )
    period = period_result.scalar_one_or_none()
    if not period:
        raise HTTPException(status_code=404, detail="Период не найден")

    emp_result = await db.execute(
        select(Employee).where(Employee.status == EmployeeStatus.active)
    )
    employees = emp_result.scalars().all()

    sub_result = await db.execute(
        select(KpiSubmission).where(KpiSubmission.period_id == period.id)
    )
    submissions = {s.employee_redmine_id: s for s in sub_result.scalars().all()}

    dept_data: dict[str, dict] = {}
    for emp in employees:
        code = emp.department_code or "unknown"
        name = emp.department_name or "Неизвестно"
        if code not in dept_data:
            dept_data[code] = {
                "department_code": code,
                "department_name": name,
                "total": 0, "approved": 0, "pending": 0,
            }
        dept_data[code]["total"] += 1
        sub = submissions.get(emp.redmine_id)
        if sub and sub.status == SubmissionStatus.approved:
            dept_data[code]["approved"] += 1
        else:
            dept_data[code]["pending"] += 1

    dept_readiness = []
    total_approved = 0
    total_employees = len(employees)

    for d in sorted(dept_data.values(), key=lambda x: x["department_name"]):
        approved = d["approved"]
        total = d["total"]
        total_approved += approved
        pct = round(approved / total * 100, 1) if total > 0 else 0.0
        dept_readiness.append(DeptReadiness(
            department_code=d["department_code"],
            department_name=d["department_name"],
            total_employees=total,
            approved_count=approved,
            pending_count=d["pending"],
            is_complete=(approved == total),
            completion_pct=pct,
        ))

    overall_pct = round(total_approved / total_employees * 100, 1) if total_employees > 0 else 0.0

    return PeriodSummary(
        period_id=str(period.id),
        period_name=period.name,
        period_type=period.period_type,
        status=period.status,
        total_approved=total_approved,
        total_employees=total_employees,
        completion_pct=overall_pct,
        dept_readiness=dept_readiness,
    )


@router.get("/periods")
async def get_periods_for_finance(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.finance, UserRole.admin)),
):
    """Все периоды (активные и закрытые) для фильтрации."""
    result = await db.execute(
        select(Period).where(
            Period.status.in_([PeriodStatus.active, PeriodStatus.review, PeriodStatus.closed])
        ).order_by(Period.date_start.desc())
    )
    periods = result.scalars().all()
    return [
        {
            "id": str(p.id),
            "name": p.name,
            "period_type": p.period_type,
            "status": p.status,
            "date_start": str(p.date_start),
            "date_end": str(p.date_end),
        }
        for p in periods
    ]
