from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from app.config import settings

dp = Dispatcher()
bot: Bot | None = None

def get_bot() -> Bot | None:
    global bot
    if bot is None and settings.telegram_bot_token:
        try:
            bot = Bot(
                token=settings.telegram_bot_token,
                default=DefaultBotProperties(parse_mode=ParseMode.HTML),
            )
        except Exception:
            bot = None
    return bot
