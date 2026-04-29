import logging
from datetime import datetime, timezone, date
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from sqlalchemy.orm.attributes import flag_modified
from typing import Optional

from app.database import get_db
from app.core.deps import get_current_user
from app.config import settings
from app.models.user import User
from app.models.employee import Employee
from app.models.kpi_submission import KpiSubmission, SubmissionStatus
from app.models.audit_log import AuditLog
from app.models.deputy import DeputyAssignment
from app.services.subordination_service import subordination_service
from app.services.kpi_mapping_service import kpi_mapping_service
from app.services.kpi_engine_service import kpi_engine_service
from app.schemas.review import (
    ReviewDecision, SubmissionForReview,
    DeputyAssignmentCreate, DeputyAssignmentResponse,
)
from app.schemas.kpi import BinaryManualUpdate, BinaryAutoOverride, PendingManualResponse
from app.schemas.kpi_submission import ScoreResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/review", tags=["review"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _get_manager_position_id(current_user: User, db: AsyncSession) -> Optional[str]:
    result = await db.execute(
        select(Employee).where(Employee.redmine_id == current_user.redmine_id)
    )
    emp = result.scalar_one_or_none()
    return emp.position_id if emp else None


def _role_ids_to_pos_ids(role_ids: list[str]) -> list[str]:
    """Конвертирует role_id ('ЦТР_НАЧ_071') → числовой pos_id ('71')."""
    result = []
    for rid in role_ids:
        info = kpi_mapping_service.get_role_info(rid)
        if info:
            result.append(str(info["pos_id"]))
    return result


async def _get_effective_subordinate_ids(current_user: User, db: AsyncSession) -> list[str]:
    """redmine_id подчинённых, чьи отчёты может проверять текущий пользователь."""
    manager_position_id = await _get_manager_position_id(current_user, db)
    if not manager_position_id:
        return []

    # get_subordinates возвращает role_ids → конвертируем в pos_ids
    subordinate_role_ids = subordination_service.get_subordinates(manager_position_id)

    # Добавить подчинённых замещаемых руководителей
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
            subordinate_role_ids.extend(
                subordination_service.get_subordinates(da.manager_position_id)
            )

    subordinate_pos_ids = _role_ids_to_pos_ids(subordinate_role_ids)
    if not subordinate_pos_ids:
        return []

    emp_result = await db.execute(
        select(Employee).where(
            Employee.position_id.in_(subordinate_pos_ids),
            Employee.is_active == True,
        )
    )
    return [e.redmine_id for e in emp_result.scalars().all()]


def _build_submission_response(sub: KpiSubmission, emp: Optional[Employee]) -> SubmissionForReview:
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
        summary_text=sub.summary_text,
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
    """Список отчётов подчинённых. По умолчанию — все кроме draft.
    Также возвращает отчёты где reviewer_redmine_id явно назначен на текущего пользователя
    (используется для тестовых submissions с self-review).
    """
    subordinate_ids = await _get_effective_subordinate_ids(current_user, db)

    query = select(KpiSubmission).where(
        or_(
            KpiSubmission.employee_redmine_id.in_(subordinate_ids) if subordinate_ids else False,
            KpiSubmission.reviewer_redmine_id == current_user.redmine_id,
        )
    )
    if period_id:
        query = query.where(KpiSubmission.period_id == period_id)
    if status:
        query = query.where(KpiSubmission.status == status)
    else:
        query = query.where(KpiSubmission.status != SubmissionStatus.draft)

    result = await db.execute(query)
    subs = result.scalars().all()
    logger.info(
        f"Review query: user={current_user.redmine_id}, status_filter={status!r}, "
        f"subordinate_ids={subordinate_ids}, found={len(subs)}, "
        f"statuses={[s.status for s in subs]}"
    )
    response = []
    for sub in subs:
        emp_res = await db.execute(
            select(Employee).where(Employee.redmine_id == sub.employee_redmine_id)
        )
        response.append(_build_submission_response(sub, emp_res.scalar_one_or_none()))
    return response


@router.get("/submissions/{submission_id}", response_model=SubmissionForReview)
async def get_submission_detail(
    submission_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    subordinate_ids = await _get_effective_subordinate_ids(current_user, db)
    result = await db.execute(
        select(KpiSubmission).where(KpiSubmission.id == submission_id)
    )
    sub = result.scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="Отчёт не найден")
    if (
        sub.employee_redmine_id not in subordinate_ids
        and sub.reviewer_redmine_id != current_user.redmine_id
    ):
        raise HTTPException(status_code=403, detail="Нет доступа к этому отчёту")

    emp_res = await db.execute(
        select(Employee).where(Employee.redmine_id == sub.employee_redmine_id)
    )
    return _build_submission_response(sub, emp_res.scalar_one_or_none())


