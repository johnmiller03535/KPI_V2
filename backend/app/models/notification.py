from sqlalchemy import Column, String, Boolean, DateTime, Enum as SAEnum, Text, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
import enum
from app.database import Base


class NotificationType(str, enum.Enum):
    employee_reminder_3d = "employee_reminder_3d"   # сотруднику за 3 дня
    employee_reminder_1d = "employee_reminder_1d"   # сотруднику за 1 день
    manager_reminder_3d = "manager_reminder_3d"     # руководителю за 3 дня
    manager_reminder_1d = "manager_reminder_1d"     # руководителю за 1 день
    admin_no_telegram = "admin_no_telegram"         # администратору: нет TG


class NotificationStatus(str, enum.Enum):
    pending = "pending"
    sent = "sent"
    failed = "failed"
    skipped = "skipped"    # нет telegram_id


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Получатель
    recipient_redmine_id = Column(String, nullable=False, index=True)
    recipient_login = Column(String, nullable=False)
    recipient_telegram_id = Column(String, nullable=True)

    # Тип и содержимое
    notification_type = Column(SAEnum(NotificationType), nullable=False)
    text = Column(Text, nullable=False)

    # Привязка к периоду/submission
    period_id = Column(String, nullable=True)
    period_name = Column(String, nullable=True)
    submission_id = Column(String, nullable=True)

    # Статус отправки
    status = Column(SAEnum(NotificationStatus), nullable=False,
                    default=NotificationStatus.pending)
    error_message = Column(Text, nullable=True)

    # Дедупликация — не отправлять повторно в тот же день
    dedup_key = Column(String, nullable=True, index=True, unique=True)
    # формат: "{type}:{recipient_redmine_id}:{period_id}:{date}"

    sent_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
