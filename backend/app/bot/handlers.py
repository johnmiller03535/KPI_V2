import logging
from datetime import datetime, timezone
from aiogram import Router, F
from aiogram.types import Message, CallbackQuery
from aiogram.filters import CommandStart, Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from sqlalchemy import select, and_

from app.database import AsyncSessionLocal
from app.models.employee import Employee
from app.models.kpi_submission import KpiSubmission, SubmissionStatus
from app.bot.keyboards import review_keyboard, already_decided_keyboard

logger = logging.getLogger(__name__)
router = Router()


class RejectStates(StatesGroup):
    """FSM: ожидание комментария при возврате отчёта."""
    waiting_comment = State()


async def get_employee_by_telegram(telegram_id: str) -> Employee | None:
    """Найти сотрудника по telegram_id."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Employee).where(
                and_(
                    Employee.telegram_id == telegram_id,
                    Employee.is_active == True,
                )
            )
        )
        return result.scalar_one_or_none()


@router.message(CommandStart())
async def cmd_start(message: Message):
    """Приветствие и идентификация."""
    telegram_id = str(message.from_user.id)
    employee = await get_employee_by_telegram(telegram_id)

    if not employee:
        await message.answer(
            "👋 Добро пожаловать в KPI Портал!\n\n"
            "⚠️ Ваш Telegram ID не привязан к учётной записи.\n"
            "Обратитесь к администратору для настройки."
        )
        return

    await message.answer(
        f"👋 Здравствуйте, <b>{employee.firstname} {employee.lastname}</b>!\n\n"
        f"🏢 {employee.department_name or 'Подразделение не указано'}\n\n"
        f"Этот бот отправляет уведомления о KPI-отчётах "
        f"и позволяет утверждать их прямо из Telegram.\n\n"
        f"🌐 Полный интерфейс: /portal"
    )


@router.message(Command("portal"))
async def cmd_portal(message: Message):
    """Ссылка на веб-портал."""
    await message.answer(
        "🌐 <b>KPI Портал</b>\n\n"
        "Для полного управления KPI-отчётами откройте веб-портал.\n\n"
        "https://kpi.amvera.io"
    )


@router.message(Command("pending"))
async def cmd_pending(message: Message):
    """Список отчётов ожидающих проверки."""
    telegram_id = str(message.from_user.id)
    employee = await get_employee_by_telegram(telegram_id)

    if not employee:
        await message.answer("⚠️ Ваш аккаунт не найден. Обратитесь к администратору.")
        return

    async with AsyncSessionLocal() as db:
        from app.services.subordination_service import subordination_service
        subordinate_positions = subordination_service.get_subordinates(
            employee.position_id or ""
        )

        if not subordinate_positions:
            await message.answer(
                "У вас нет подчинённых сотрудников в системе KPI."
            )
            return

        emp_result = await db.execute(
            select(Employee).where(
                and_(
                    Employee.position_id.in_(subordinate_positions),
                    Employee.is_active == True,
                )
            )
        )
        subordinates = emp_result.scalars().all()
        sub_ids = [e.redmine_id for e in subordinates]

        if not sub_ids:
            await message.answer("Нет сотрудников для проверки.")
            return

        sub_result = await db.execute(
            select(KpiSubmission).where(
                and_(
                    KpiSubmission.employee_redmine_id.in_(sub_ids),
                    KpiSubmission.status == SubmissionStatus.submitted,
                )
            )
        )
        submissions = sub_result.scalars().all()

    if not submissions:
        await message.answer(
            "✅ Нет отчётов, ожидающих проверки."
        )
        return

    await message.answer(
        f"📋 <b>Отчёты, ожидающие проверки: {len(submissions)}</b>\n\n"
        "Используйте кнопки в уведомлениях для утверждения "
        "или откройте портал для детального просмотра."
    )


# --- Callback handlers ---

@router.callback_query(F.data.startswith("approve:"))
async def callback_approve(callback: CallbackQuery):
    """Утвердить отчёт."""
    submission_id = callback.data.split(":", 1)[1]
    telegram_id = str(callback.from_user.id)

    employee = await get_employee_by_telegram(telegram_id)
    if not employee:
        await callback.answer("⚠️ Аккаунт не найден", show_alert=True)
        return

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(KpiSubmission).where(KpiSubmission.id == submission_id)
        )
        sub = result.scalar_one_or_none()

        if not sub:
            await callback.answer("❌ Отчёт не найден", show_alert=True)
            return

        if sub.status != SubmissionStatus.submitted:
            await callback.message.edit_reply_markup(
                reply_markup=already_decided_keyboard()
            )
            await callback.answer(
                f"Решение уже принято: {sub.status}", show_alert=True
            )
            return

        # Утвердить
        sub.status = SubmissionStatus.approved
        sub.reviewer_redmine_id = employee.redmine_id
        sub.reviewer_login = employee.login
        sub.reviewer_comment = "Утверждено через Telegram"
        sub.reviewed_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(sub)

        # Автофинализация — генерация PDF + Redmine + TG уведомление
        try:
            from app.services.report_service import report_service
            from app.services.notification_service import notification_service
            from app.config import settings

            emp_result = await db.execute(
                select(Employee).where(Employee.redmine_id == sub.employee_redmine_id)
            )
            emp = emp_result.scalar_one_or_none()

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
            logger.error(f"Автофинализация после approve через TG: {e}")

    await callback.message.edit_text(
        callback.message.text + "\n\n✅ <b>Утверждено</b>",
        reply_markup=already_decided_keyboard(),
    )
    await callback.answer("✅ Отчёт утверждён!")


@router.callback_query(F.data.startswith("reject_start:"))
async def callback_reject_start(callback: CallbackQuery, state: FSMContext):
    """Начало процесса возврата — запрос комментария."""
    submission_id = callback.data.split(":", 1)[1]

    await state.update_data(submission_id=submission_id, message_id=callback.message.message_id)
    await state.set_state(RejectStates.waiting_comment)

    await callback.message.answer(
        "↩️ <b>Возврат на доработку</b>\n\n"
        "Напишите комментарий для сотрудника (причина возврата):\n\n"
        "<i>Или отправьте /cancel для отмены</i>"
    )
    await callback.answer()


@router.message(RejectStates.waiting_comment)
async def process_reject_comment(message: Message, state: FSMContext):
    """Обработка комментария и возврат отчёта."""
    comment = message.text.strip()

    if not comment:
        await message.answer("Комментарий не может быть пустым. Попробуйте ещё раз.")
        return

    telegram_id = str(message.from_user.id)
    employee = await get_employee_by_telegram(telegram_id)
    if not employee:
        await state.clear()
        await message.answer("⚠️ Аккаунт не найден.")
        return

    data = await state.get_data()
    submission_id = data.get("submission_id")

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(KpiSubmission).where(KpiSubmission.id == submission_id)
        )
        sub = result.scalar_one_or_none()

        if not sub or sub.status != SubmissionStatus.submitted:
            await state.clear()
            await message.answer("❌ Отчёт не найден или уже обработан.")
            return

        sub.status = SubmissionStatus.rejected
        sub.reviewer_redmine_id = employee.redmine_id
        sub.reviewer_login = employee.login
        sub.reviewer_comment = comment
        sub.reviewed_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(sub)

        # Уведомить сотрудника о возврате
        try:
            emp_result = await db.execute(
                select(Employee).where(Employee.redmine_id == sub.employee_redmine_id)
            )
            emp = emp_result.scalar_one_or_none()
            if emp and emp.telegram_id:
                from app.bot.bot import get_bot
                _bot = get_bot()
                if not _bot:
                    return
                await _bot.send_message(
                    chat_id=emp.telegram_id,
                    text=(
                        f"↩️ <b>Отчёт возвращён на доработку</b>\n\n"
                        f"Период: {sub.period_name}\n\n"
                        f"💬 Комментарий руководителя:\n"
                        f"<i>{comment}</i>\n\n"
                        f"Пожалуйста, внесите исправления и отправьте повторно."
                    )
                )
        except Exception as e:
            logger.error(f"Ошибка уведомления сотрудника о возврате: {e}")

    await state.clear()
    await message.answer(
        f"↩️ <b>Отчёт возвращён на доработку</b>\n\n"
        f"Комментарий отправлен сотруднику."
    )


@router.message(Command("cancel"))
@router.message(F.text == "/cancel")
async def cmd_cancel(message: Message, state: FSMContext):
    """Отмена текущего действия."""
    current_state = await state.get_state()
    if current_state:
        await state.clear()
        await message.answer("❌ Действие отменено.")
    else:
        await message.answer("Нет активного действия для отмены.")
