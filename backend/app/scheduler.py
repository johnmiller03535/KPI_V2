import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from app.database import AsyncSessionLocal
from app.services.sync_service import sync_service

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler(timezone="Europe/Moscow")

async def run_employee_sync():
    """Задача синхронизации сотрудников — запускается по расписанию."""
    logger.info("Запуск плановой синхронизации сотрудников...")
    async with AsyncSessionLocal() as db:
        result = await sync_service.sync_employees(db)
        logger.info(
            f"Синхронизация: статус={result.status}, "
            f"создано={result.created_count}, "
            f"обновлено={result.updated_count}, "
            f"уволено={result.dismissed_count}"
        )

def start_scheduler():
    # Каждое воскресенье в 02:00 по Москве
    scheduler.add_job(
        run_employee_sync,
        CronTrigger(day_of_week="sun", hour=2, minute=0),
        id="employee_sync",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("Планировщик запущен")

def stop_scheduler():
    scheduler.shutdown()
    logger.info("Планировщик остановлен")
