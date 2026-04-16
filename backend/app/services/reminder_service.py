import logging
from datetime import datetime, timezone, date
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.exc import IntegrityError

from app.models.employee import Employee, EmployeeStatus
from app.models.period import Period, PeriodStatus
from app.models.kpi_submission import KpiSubmission, SubmissionStatus
from app.models.notification import Notification, NotificationType, NotificationStatus
from app.models.user import User, UserRole
from app.services.notification_service import notification_service
from app.services.subordination_service import subordination_service

logger = logging.getLogger(__name__)


class ReminderService:

    async def run_daily_reminders(self, db: AsyncSession) -> dict:
        """
        Основная задача — запускается раз в день в 09:00 МСК.
        Проверяет все активные периоды и рассылает напоминания.
        """
        today = date.today()
        stats = {
            "date": today.isoformat(),
            "employee_reminders": 0,
            "manager_reminders": 0,
            "skipped_no_telegram": 0,
            "errors": 0,
        }

        logger.info(f"Запуск ежедневных напоминаний: {today}")

        # Получить все активные периоды
        result = await db.execute(
            select(Period).where(Period.status == PeriodStatus.active)
        )
        active_periods = result.scalars().all()

        if not active_periods:
            logger.info("Нет активных периодов — напоминания не нужны")
            return stats

        # Сотрудники без Telegram (для сводки администратору)
        missing_telegram: list[str] = []

        for period in active_periods:
            # --- Напоминания сотрудникам ---
            days_to_submit = (period.submit_deadline - today).days
            if days_to_submit in (3, 1):
                notif_type = (
                    NotificationType.employee_reminder_3d
                    if days_to_submit == 3
                    else NotificationType.employee_reminder_1d
                )
                emp_stats = await self._remind_employees(
                    db, period, notif_type, days_to_submit, missing_telegram
                )
                stats["employee_reminders"] += emp_stats["sent"]
                stats["skipped_no_telegram"] += emp_stats["skipped"]
                stats["errors"] += emp_stats["errors"]

            # --- Напоминания руководителям ---
            days_to_review = (period.review_deadline - today).days
            if days_to_review in (3, 1):
                notif_type = (
                    NotificationType.manager_reminder_3d
                    if days_to_review == 3
                    else NotificationType.manager_reminder_1d
                )
                mgr_stats = await self._remind_managers(
                    db, period, notif_type, days_to_review, missing_telegram
                )
                stats["manager_reminders"] += mgr_stats["sent"]
                stats["skipped_no_telegram"] += mgr_stats["skipped"]
                stats["errors"] += mgr_stats["errors"]

        # Уведомить администратора о сотрудниках без Telegram
        if missing_telegram:
            await self._notify_admin_missing_telegram(db, missing_telegram)

        logger.info(
            f"Напоминания завершены: "
            f"сотрудники={stats['employee_reminders']}, "
            f"руководители={stats['manager_reminders']}, "
            f"без TG={stats['skipped_no_telegram']}"
        )
        return stats

    async def _remind_employees(
        self,
        db: AsyncSession,
        period: Period,
        notif_type: NotificationType,
        days_left: int,
        missing_telegram: list[str],
    ) -> dict:
        """Напоминания всем сотрудникам у которых нет отправленного отчёта."""
        stats = {"sent": 0, "skipped": 0, "errors": 0}

        # Все активные сотрудники
        emp_result = await db.execute(
            select(Employee).where(Employee.status == EmployeeStatus.active)
        )
        employees = emp_result.scalars().all()

        # Submissions за этот период
        sub_result = await db.execute(
            select(KpiSubmission).where(KpiSubmission.period_id == period.id)
        )
        submissions = {s.employee_redmine_id: s for s in sub_result.scalars().all()}

        for emp in employees:
            sub = submissions.get(emp.redmine_id)

            # Пропустить если отчёт уже отправлен/утверждён
            if sub and sub.status in [
                SubmissionStatus.submitted,
                SubmissionStatus.approved,
            ]:
                continue

            text = self._build_employee_text(emp, period, days_left)
            result = await self._send_notification(
                db=db,
                recipient=emp,
                notif_type=notif_type,
                text=text,
                period=period,
                submission_id=str(sub.id) if sub else None,
                missing_telegram=missing_telegram,
            )
            if result == "sent":
                stats["sent"] += 1
            elif result == "skipped":
                stats["skipped"] += 1
            elif result == "error":
                stats["errors"] += 1

        return stats

    async def _remind_managers(
        self,
        db: AsyncSession,
        period: Period,
        notif_type: NotificationType,
        days_left: int,
        missing_telegram: list[str],
    ) -> dict:
        """Напоминания руководителям у которых есть непроверенные отчёты."""
        stats = {"sent": 0, "skipped": 0, "errors": 0}

        # Все submitted отчёты за период
        sub_result = await db.execute(
            select(KpiSubmission).where(
                and_(
                    KpiSubmission.period_id == period.id,
                    KpiSubmission.status == SubmissionStatus.submitted,
                )
            )
        )
        pending_submissions = sub_result.scalars().all()

        if not pending_submissions:
            return stats

        # Для каждого сотрудника найти его руководителя через subordination
        manager_to_subordinates: dict[str, list[str]] = {}

        for sub in pending_submissions:
            emp_result = await db.execute(
                select(Employee).where(Employee.redmine_id == sub.employee_redmine_id)
            )
            emp = emp_result.scalar_one_or_none()
            if not emp or not emp.position_id:
                continue

            evaluator_pos = subordination_service.get_evaluator_position(emp.position_id)
            if not evaluator_pos:
                continue

            if evaluator_pos not in manager_to_subordinates:
                manager_to_subordinates[evaluator_pos] = []
            manager_to_subordinates[evaluator_pos].append(emp.full_name)

        # Найти сотрудников с этими position_id (руководителей)
        for manager_pos_id, subordinate_names in manager_to_subordinates.items():
            mgr_result = await db.execute(
                select(Employee).where(
                    and_(
                        Employee.position_id == manager_pos_id,
                        Employee.is_active == True,
                    )
                )
            )
            manager = mgr_result.scalar_one_or_none()
            if not manager:
                logger.warning(
                    f"Руководитель с position_id={manager_pos_id} не найден в employees"
                )
                continue

            text = self._build_manager_text(manager, period, days_left, subordinate_names)
            result = await self._send_notification(
                db=db,
                recipient=manager,
                notif_type=notif_type,
                text=text,
                period=period,
                missing_telegram=missing_telegram,
            )
            if result == "sent":
                stats["sent"] += 1
            elif result == "skipped":
                stats["skipped"] += 1
            elif result == "error":
                stats["errors"] += 1

        return stats

    async def _send_notification(
        self,
        db: AsyncSession,
        recipient: Employee,
        notif_type: NotificationType,
        text: str,
        period: Period,
        submission_id: Optional[str] = None,
        missing_telegram: Optional[list] = None,
    ) -> str:
        """
        Отправляет одно уведомление.
        Возвращает: "sent" | "skipped" | "error" | "duplicate"
        """
        today = date.today()
        dedup_key = f"{notif_type}:{recipient.redmine_id}:{period.id}:{today}"

        # Проверить дедупликацию
        existing = await db.execute(
            select(Notification).where(Notification.dedup_key == dedup_key)
        )
        if existing.scalar_one_or_none():
            return "duplicate"

        # Нет Telegram ID
        if not recipient.telegram_id:
            logger.warning(
                f"Нет telegram_id для {recipient.login} ({recipient.full_name}) "
                f"— уведомление пропущено"
            )
            if missing_telegram is not None:
                missing_telegram.append(f"{recipient.full_name} ({recipient.login})")

            notif = Notification(
                recipient_redmine_id=recipient.redmine_id,
                recipient_login=recipient.login,
                recipient_telegram_id=None,
                notification_type=notif_type,
                text=text,
                period_id=str(period.id),
                period_name=period.name,
                submission_id=submission_id,
                status=NotificationStatus.skipped,
                error_message="Нет telegram_id",
                dedup_key=dedup_key,
            )
            db.add(notif)
            try:
                await db.commit()
            except IntegrityError:
                await db.rollback()
            return "skipped"

        # Отправить
        success = await notification_service.send_telegram(recipient.telegram_id, text)

        notif = Notification(
            recipient_redmine_id=recipient.redmine_id,
            recipient_login=recipient.login,
            recipient_telegram_id=recipient.telegram_id,
            notification_type=notif_type,
            text=text,
            period_id=str(period.id),
            period_name=period.name,
            submission_id=submission_id,
            status=NotificationStatus.sent if success else NotificationStatus.failed,
            error_message=None if success else "Ошибка отправки Telegram",
            dedup_key=dedup_key,
            sent_at=datetime.now(timezone.utc) if success else None,
        )
        db.add(notif)
        try:
            await db.commit()
        except IntegrityError:
            await db.rollback()

        return "sent" if success else "error"

    async def _notify_admin_missing_telegram(
        self, db: AsyncSession, missing: list[str]
    ) -> None:
        """Отправляет администратору сводку о сотрудниках без Telegram."""
        result = await db.execute(
            select(Employee).where(
                and_(
                    Employee.redmine_id.in_(
                        select(User.redmine_id).where(User.role == UserRole.admin)
                    ),
                    Employee.is_active == True,
                )
            )
        )
        admins = result.scalars().all()

        if not admins:
            logger.warning("Нет администраторов с telegram_id для отправки сводки")
            return

        names_list = "\n".join(f"• {name}" for name in missing[:30])
        if len(missing) > 30:
            names_list += f"\n... и ещё {len(missing) - 30}"

        text = (
            f"⚠️ <b>Сотрудники без Telegram ID</b>\n\n"
            f"Следующим сотрудникам не отправлены напоминания KPI, "
            f"так как у них не указан Telegram ID:\n\n"
            f"{names_list}\n\n"
            f"Добавьте Telegram ID в кастомное поле CF3 в Redmine."
        )

        for admin in admins:
            if admin.telegram_id:
                await notification_service.send_telegram(admin.telegram_id, text)
                logger.info(f"Сводка отправлена администратору {admin.login}")

    def _build_employee_text(
        self, emp: Employee, period: Period, days_left: int
    ) -> str:
        days_word = "дня" if days_left in (2, 3, 4) else "день" if days_left == 1 else "дней"
        return (
            f"⏰ <b>Напоминание: KPI-отчёт</b>\n\n"
            f"Здравствуйте, {emp.firstname}!\n\n"
            f"До дедлайна сдачи KPI-отчёта осталось "
            f"<b>{days_left} {days_word}</b>.\n\n"
            f"📅 Период: {period.name}\n"
            f"📌 Срок сдачи: {period.submit_deadline.strftime('%d.%m.%Y')}\n\n"
            f"Пожалуйста, заполните и отправьте отчёт в KPI Портале."
        )

    def _build_manager_text(
        self,
        manager: Employee,
        period: Period,
        days_left: int,
        subordinate_names: list[str],
    ) -> str:
        days_word = "дня" if days_left in (2, 3, 4) else "день" if days_left == 1 else "дней"
        names_list = "\n".join(f"• {name}" for name in subordinate_names)
        return (
            f"⏰ <b>Напоминание: проверка KPI-отчётов</b>\n\n"
            f"Здравствуйте, {manager.firstname}!\n\n"
            f"До дедлайна проверки KPI-отчётов осталось "
            f"<b>{days_left} {days_word}</b>.\n\n"
            f"📅 Период: {period.name}\n"
            f"📌 Срок проверки: {period.review_deadline.strftime('%d.%m.%Y')}\n\n"
            f"Ожидают вашей проверки:\n{names_list}\n\n"
            f"Откройте KPI Портал для проверки и утверждения отчётов."
        )


reminder_service = ReminderService()
