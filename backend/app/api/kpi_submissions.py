import logging
from datetime import datetime, timezone
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm.attributes import flag_modified

from app.database import get_db
from app.core.deps import get_current_user
from app.core.redmine import redmine_client
from app.models.user import User
from app.models.kpi_submission import KpiSubmission, SubmissionStatus
from app.models.employee import Employee
from app.services.kpi_mapping_service import kpi_mapping_service
from app.services.kpi_engine_service import kpi_engine_service
from app.services.threshold_parser import ThresholdRule, apply_threshold
from app.schemas.kpi import KpiEngineResult
from app.schemas.kpi_submission import (
    SubmissionResponse,
    SubmissionNumericUpdate, ScoreResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/submissions", tags=["submissions"])


def _to_response(s: KpiSubmission) -> SubmissionResponse:
    return SubmissionResponse(
        id=str(s.id),
        employee_redmine_id=s.employee_redmine_id,
        employee_login=s.employee_login,
        period_id=str(s.period_id),
        period_name=s.period_name,
        position_id=s.position_id,
        redmine_issue_id=s.redmine_issue_id,
        status=s.status,
        bin_discipline_summary=s.bin_discipline_summary,
        bin_schedule_summary=s.bin_schedule_summary,
        bin_safety_summary=s.bin_safety_summary,
        kpi_values=s.kpi_values,
        ai_generated_at=s.ai_generated_at,
        reviewer_comment=s.reviewer_comment,
        submitted_at=s.submitted_at,
        created_at=s.created_at,
    )


@router.get("/my", response_model=list[SubmissionResponse])
async def get_my_submissions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    period_id: Optional[str] = Query(None),
):
    """Мои KPI-отчёты (все или за конкретный период)."""
    query = select(KpiSubmission).where(
        KpiSubmission.employee_redmine_id == current_user.redmine_id
    )
    if period_id:
        query = query.where(KpiSubmission.period_id == period_id)
    result = await db.execute(query)
    return [_to_response(s) for s in result.scalars().all()]


@router.get("/my/{submission_id}", response_model=SubmissionResponse)
async def get_my_submission(
    submission_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Получить конкретный KPI-отчёт."""
    result = await db.execute(
        select(KpiSubmission).where(
            KpiSubmission.id == submission_id,
            KpiSubmission.employee_redmine_id == current_user.redmine_id,
        )
    )
    sub = result.scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="Отчёт не найден")
    return _to_response(sub)


@router.post("/my/{submission_id}/generate-summary", response_model=KpiEngineResult)
async def generate_ai_summary(
    submission_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Запускает полную AI-обработку KPI-отчёта:
    - Получает трудозатраты из Redmine
    - Параллельно оценивает binary_auto KPI через AI
    - Размечает binary_manual и numeric KPI
    - Сохраняет результаты в submission.kpi_values
    """
    # Проверяем права доступа
    result = await db.execute(
        select(KpiSubmission).where(
            KpiSubmission.id == submission_id,
            KpiSubmission.employee_redmine_id == current_user.redmine_id,
        )
    )
    sub = result.scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="Отчёт не найден")
    if sub.status not in [SubmissionStatus.draft, SubmissionStatus.rejected]:
        raise HTTPException(status_code=400, detail="Нельзя редактировать отчёт в текущем статусе")

    return await kpi_engine_service.process_submission(submission_id, db)


@router.get("/my/{submission_id}/score", response_model=ScoreResponse)
async def get_submission_score(
    submission_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Возвращает текущий partial_score из сохранённых kpi_values."""
    result = await db.execute(
        select(KpiSubmission).where(
            KpiSubmission.id == submission_id,
            KpiSubmission.employee_redmine_id == current_user.redmine_id,
        )
    )
    sub = result.scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="Отчёт не найден")

    if not sub.kpi_values:
        return ScoreResponse(
            submission_id=submission_id,
            partial_score=None,
            total_weight=0,
            scored_weight=0,
            completion_pct=0.0,
            status=sub.status,
        )

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


@router.patch("/my/{submission_id}", response_model=SubmissionResponse)
async def update_submission_draft(
    submission_id: str,
    body: SubmissionNumericUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Обновляет числовые факты и manual-оценки в kpi_values, пересчитывает partial_score.

    Тело:
    {
      "numeric_values": {"<criterion>": {"fact_value": 92.5}},
      "binary_manual_overrides": {"<criterion>": {"score": 100, "note": "..."}}
    }
    """
    result = await db.execute(
        select(KpiSubmission).where(
            KpiSubmission.id == submission_id,
            KpiSubmission.employee_redmine_id == current_user.redmine_id,
        )
    )
    sub = result.scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="Отчёт не найден")
    if sub.status not in [SubmissionStatus.draft, SubmissionStatus.rejected]:
        raise HTTPException(status_code=400, detail="Нельзя редактировать в текущем статусе")

    kpi_values: list[dict] = list(sub.kpi_values) if sub.kpi_values else []

    # Применяем числовые значения
    if body.numeric_values:
        for item in kpi_values:
            criterion = item.get("criterion", "")
            if criterion in body.numeric_values:
                fact_input = body.numeric_values[criterion]
                fact_value = fact_input.fact_value
                item["fact_value"] = fact_value
                item["requires_fact_input"] = False

                # Вычисляем score через ThresholdParser (из сохранённых parsed_thresholds)
                try:
                    raw_rules = item.get("parsed_thresholds") or []
                    rules = [ThresholdRule(**r) for r in raw_rules]
                    if rules:
                        item["score"] = apply_threshold(fact_value, rules)
                    else:
                        item["score"] = None
                except Exception as e:
                    logger.warning(f"Ошибка расчёта порога для '{criterion[:40]}': {e}")
                    item["score"] = None

    # Применяем manual-оценки
    if body.binary_manual_overrides:
        for item in kpi_values:
            criterion = item.get("criterion", "")
            if criterion in body.binary_manual_overrides:
                override = body.binary_manual_overrides[criterion]
                if override.score is not None:
                    item["score"] = override.score
                    item["awaiting_manual_input"] = False
                if override.note is not None:
                    item["summary"] = override.note

    sub.kpi_values = kpi_values
    flag_modified(sub, "kpi_values")
    await db.commit()
    await db.refresh(sub)
    return _to_response(sub)


