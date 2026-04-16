from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from app.config import settings

# Инициализация бота и диспетчера
bot = Bot(
    token=settings.telegram_bot_token or "placeholder",
    default=DefaultBotProperties(parse_mode=ParseMode.HTML),
)

dp = Dispatcher()