@router.post("/submissions/{submission_id}/decide")
async def decide_submission(
    submission_id: str,
    body: ReviewDecision,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Утвердить или вернуть на доработку. При утверждении — автофинализация PDF."""
    subordinate_ids = await _get_effective_subordinate_ids(current_user, db)

    result = await db.execute(
        select(KpiSubmission).where(KpiSubmission.id == submission_id)
    )
    sub = result.scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="Отчёт не найден")
    if (
        sub.employee_redmine_id not in subordinate_ids
        and sub.reviewer_redmine_id != current_user.redmine_id
    ):
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

    # Диагностический лог финального балла
    if sub.kpi_values:
        final_score, total_w, scored_w = kpi_engine_service.compute_score_from_kpi_values(sub.kpi_values)
        logger.info(
            f"decide_submission: id={submission_id} status={sub.status} "
            f"final_score={final_score} total_weight={total_w} scored_weight={scored_w} "
            f"overrides={[(i, v.get('manager_override')) for i, v in enumerate(sub.kpi_values) if v.get('formula_type') == 'binary_auto']}"
        )

    await db.commit()

    # Автоматическая финализация при утверждении
    if body.approved:
        try:
            from app.services.report_service import report_service
            from app.services.notification_service import notification_service

            emp_res = await db.execute(
                select(Employee).where(Employee.redmine_id == sub.employee_redmine_id)
            )
            emp = emp_res.scalar_one_or_none()

            pdf_bytes = await report_service.generate_report(str(sub.id), db)
            if pdf_bytes and emp and sub.redmine_issue_id:
                await report_service.attach_to_redmine(sub, pdf_bytes, emp)
                await notification_service.notify_finance(
                    employee_full_name=emp.full_name,
                    department_name=emp.department_name or "",
                    period_name=sub.period_name,
                    redmine_issue_id=sub.redmine_issue_id,
                    redmine_url=settings.redmine_url,
                    finance_chat_ids=settings.finance_chat_ids,
                )
        except Exception as e:
            logger.error(f"Ошибка автофинализации отчёта {submission_id}: {e}")
            # Не прерываем — решение уже сохранено

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
    manager_position_id = await _get_manager_position_id(current_user, db)
    if not manager_position_id:
        return {"manager_position_id": None, "team_count": 0, "team": []}

    subordinate_pos_ids = _role_ids_to_pos_ids(
        subordination_service.get_subordinates(manager_position_id)
    )
    emp_result = await db.execute(
        select(Employee).where(
            Employee.position_id.in_(subordinate_pos_ids),
            Employee.is_active == True,
        )
    )
    team = []
    for emp in emp_result.scalars().all():
        role_info = kpi_mapping_service.get_role_info(emp.position_id) if emp.position_id else None
        team.append({
            "redmine_id": emp.redmine_id,
            "login": emp.login,
            "full_name": emp.full_name,
            "position_id": emp.position_id,
            "role_name": role_info["role"] if role_info else None,
            "department_name": emp.department_name,
        })

    return {"manager_position_id": manager_position_id, "team_count": len(team), "team": team}


# ---------------------------------------------------------------------------
# binary_manual оценка
# ---------------------------------------------------------------------------

@router.get("/{submission_id}/pending-manual", response_model=PendingManualResponse)
async def get_pending_manual(
    submission_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Список binary_manual KPI, ожидающих оценки руководителя."""
    subordinate_ids = await _get_effective_subordinate_ids(current_user, db)

    result = await db.execute(
        select(KpiSubmission).where(KpiSubmission.id == submission_id)
    )
    sub = result.scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="Отчёт не найден")
    if (
        sub.employee_redmine_id not in subordinate_ids
        and sub.reviewer_redmine_id != current_user.redmine_id
    ):
        raise HTTPException(status_code=403, detail="Нет доступа к этому отчёту")

    emp_res = await db.execute(
        select(Employee).where(Employee.redmine_id == sub.employee_redmine_id)
    )
    emp = emp_res.scalar_one_or_none()
    employee_name = emp.full_name if emp else sub.employee_login

    kpi_values: list[dict] = sub.kpi_values or []
    pending_items = []
    for idx, item in enumerate(kpi_values):
        if item.get("formula_type") == "binary_manual" and item.get("awaiting_manual_input", False):
            pending_items.append({
                "index": idx,
                "indicator": item.get("indicator", ""),
                "criterion": item.get("criterion", ""),
                "weight": item.get("weight", 0),
                "is_common": item.get("is_common", False),
            })

    return PendingManualResponse(
        submission_id=submission_id,
        employee_name=employee_name,
        pending_count=len(pending_items),
        pending_items=pending_items,
    )


