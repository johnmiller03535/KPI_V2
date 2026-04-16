import logging
import httpx
from app.config import settings

logger = logging.getLogger(__name__)


class NotificationService:

    async def send_telegram(self, chat_id: str, text: str) -> bool:
        """Отправляет сообщение в Telegram."""
        if not settings.telegram_bot_token:
            logger.warning("TELEGRAM_BOT_TOKEN не задан — уведомление пропущено")
            return False

        url = f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage"
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                resp = await client.post(url, json={
                    "chat_id": chat_id,
                    "text": text,
                    "parse_mode": "HTML",
                    "disable_web_page_preview": True,
                })
                if resp.status_code == 200:
                    return True
                logger.error(f"Telegram error {resp.status_code}: {resp.text[:200]}")
                return False
            except httpx.RequestError as e:
                logger.error(f"Telegram request error: {e}")
                return False

    async def notify_finance(
        self,
        employee_full_name: str,
        department_name: str,
        period_name: str,
        redmine_issue_id: int,
        redmine_url: str,
        finance_chat_ids: list[str],
    ) -> int:
        """
        Уведомляет финансовый блок об утверждённом отчёте.
        Возвращает количество успешно отправленных уведомлений.
        """
        if not finance_chat_ids:
            logger.info("finance_chat_ids пусты — уведомление не отправлено")
            return 0

        issue_url = f"{redmine_url}/issues/{redmine_issue_id}"
        text = (
            f"✅ <b>KPI-отчёт утверждён</b>\n\n"
            f"👤 Сотрудник: {employee_full_name}\n"
            f"🏢 Подразделение: {department_name}\n"
            f"📅 Период: {period_name}\n\n"
            f"📎 Отчёт прикреплён к задаче Redmine:\n"
            f'<a href="{issue_url}">#{redmine_issue_id}</a>'
        )

        sent = 0
        for chat_id in finance_chat_ids:
            if await self.send_telegram(chat_id, text):
                sent += 1

        logger.info(
            f"Финансовый блок уведомлён: {sent}/{len(finance_chat_ids)} получателей, "
            f"отчёт {employee_full_name} / {period_name}"
        )
        return sent


notification_service = NotificationService()
