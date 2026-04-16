from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import Optional
from app.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.user import User, UserRole
from app.models.period import Period, PeriodStatus
from app.models.period_exception import PeriodException
from app.schemas.period import (
    PeriodCreate, PeriodResponse, PeriodExceptionCreate,
    PeriodExceptionResponse, CreateTasksResponse,
)
from app.services.period_service import period_service

router = APIRouter(prefix="/api/periods", tags=["periods"])


def _period_to_response(p: Period) -> PeriodResponse:
    return PeriodResponse(
        id=str(p.id),
        period_type=p.period_type,
        year=p.year,
        month=p.month,
        quarter=p.quarter,
        name=p.name,
        date_start=p.date_start,
        date_end=p.date_end,
        submit_deadline=p.submit_deadline,
        review_deadline=p.review_deadline,
        status=p.status,
        redmine_tasks_created=p.redmine_tasks_created or False,
        redmine_tasks_count=p.redmine_tasks_count or 0,
        created_by=p.created_by,
        created_at=p.created_at,
    )


@router.post("", response_model=PeriodResponse)
async def create_period(
    body: PeriodCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
):
    """Создать новый KPI-период (только admin)."""
    period = Period(
        period_type=body.period_type,
        year=body.year,
        month=body.month,
        quarter=body.quarter,
        name=body.name,
        date_start=body.date_start,
        date_end=body.date_end,
        submit_deadline=body.submit_deadline,
        review_deadline=body.review_deadline,
        status=PeriodStatus.draft,
        created_by=current_user.login,
    )
    db.add(period)
    await db.commit()
    await db.refresh(period)
    return _period_to_response(period)


@router.get("", response_model=list[PeriodResponse])
async def list_periods(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    status: Optional[str] = Query(None),
    year: Optional[int] = Query(None),
):
    """Список периодов."""
    query = select(Period).order_by(desc(Period.date_start))
    if status:
        query = query.where(Period.status == status)
    if year:
        query = query.where(Period.year == year)
    result = await db.execute(query)
    return [_period_to_response(p) for p in result.scalars().all()]


@router.get("/{period_id}", response_model=PeriodResponse)
async def get_period(
    period_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Получить период по ID."""
    result = await db.execute(select(Period).where(Period.id == period_id))
    period = result.scalar_one_or_none()
    if not period:
        raise HTTPException(status_code=404, detail="Период не найден")
    return _period_to_response(period)


@router.post("/{period_id}/create-tasks", response_model=CreateTasksResponse)
async def create_tasks(
    period_id: str,
    dry_run: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
):
    """
    Создать задачи в Redmine для всех сотрудников периода.
    dry_run=true — только симуляция, без реального создания.
    """
    result = await db.execute(select(Period).where(Period.id == period_id))
    period = result.scalar_one_or_none()
    if not period:
        raise HTTPException(status_code=404, detail="Период не найден")
    if period.redmine_tasks_created and not dry_run:
        raise HTTPException(status_code=400, detail="Задачи уже созданы для этого периода")

    stats = await period_service.create_redmine_tasks(period, db, dry_run=dry_run)
    return CreateTasksResponse(
        created=stats["created"],
        skipped=stats["skipped"],
        errors=stats["errors"],
        dry_run=dry_run,
    )


@router.post("/{period_id}/exceptions", response_model=PeriodExceptionResponse)
async def add_exception(
    period_id: str,
    body: PeriodExceptionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
):
    """Добавить исключение для сотрудника в периоде."""
    result = await db.execute(select(Period).where(Period.id == period_id))
    period = result.scalar_one_or_none()
    if not period:
        raise HTTPException(status_code=404, detail="Период не найден")

    exc = PeriodException(
        period_id=period.id,
        employee_redmine_id=body.employee_redmine_id,
        employee_login=body.employee_login,
        exception_type=body.exception_type,
        event_date=body.event_date,
        new_position_id=body.new_position_id,
        new_department_code=body.new_department_code,
        comment=body.comment,
        created_by=current_user.login,
    )
    db.add(exc)
    await db.commit()
    await db.refresh(exc)
    return PeriodExceptionResponse(
        id=str(exc.id),
        period_id=str(exc.period_id),
        employee_redmine_id=exc.employee_redmine_id,
        employee_login=exc.employee_login,
        exception_type=exc.exception_type,
        event_date=exc.event_date,
        comment=exc.comment,
        created_at=exc.created_at,
    )


@router.get("/{period_id}/exceptions", response_model=list[PeriodExceptionResponse])
async def list_exceptions(
    period_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
):
    """Список исключений для периода."""
    result = await db.execute(
        select(PeriodException).where(PeriodException.period_id == period_id)
    )
    exceptions = result.scalars().all()
    return [PeriodExceptionResponse(
        id=str(e.id),
        period_id=str(e.period_id),
        employee_redmine_id=e.employee_redmine_id,
        employee_login=e.employee_login,
        exception_type=e.exception_type,
        event_date=e.event_date,
        comment=e.comment,
        created_at=e.created_at,
    ) for e in exceptions]
