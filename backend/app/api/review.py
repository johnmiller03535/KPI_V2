import logging
from datetime import datetime, timezone, date
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from typing import Optional

from app.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.employee import Employee
from app.models.kpi_submission import KpiSubmission, SubmissionStatus
from app.models.deputy import DeputyAssignment
from app.services.subordination_service import subordination_service
from app.services.kpi_mapping_service import kpi_mapping_service
from app.schemas.review import (
    ReviewDecision, SubmissionForReview,
    DeputyAssignmentCreate, DeputyAssignmentResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/review", tags=["review"])


async def _get_manager_position_id(
    current_user: User, db: AsyncSession
) -> Optional[str]:
    """Получить position_id текущего пользователя из таблицы employees."""
    result = await db.execute(
        select(Employee).where(Employee.redmine_id == current_user.redmine_id)
    )
    emp = result.scalar_one_or_none()
    return emp.position_id if emp else None


async def _get_effective_subordinate_ids(
    current_user: User, db: AsyncSession
) -> list[str]:
    """
    Возвращает список redmine_id сотрудников, отчёты которых
    может проверять текущий пользователь (напрямую или как заместитель).
    """
    manager_position_id = await _get_manager_position_id(current_user, db)
    if not manager_position_id:
        return []

    # Прямые подчинённые
    subordinate_positions = subordination_service.get_subordinates(manager_position_id)

    # Подчинённые руководителей, которых замещаем
    deputy_result = await db.execute(
        select(DeputyAssignment).where(
            DeputyAssignment.deputy_redmine_id == current_user.redmine_id,
            DeputyAssignment.is_active == True,
            or_(
                DeputyAssignment.date_to == None,
                DeputyAssignment.date_to >= date.today(),
            ),
        )
    )
    for da in deputy_result.scalars().all():
        if da.manager_position_id:
            subordinate_positions.extend(
                subordination_service.get_subordinates(da.manager_position_id)
            )

    if not subordinate_positions:
        return []

    emp_result = await db.execute(
        select(Employee).where(
            Employee.position_id.in_(subordinate_positions),
            Employee.is_active == True,
        )
    )
    return [e.redmine_id for e in emp_result.scalars().all()]


def _build_submission_response(
    sub: KpiSubmission,
    emp: Optional[Employee],
) -> SubmissionForReview:
    role_info = kpi_mapping_service.get_role_info(sub.position_id) if sub.position_id else None
    return SubmissionForReview(
        id=str(sub.id),
        employee_redmine_id=sub.employee_redmine_id,
        employee_login=sub.employee_login,
        employee_full_name=emp.full_name if emp else sub.employee_login,
        period_id=str(sub.period_id),
        period_name=sub.period_name,
        position_id=sub.position_id,
        role_name=role_info["role"] if role_info else None,
        status=sub.status,
        bin_discipline_summary=sub.bin_discipline_summary,
        bin_schedule_summary=sub.bin_schedule_summary,
        bin_safety_summary=sub.bin_safety_summary,
        kpi_values=sub.kpi_values,
        submitted_at=sub.submitted_at,
        ai_generated_at=sub.ai_generated_at,
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/submissions", response_model=list[SubmissionForReview])
async def get_submissions_for_review(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    period_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
):
    """
    Список отчётов подчинённых для проверки.
    По умолчанию — все статусы кроме draft.
    """
    subordinate_ids = await _get_effective_subordinate_ids(current_user, db)
    if not subordinate_ids:
        return []

    query = select(KpiSubmission).where(
        KpiSubmission.employee_redmine_id.in_(subordinate_ids)
    )
    if period_id:
        query = query.where(KpiSubmission.period_id == period_id)
    if status:
        query = query.where(KpiSubmission.status == status)
    else:
        query = query.where(KpiSubmission.status != SubmissionStatus.draft)

    result = await db.execute(query)
    submissions = result.scalars().all()

    response = []
    for sub in submissions:
        emp_result = await db.execute(
            select(Employee).where(Employee.redmine_id == sub.employee_redmine_id)
        )
        emp = emp_result.scalar_one_or_none()
        response.append(_build_submission_response(sub, emp))

    return response


@router.get("/submissions/{submission_id}", response_model=SubmissionForReview)
async def get_submission_detail(
    submission_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Просмотр конкретного отчёта (руководитель должен иметь доступ)."""
    subordinate_ids = await _get_effective_subordinate_ids(current_user, db)

    result = await db.execute(
        select(KpiSubmission).where(KpiSubmission.id == submission_id)
    )
    sub = result.scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="Отчёт не найден")
    if sub.employee_redmine_id not in subordinate_ids:
        raise HTTPException(status_code=403, detail="Нет доступа к этому отчёту")

    emp_result = await db.execute(
        select(Employee).where(Employee.redmine_id == sub.employee_redmine_id)
    )
    emp = emp_result.scalar_one_or_none()
    return _build_submission_response(sub, emp)


@router.post("/submissions/{submission_id}/decide")
async def decide_submission(
    submission_id: str,
    body: ReviewDecision,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Утвердить или вернуть на доработку."""
    subordinate_ids = await _get_effective_subordinate_ids(current_user, db)

    result = await db.execute(
        select(KpiSubmission).where(KpiSubmission.id == submission_id)
    )
    sub = result.scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="Отчёт не найден")
    if sub.employee_redmine_id not in subordinate_ids:
        raise HTTPException(status_code=403, detail="Нет доступа")
    if sub.status != SubmissionStatus.submitted:
        raise HTTPException(
            status_code=400,
            detail=f"Отчёт не в статусе submitted (текущий: {sub.status})",
        )

    sub.status = SubmissionStatus.approved if body.approved else SubmissionStatus.rejected
    sub.reviewer_redmine_id = current_user.redmine_id
    sub.reviewer_login = current_user.login
    sub.reviewer_comment = body.comment
    sub.reviewed_at = datetime.now(timezone.utc)

    await db.commit()

    return {
        "id": submission_id,
        "status": sub.status,
        "reviewed_at": sub.reviewed_at.isoformat(),
        "reviewer": current_user.login,
    }


@router.get("/my-team")
async def get_my_team(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Список подчинённых с их position_id и именами.
    Используется для отображения команды руководителя.
    """
    manager_position_id = await _get_manager_position_id(current_user, db)
    if not manager_position_id:
        return {"manager_position_id": None, "team_count": 0, "team": []}

    subordinate_positions = subordination_service.get_subordinates(manager_position_id)

    emp_result = await db.execute(
        select(Employee).where(
            Employee.position_id.in_(subordinate_positions),
            Employee.is_active == True,
        )
    )
    employees = emp_result.scalars().all()

    team = []
    for emp in employees:
        role_info = kpi_mapping_service.get_role_info(emp.position_id) if emp.position_id else None
        team.append({
            "redmine_id": emp.redmine_id,
            "login": emp.login,
            "full_name": emp.full_name,
            "position_id": emp.position_id,
            "role_name": role_info["role"] if role_info else None,
            "department_name": emp.department_name,
        })

    return {
        "manager_position_id": manager_position_id,
        "team_count": len(team),
        "team": team,
    }


# ---------------------------------------------------------------------------
# Замещение
# ---------------------------------------------------------------------------

@router.post("/deputies", response_model=DeputyAssignmentResponse)
async def create_deputy(
    body: DeputyAssignmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Назначить заместителя."""
    manager_position_id = await _get_manager_position_id(current_user, db)

    assignment = DeputyAssignment(
        manager_redmine_id=current_user.redmine_id,
        manager_login=current_user.login,
        manager_position_id=manager_position_id,
        deputy_redmine_id=body.deputy_redmine_id,
        deputy_login=body.deputy_login,
        date_from=body.date_from,
        date_to=body.date_to,
        comment=body.comment,
        is_active=True,
    )
    db.add(assignment)
    await db.commit()
    await db.refresh(assignment)

    return DeputyAssignmentResponse(
        id=str(assignment.id),
        manager_redmine_id=assignment.manager_redmine_id,
        deputy_redmine_id=assignment.deputy_redmine_id,
        deputy_login=assignment.deputy_login,
        date_from=assignment.date_from,
        date_to=assignment.date_to,
        is_active=assignment.is_active,
        comment=assignment.comment,
        created_at=assignment.created_at,
    )


@router.get("/deputies", response_model=list[DeputyAssignmentResponse])
async def get_my_deputies(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Мои активные замещения."""
    result = await db.execute(
        select(DeputyAssignment).where(
            DeputyAssignment.manager_redmine_id == current_user.redmine_id,
            DeputyAssignment.is_active == True,
        )
    )
    return [
        DeputyAssignmentResponse(
            id=str(d.id),
            manager_redmine_id=d.manager_redmine_id,
            deputy_redmine_id=d.deputy_redmine_id,
            deputy_login=d.deputy_login,
            date_from=d.date_from,
            date_to=d.date_to,
            is_active=d.is_active,
            comment=d.comment,
            created_at=d.created_at,
        )
        for d in result.scalars().all()
    ]
