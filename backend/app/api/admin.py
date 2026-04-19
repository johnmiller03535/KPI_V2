import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import Optional
from pydantic import BaseModel

from app.database import get_db
from app.core.deps import require_role
from app.models.user import User, UserRole
from app.models.employee import Employee, EmployeeStatus
from app.models.period import Period
from app.models.kpi_submission import KpiSubmission, SubmissionStatus
from app.models.audit_log import AuditLog
from app.models.sync_log import SyncLog
from app.services.kpi_mapping_service import kpi_mapping_service
from app.services.subordination_service import subordination_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/admin", tags=["admin"])


class OrgOverview(BaseModel):
    total_employees: int
    active_employees: int
    dismissed_employees: int
    employees_without_telegram: int
    employees_without_position: int


class PeriodStats(BaseModel):
    period_id: str
    period_name: str
    period_type: str
    status: str
    submit_deadline: str
    review_deadline: str
    total_employees: int
    draft_count: int
    submitted_count: int
    approved_count: int
    rejected_count: int
    no_submission_count: int
    completion_pct: float


class DeptStats(BaseModel):
    department_code: str
    department_name: str
    total: int
    submitted: int
    approved: int
    pending: int


@router.get("/data-health")
async def get_data_health(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
):
    """Диагностика качества данных: сотрудники, KPI-маппинг, матрица подчинения."""
    emp_result = await db.execute(
        select(Employee).where(Employee.status == EmployeeStatus.active)
    )
    employees = emp_result.scalars().all()

    # 1. Без position_id
    without_position_id = [
        {"redmine_id": e.redmine_id, "name": e.full_name}
        for e in employees if not e.position_id
    ]

    # 2. position_id есть, но не найден в KPI_Mapping.xlsx
    position_id_not_in_xlsx = []
    for e in employees:
        if e.position_id:
            role_id = kpi_mapping_service.pos_id_to_role_id(str(e.position_id))
            if not role_id:
                position_id_not_in_xlsx.append({
                    "redmine_id": e.redmine_id,
                    "name": e.full_name,
                    "position_id": e.position_id,
                })

    # 3. Без Telegram ID
    without_telegram_id = [
        {"redmine_id": e.redmine_id, "name": e.full_name, "position_id": e.position_id}
        for e in employees if not e.telegram_id
    ]

    # 4. Проверка матрицы подчинения
    subordination_service._load()
    evaluator_map = subordination_service._data.get("evaluator", {})
    all_manager_role_ids = {v for v in evaluator_map.values() if v}

    employee_role_ids: set[str] = set()
    for e in employees:
        if e.position_id:
            role_id = kpi_mapping_service.pos_id_to_role_id(str(e.position_id))
            if role_id:
                employee_role_ids.add(role_id)

    managers_missing = sorted(all_manager_role_ids - employee_role_ids)
    managers_found = len(all_manager_role_ids) - len(managers_missing)

    # 5. Сотрудники с пустой KPI-структурой (position_id есть в xlsx, но нет индикаторов)
    kpi_structure_empty = []
    for e in employees:
        if not e.position_id:
            continue
        role_id = kpi_mapping_service.pos_id_to_role_id(str(e.position_id))
        if not role_id:
            continue  # уже в position_id_not_in_xlsx
        structure = kpi_mapping_service.get_kpi_structure(role_id)
        if not structure.binary_auto and not structure.binary_manual and not structure.numeric:
            kpi_structure_empty.append({
                "redmine_id": e.redmine_id,
                "name": e.full_name,
                "position_id": e.position_id,
                "role_id": role_id,
            })

    return {
        "total_employees": len(employees),
        "without_position_id": without_position_id,
        "position_id_not_in_xlsx": position_id_not_in_xlsx,
        "without_telegram_id": without_telegram_id,
        "subordination_check": {
            "managers_found": managers_found,
            "managers_missing": managers_missing,
        },
        "kpi_structure_empty": kpi_structure_empty,
    }


@router.get("/overview", response_model=OrgOverview)
async def get_org_overview(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
):
    """Общая статистика по организации."""
    result = await db.execute(select(Employee))
    all_employees = result.scalars().all()

    total = len(all_employees)
    active = sum(1 for e in all_employees if e.status == EmployeeStatus.active)
    dismissed = sum(1 for e in all_employees if e.status == EmployeeStatus.dismissed)
    no_tg = sum(1 for e in all_employees
                if e.status == EmployeeStatus.active and not e.telegram_id)
    no_pos = sum(1 for e in all_employees
                 if e.status == EmployeeStatus.active and not e.position_id)

    return OrgOverview(
        total_employees=total,
        active_employees=active,
        dismissed_employees=dismissed,
        employees_without_telegram=no_tg,
        employees_without_position=no_pos,
    )