@router.post("/my/{submission_id}/submit", response_model=SubmissionResponse)
async def submit_for_review(
    submission_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Отправить отчёт на проверку руководителю."""
    result = await db.execute(
        select(KpiSubmission).where(
            KpiSubmission.id == submission_id,
            KpiSubmission.employee_redmine_id == current_user.redmine_id,
        )
    )
    sub = result.scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="Отчёт не найден")
    if sub.status not in [SubmissionStatus.draft, SubmissionStatus.rejected]:
        raise HTTPException(status_code=400, detail="Отчёт уже отправлен")

    sub.status = SubmissionStatus.submitted
    sub.submitted_at = datetime.now(timezone.utc)

    # Обновить статус задачи в Redmine если есть
    # status_id=26 — "На проверку" (из старого проекта)
    if sub.redmine_issue_id:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                await client.put(
                    f"{redmine_client.base_url}/issues/{sub.redmine_issue_id}.json",
                    headers={**redmine_client._headers(), "Content-Type": "application/json"},
                    json={"issue": {"status_id": 26}},
                )
        except Exception as e:
            logger.warning(f"Не удалось обновить статус задачи Redmine {sub.redmine_issue_id}: {e}")

    await db.commit()
    await db.refresh(sub)

    # Уведомить руководителя в Telegram
    try:
        await _notify_manager_about_submission(sub, current_user, db)
    except Exception as e:
        logger.error(f"Ошибка уведомления руководителя: {e}")

    return _to_response(sub)


async def _notify_manager_about_submission(
    sub: KpiSubmission,
    employee_user,
    db,
) -> None:
    """Отправляет руководителю уведомление с кнопками approve/reject."""
    from app.services.subordination_service import subordination_service
    from app.services.kpi_mapping_service import kpi_mapping_service
    from app.bot.bot import get_bot
    from app.bot.keyboards import review_keyboard
    from app.config import settings

    if not settings.telegram_bot_token:
        return
    bot = get_bot()
    if not bot:
        return

    # Найти сотрудника
    emp_result = await db.execute(
        select(Employee).where(Employee.redmine_id == employee_user.redmine_id)
    )
    emp = emp_result.scalar_one_or_none()
    if not emp or not emp.position_id:
        return

    # Найти руководителя через subordination
    evaluator_pos = subordination_service.get_evaluator_position(emp.position_id)
    if not evaluator_pos:
        return

    mgr_result = await db.execute(
        select(Employee).where(
            Employee.position_id == evaluator_pos,
            Employee.is_active == True,
        )
    )
    manager = mgr_result.scalar_one_or_none()
    if not manager or not manager.telegram_id:
        logger.warning(
            f"Руководитель {evaluator_pos} не найден или нет telegram_id"
        )
        return

    # Название должности сотрудника
    role_info = kpi_mapping_service.get_role_info(emp.position_id)
    role_name = role_info["role"] if role_info else emp.position_id

    text = (
        f"📋 <b>Новый KPI-отчёт на проверку</b>\n\n"
        f"👤 Сотрудник: <b>{emp.full_name}</b>\n"
        f"💼 Должность: {role_name}\n"
        f"📅 Период: {sub.period_name}\n\n"
        f"Выберите действие или откройте портал для детального просмотра."
    )

    await bot.send_message(
        chat_id=manager.telegram_id,
        text=text,
        reply_markup=review_keyboard(str(sub.id)),
    )
    logger.info(
        f"Уведомление отправлено руководителю {manager.login} "
        f"об отчёте {emp.login} за {sub.period_name}"
    )


@router.get("/my/{submission_id}/kpi-structure")
async def get_kpi_structure(
    submission_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Возвращает KPI-структуру для должности сотрудника (три группы)."""
    result = await db.execute(
        select(KpiSubmission).where(
            KpiSubmission.id == submission_id,
            KpiSubmission.employee_redmine_id == current_user.redmine_id,
        )
    )
    sub = result.scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="Отчёт не найден")

    pos_id = sub.position_id
    if not pos_id:
        from app.schemas.kpi import KpiStructure
        return {**KpiStructure(
            role_id="", binary_auto=[], binary_manual=[], numeric=[], total_weight=0
        ).model_dump(), "role_info": None}

    structure = kpi_mapping_service.get_kpi_structure_by_pos_id(pos_id)
    role_info = kpi_mapping_service.get_role_info(pos_id)

    return {
        **structure.model_dump(),
        "role_info": role_info,
    }
