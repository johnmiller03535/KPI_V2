import logging
from datetime import datetime
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
from typing import Optional
from pydantic import BaseModel

from app.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.user import User, UserRole
from app.models.notification import Notification, NotificationStatus
from app.services.reminder_service import reminder_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/notifications", tags=["notifications"])


class NotificationResponse(BaseModel):
    id: str
    recipient_login: str
    notification_type: str
    period_name: Optional[str]
    status: str
    error_message: Optional[str]
    sent_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


@router.post("/run-reminders")
async def run_reminders_manually(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
):
    """Запустить напоминания вручную (только admin)."""
    stats = await reminder_service.run_daily_reminders(db)
    return stats


@router.get("/logs", response_model=list[NotificationResponse])
async def get_notification_logs(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
    status: Optional[str] = Query(None),
    limit: int = Query(50),
):
    """История уведомлений (только admin)."""
    query = select(Notification).order_by(desc(Notification.created_at)).limit(limit)
    if status:
        query = query.where(Notification.status == status)
    result = await db.execute(query)
    notifications = result.scalars().all()
    return [NotificationResponse(
        id=str(n.id),
        recipient_login=n.recipient_login,
        notification_type=n.notification_type,
        period_name=n.period_name,
        status=n.status,
        error_message=n.error_message,
        sent_at=n.sent_at,
        created_at=n.created_at,
    ) for n in notifications]


@router.get("/stats")
async def get_notification_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
):
    """Статистика уведомлений по статусам."""
    result = await db.execute(
        select(
            Notification.status,
            func.count(Notification.id).label("count")
        ).group_by(Notification.status)
    )
    rows = result.all()
    return {row.status: row.count for row in rows}