@router.get("/periods/{period_id}/stats", response_model=PeriodStats)
async def get_period_stats(
    period_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
):
    """Статистика выполнения по конкретному периоду."""
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
    total = len(employees)

    sub_result = await db.execute(
        select(KpiSubmission).where(KpiSubmission.period_id == period.id)
    )
    submissions = {s.employee_redmine_id: s for s in sub_result.scalars().all()}

    draft = submitted = approved = rejected = 0
    for emp in employees:
        sub = submissions.get(emp.redmine_id)
        if not sub:
            continue
        if sub.status == SubmissionStatus.draft:
            draft += 1
        elif sub.status == SubmissionStatus.submitted:
            submitted += 1
        elif sub.status == SubmissionStatus.approved:
            approved += 1
        elif sub.status == SubmissionStatus.rejected:
            rejected += 1

    no_submission = total - len(submissions)
    completion_pct = round(approved / total * 100, 1) if total > 0 else 0.0

    return PeriodStats(
        period_id=str(period.id),
        period_name=period.name,
        period_type=period.period_type,
        status=period.status,
        submit_deadline=str(period.submit_deadline),
        review_deadline=str(period.review_deadline),
        total_employees=total,
        draft_count=draft,
        submitted_count=submitted,
        approved_count=approved,
        rejected_count=rejected,
        no_submission_count=no_submission,
        completion_pct=completion_pct,
    )


@router.get("/periods/{period_id}/dept-stats", response_model=list[DeptStats])
async def get_dept_stats(
    period_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
):
    """Статистика по подразделениям для периода."""
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
                "total": 0,
                "submitted": 0,
                "approved": 0,
                "pending": 0,
            }
        dept_data[code]["total"] += 1
        sub = submissions.get(emp.redmine_id)
        if sub:
            if sub.status == SubmissionStatus.submitted:
                dept_data[code]["submitted"] += 1
            elif sub.status == SubmissionStatus.approved:
                dept_data[code]["approved"] += 1
            else:
                dept_data[code]["pending"] += 1
        else:
            dept_data[code]["pending"] += 1

    return [DeptStats(**v) for v in sorted(dept_data.values(), key=lambda x: x["department_name"])]


@router.get("/employees/no-telegram")
async def get_employees_no_telegram(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
):
    """Список активных сотрудников без Telegram ID."""
    result = await db.execute(
        select(Employee).where(
            and_(
                Employee.status == EmployeeStatus.active,
                Employee.telegram_id == None,
            )
        )
    )
    employees = result.scalars().all()
    return [
        {
            "redmine_id": e.redmine_id,
            "login": e.login,
            "full_name": e.full_name,
            "department_name": e.department_name,
            "position_id": e.position_id,
        }
        for e in employees
    ]


@router.get("/audit-log")
async def get_audit_log(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
    limit: int = Query(50),
    action: Optional[str] = Query(None),
):
    """Журнал аудита действий пользователей."""
    query = select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit)
    if action:
        query = query.where(AuditLog.action == action)
    result = await db.execute(query)
    logs = result.scalars().all()
    return [
        {
            "id": str(l.id),
            "user_login": l.user_login,
            "action": l.action,
            "ip_address": l.ip_address,
            "created_at": l.created_at.isoformat() if l.created_at else None,
        }
        for l in logs
    ]


@router.post("/periods/{period_id}/create-submissions")
async def create_missing_submissions(
    period_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
):
    """Создать локальные kpi_submissions для уже существующего периода (без Redmine)."""
    period_result = await db.execute(select(Period).where(Period.id == period_id))
    period = period_result.scalar_one_or_none()
    if not period:
        raise HTTPException(status_code=404, detail="Период не найден")

    emp_result = await db.execute(
        select(Employee).where(Employee.status == EmployeeStatus.active)
    )
    employees = emp_result.scalars().all()

    existing_result = await db.execute(
        select(KpiSubmission.employee_redmine_id).where(KpiSubmission.period_id == period.id)
    )
    existing_ids = {row[0] for row in existing_result.all()}

    created = 0
    for emp in employees:
        if emp.redmine_id in existing_ids:
            continue
        submission = KpiSubmission(
            employee_redmine_id=emp.redmine_id,
            employee_login=emp.login,
            period_id=period.id,
            period_name=period.name,
            position_id=emp.position_id,
            status=SubmissionStatus.draft,
        )
        db.add(submission)
        created += 1

    await db.commit()
    return {"created": created, "already_existed": len(existing_ids)}


@router.get("/sync-logs")
async def get_sync_logs_admin(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
    limit: int = Query(10),
):
    """Последние синхронизации."""
    result = await db.execute(
        select(SyncLog).order_by(SyncLog.started_at.desc()).limit(limit)
    )
    logs = result.scalars().all()
    return [
        {
            "id": str(l.id),
            "status": l.status,
            "total": l.total,
            "created_count": l.created_count,
            "updated_count": l.updated_count,
            "dismissed_count": l.dismissed_count,
            "errors_count": l.errors_count,
            "started_at": l.started_at.isoformat() if l.started_at else None,
            "finished_at": l.finished_at.isoformat() if l.finished_at else None,
        }
        for l in logs
    ]
