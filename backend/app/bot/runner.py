import asyncio
import logging
from app.bot.bot import dp, get_bot
from app.bot.handlers import router
from app.config import settings

logger = logging.getLogger(__name__)

async def start_bot():
    if not settings.telegram_bot_token:
        logger.warning("TELEGRAM_BOT_TOKEN не задан — бот не запущен")
        return
    bot = get_bot()
    if not bot:
        logger.warning("Не удалось инициализировать бота — бот не запущен")
        return
    dp.include_router(router)
    logger.info("Запуск Telegram-бота...")
    try:
        await dp.start_polling(bot, allowed_updates=["message", "callback_query"])
    except Exception as e:
        logger.error(f"Ошибка Telegram-бота: {e}")

async def stop_bot():
    bot = get_bot()
    if bot:
        await bot.session.close()
        logger.info("Telegram-бот остановлен")
