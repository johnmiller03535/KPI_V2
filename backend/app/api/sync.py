from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.database import get_db
from app.core.deps import require_role
from app.models.user import User, UserRole
from app.models.sync_log import SyncLog
from app.services.sync_service import sync_service
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

router = APIRouter(prefix="/api/sync", tags=["sync"])


class SyncLogResponse(BaseModel):
    id: str
    sync_type: str
    status: str
    total: int
    created_count: int
    updated_count: int
    dismissed_count: int
    errors_count: int
    started_at: datetime
    finished_at: Optional[datetime]

    class Config:
        from_attributes = True


@router.post("/run", response_model=SyncLogResponse)
async def run_sync(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
):
    """Запустить синхронизацию вручную (только для admin)."""
    result = await sync_service.sync_employees(db)
    return SyncLogResponse(
        id=str(result.id),
        sync_type=result.sync_type,
        status=result.status,
        total=result.total or 0,
        created_count=result.created_count or 0,
        updated_count=result.updated_count or 0,
        dismissed_count=result.dismissed_count or 0,
        errors_count=result.errors_count or 0,
        started_at=result.started_at,
        finished_at=result.finished_at,
    )


@router.get("/logs", response_model=list[SyncLogResponse])
async def get_sync_logs(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
    limit: int = 10,
):
    """Последние N результатов синхронизации."""
    result = await db.execute(
        select(SyncLog).order_by(desc(SyncLog.started_at)).limit(limit)
    )
    logs = result.scalars().all()
    return [
        SyncLogResponse(
            id=str(l.id),
            sync_type=l.sync_type,
            status=l.status,
            total=l.total or 0,
            created_count=l.created_count or 0,
            updated_count=l.updated_count or 0,
            dismissed_count=l.dismissed_count or 0,
            errors_count=l.errors_count or 0,
            started_at=l.started_at,
            finished_at=l.finished_at,
        )
        for l in logs
    ]
