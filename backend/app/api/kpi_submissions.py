import json
import logging
from datetime import datetime, timezone
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.core.deps import get_current_user
from app.core.redmine import redmine_client
from app.models.user import User
from app.models.kpi_submission import KpiSubmission, SubmissionStatus
from app.models.period import Period
from app.models.employee import Employee
from app.services.ai_service import ai_service
from app.services.kpi_mapping_service import kpi_mapping_service
from app.schemas.kpi_submission import (
    SubmissionDraftUpdate, SubmissionResponse, AISummaryResponse,
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


@router.post("/my/{submission_id}/generate-summary", response_model=AISummaryResponse)
async def generate_ai_summary(
    submission_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Запрашивает трудозатраты из Redmine и генерирует AI-саммари через Claude API.
    Сохраняет результат в submission.
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
        raise HTTPException(status_code=400, detail="Нельзя редактировать отчёт в текущем статусе")

    # Получить период
    period_result = await db.execute(select(Period).where(Period.id == sub.period_id))
    period = period_result.scalar_one_or_none()
    if not period:
        raise HTTPException(status_code=404, detail="Период не найден")

    # Получить трудозатраты из Redmine
    time_entries = await redmine_client.get_time_entries(
        user_id=int(current_user.redmine_id),
        date_from=str(period.date_start),
        date_to=str(period.date_end),
    )

    # Получить KPI-критерии для должности
    binary_criteria = []
    if sub.position_id:
        binary_criteria = kpi_mapping_service.get_binary_auto_criteria(sub.position_id)

    # Если критериев нет — используем стандартные
    if not binary_criteria:
        binary_criteria = [
            "Выполнение должностных обязанностей",
            "Исполнение поручений руководства",
        ]

    # Получить имя сотрудника
    emp_result = await db.execute(
        select(Employee).where(Employee.redmine_id == current_user.redmine_id)
    )
    employee = emp_result.scalar_one_or_none()
    employee_name = employee.full_name if employee else current_user.login

    # Генерация AI-саммари
    ai_result = await ai_service.summarize_time_entries(
        employee_name=employee_name,
        period_name=period.name,
        time_entries=time_entries,
        kpi_criteria=binary_criteria,
    )

    if not ai_result:
        raise HTTPException(status_code=500, detail="Ошибка генерации AI-саммари")

    # Сохранить в submission
    sub.ai_raw_summary = json.dumps(ai_result, ensure_ascii=False)
    sub.ai_generated_at = datetime.now(timezone.utc)

    # Заполнить discipline_summary из AI если поле пустое
    if not sub.bin_discipline_summary:
        sub.bin_discipline_summary = ai_result.get("discipline_summary", "")

    await db.commit()

    return AISummaryResponse(
        criteria=ai_result.get("criteria", {}),
        general_summary=ai_result.get("general_summary", ""),
        discipline_summary=ai_result.get("discipline_summary", ""),
        time_entries_count=len(time_entries),
    )


@router.patch("/my/{submission_id}", response_model=SubmissionResponse)
async def update_submission_draft(
    submission_id: str,
    body: SubmissionDraftUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Сохранить черновик KPI-отчёта (частичное обновление)."""
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

    if body.bin_discipline_summary is not None:
        sub.bin_discipline_summary = body.bin_discipline_summary
    if body.bin_schedule_summary is not None:
        sub.bin_schedule_summary = body.bin_schedule_summary
    if body.bin_safety_summary is not None:
        sub.bin_safety_summary = body.bin_safety_summary
    if body.kpi_values is not None:
        sub.kpi_values = [v.model_dump() for v in body.kpi_values]

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
    from app.bot.bot import bot
    from app.bot.keyboards import review_keyboard
    from app.config import settings

    if not settings.telegram_bot_token:
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
    """Возвращает KPI-структуру для должности сотрудника из KPI_Mapping.xlsx."""
    result = await db.execute(
        select(KpiSubmission).where(
            KpiSubmission.id == submission_id,
            KpiSubmission.employee_redmine_id == current_user.redmine_id,
        )
    )
    sub = result.scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="Отчёт не найден")

    position_id = sub.position_id
    if not position_id:
        return {"position_id": None, "role_info": None, "kpi_items": [], "numeric_kpis": [], "binary_auto_criteria": []}

    role_info = kpi_mapping_service.get_role_info(position_id)
    all_kpis = kpi_mapping_service.get_kpi_for_role(position_id)
    numeric_kpis = kpi_mapping_service.get_numeric_kpis(position_id)
    binary_criteria = kpi_mapping_service.get_binary_auto_criteria(position_id)

    return {
        "position_id": position_id,
        "role_info": role_info,
        "kpi_items": all_kpis,
        "numeric_kpis": numeric_kpis,
        "binary_auto_criteria": binary_criteria,
    }
