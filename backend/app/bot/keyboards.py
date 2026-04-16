from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton


def review_keyboard(submission_id: str) -> InlineKeyboardMarkup:
    """Клавиатура для утверждения/отклонения отчёта."""
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(
                text="✅ Утвердить",
                callback_data=f"approve:{submission_id}",
            ),
            InlineKeyboardButton(
                text="↩️ Вернуть на доработку",
                callback_data=f"reject_start:{submission_id}",
            ),
        ]
    ])


def confirm_reject_keyboard(submission_id: str) -> InlineKeyboardMarkup:
    """Клавиатура подтверждения возврата."""
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(
                text="↩️ Подтвердить возврат",
                callback_data=f"reject_confirm:{submission_id}",
            ),
            InlineKeyboardButton(
                text="❌ Отмена",
                callback_data=f"reject_cancel:{submission_id}",
            ),
        ]
    ])


def already_decided_keyboard() -> InlineKeyboardMarkup:
    """Клавиатура когда решение уже принято."""
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(
                text="🌐 Открыть портал",
                url="https://kpi.amvera.io",
            )
        ]
    ])