@router.patch("/{submission_id}/binary-manual", response_model=ScoreResponse)
async def score_binary_manual(
    submission_id: str,
    body: BinaryManualUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Выставить оценку binary_manual KPI (0 или 100)."""
    # Проверка score
    if body.score not in (0, 100):
        raise HTTPException(status_code=422, detail="score должен быть 0 или 100")

    subordinate_ids = await _get_effective_subordinate_ids(current_user, db)

    result = await db.execute(
        select(KpiSubmission).where(KpiSubmission.id == submission_id)
    )
    sub = result.scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="Отчёт не найден")
    if (
        sub.employee_redmine_id not in subordinate_ids
        and sub.reviewer_redmine_id != current_user.redmine_id
    ):
        raise HTTPException(status_code=403, detail="Нет доступа к этому отчёту")
    if sub.status in (SubmissionStatus.approved, SubmissionStatus.rejected):
        raise HTTPException(status_code=409, detail="Отчёт уже обработан")
    if sub.status != SubmissionStatus.submitted:
        raise HTTPException(status_code=400, detail="Отчёт не находится на проверке")

    kpi_values: list[dict] = list(sub.kpi_values) if sub.kpi_values else []

    if body.kpi_index < 0 or body.kpi_index >= len(kpi_values):
        raise HTTPException(status_code=400, detail="Неверный kpi_index")

    item = kpi_values[body.kpi_index]
    if item.get("formula_type") != "binary_manual":
        raise HTTPException(status_code=400, detail="Этот KPI не является binary_manual")

    item["score"] = float(body.score)
    item["awaiting_manual_input"] = False
    item["reviewer_comment"] = body.comment
    item["reviewed_at"] = datetime.utcnow().isoformat()

    sub.kpi_values = kpi_values
    flag_modified(sub, "kpi_values")
    await db.commit()

    # Аудит
    audit = AuditLog(
        user_id=current_user.redmine_id,
        user_login=current_user.login,
        action="binary_manual_scored",
        details={
            "submission_id": submission_id,
            "kpi_index": body.kpi_index,
            "score": body.score,
            "criterion": item.get("criterion", "")[:80],
        },
    )
    db.add(audit)
    await db.commit()

    # Пересчёт partial_score
    partial_score, total_weight, scored_weight = kpi_engine_service.compute_score_from_kpi_values(
        sub.kpi_values
    )
    completion_pct = round(scored_weight / total_weight * 100, 1) if total_weight > 0 else 0.0

    return ScoreResponse(
        submission_id=submission_id,
        partial_score=partial_score,
        total_weight=total_weight,
        scored_weight=scored_weight,
        completion_pct=completion_pct,
        status=sub.status,
    )


# ---------------------------------------------------------------------------
# binary_auto override (руководитель переопределяет AI)
# ---------------------------------------------------------------------------

@router.patch("/{submission_id}/binary-auto-override", response_model=ScoreResponse)
async def override_binary_auto(
    submission_id: str,
    body: BinaryAutoOverride,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Руководитель переопределяет AI-оценку для binary_auto показателя.
    manager_override=True/False — явное решение; None — сбросить переопределение.
    """
    subordinate_ids = await _get_effective_subordinate_ids(current_user, db)

    result = await db.execute(
        select(KpiSubmission).where(KpiSubmission.id == submission_id)
    )
    sub = result.scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="Отчёт не найден")
    if (
        sub.employee_redmine_id not in subordinate_ids
        and sub.reviewer_redmine_id != current_user.redmine_id
    ):
        raise HTTPException(status_code=403, detail="Нет доступа к этому отчёту")
    if sub.status != SubmissionStatus.submitted:
        raise HTTPException(status_code=400, detail="Отчёт не находится на проверке")

    kpi_values: list[dict] = list(sub.kpi_values) if sub.kpi_values else []
    if body.kpi_index < 0 or body.kpi_index >= len(kpi_values):
        raise HTTPException(status_code=400, detail="Неверный kpi_index")

    item = kpi_values[body.kpi_index]
    if item.get("formula_type") != "binary_auto":
        raise HTTPException(status_code=400, detail="Этот KPI не является binary_auto")

    item["manager_override"] = body.manager_override
    sub.kpi_values = kpi_values
    flag_modified(sub, "kpi_values")

    db.add(AuditLog(
        user_id=current_user.redmine_id,
        user_login=current_user.login,
        action="binary_auto_override",
        details={
            "submission_id": submission_id,
            "kpi_index": body.kpi_index,
            "manager_override": body.manager_override,
            "ai_score": item.get("score"),
            "criterion": item.get("criterion", "")[:80],
        },
    ))
    await db.commit()

    partial_score, total_weight, scored_weight = kpi_engine_service.compute_score_from_kpi_values(
        sub.kpi_values
    )
    completion_pct = round(scored_weight / total_weight * 100, 1) if total_weight > 0 else 0.0

    return ScoreResponse(
        submission_id=submission_id,
        partial_score=partial_score,
        total_weight=total_weight,
        scored_weight=scored_weight,
        completion_pct=completion_pct,
        status=sub.status,
    )


# ---------------------------------------------------------------------------
# Замещение
# ---------------------------------------------------------------------------

@router.post("/deputies", response_model=DeputyAssignmentResponse)
async def create_deputy(
    body: DeputyAssignmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
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
