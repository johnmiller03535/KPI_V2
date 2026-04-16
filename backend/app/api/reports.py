import io
import logging
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.core.deps import get_current_user
from app.config import settings
from app.models.user import User
from app.models.kpi_submission import KpiSubmission, SubmissionStatus
from app.models.employee import Employee
from app.services.report_service import report_service
from app.services.notification_service import notification_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/reports", tags=["reports"])


def _pdf_filename(sub: KpiSubmission, emp: Employee | None) -> str:
    lastname = emp.lastname if emp else sub.employee_login
    period = sub.period_name.replace(" ", "_")
    return f"KPI_{lastname}_{period}.pdf"


@router.get("/{submission_id}/pdf")
async def download_pdf(
    submission_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Скачать PDF-отчёт.
    Доступен: сам сотрудник, manager, admin, finance.
    """
    result = await db.execute(
        select(KpiSubmission).where(KpiSubmission.id == submission_id)
    )
    sub = result.scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="Отчёт не найден")

    is_owner = sub.employee_redmine_id == current_user.redmine_id
    is_privileged = current_user.role in ("admin", "finance", "manager")
    if not is_owner and not is_privileged:
        raise HTTPException(status_code=403, detail="Нет доступа")

    pdf_bytes = await report_service.generate_report(submission_id, db)
    if not pdf_bytes:
        raise HTTPException(status_code=500, detail="Ошибка генерации PDF")

    emp_res = await db.execute(
        select(Employee).where(Employee.redmine_id == sub.employee_redmine_id)
    )
    emp = emp_res.scalar_one_or_none()
    filename = _pdf_filename(sub, emp)

    filename_encoded = quote(filename)
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{filename_encoded}"},
    )


@router.post("/{submission_id}/finalize")
async def finalize_report(
    submission_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Ручная финализация утверждённого отчёта:
    1. Генерация PDF
    2. Прикрепление к задаче Redmine
    3. Telegram-уведомление финансового блока

    Может вызываться admin-ом при ошибке авто-финализации.
    """
    if current_user.role not in ("admin", "manager"):
        raise HTTPException(status_code=403, detail="Только admin или manager")

    result = await db.execute(
        select(KpiSubmission).where(KpiSubmission.id == submission_id)
    )
    sub = result.scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="Отчёт не найден")

    if sub.status != SubmissionStatus.approved:
        raise HTTPException(
            status_code=400,
            detail=f"Отчёт должен быть approved (текущий: {sub.status})",
        )

    emp_res = await db.execute(
        select(Employee).where(Employee.redmine_id == sub.employee_redmine_id)
    )
    emp = emp_res.scalar_one_or_none()

    # Шаг 1: PDF
    pdf_bytes = await report_service.generate_report(submission_id, db)
    if not pdf_bytes:
        raise HTTPException(status_code=500, detail="Ошибка генерации PDF")

    # Шаг 2: Redmine
    redmine_attached = False
    if sub.redmine_issue_id and emp:
        redmine_attached = await report_service.attach_to_redmine(sub, pdf_bytes, emp)

    # Шаг 3: Telegram
    notified = 0
    if emp and sub.redmine_issue_id:
        notified = await notification_service.notify_finance(
            employee_full_name=emp.full_name,
            department_name=emp.department_name or "",
            period_name=sub.period_name,
            redmine_issue_id=sub.redmine_issue_id,
            redmine_url=settings.redmine_url,
            finance_chat_ids=settings.finance_chat_ids,
        )

    return {
        "submission_id": submission_id,
        "employee":       emp.full_name if emp else sub.employee_login,
        "period":         sub.period_name,
        "pdf_generated":  True,
        "pdf_size_bytes": len(pdf_bytes),
        "redmine_attached": redmine_attached,
        "notifications_sent": notified,
    }
