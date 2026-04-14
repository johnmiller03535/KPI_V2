from sqlalchemy import Column, String, DateTime, Integer, JSON, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
import enum
from app.database import Base

class SyncStatus(str, enum.Enum):
    success = "success"
    partial = "partial"
    failed = "failed"

class SyncLog(Base):
    __tablename__ = "sync_log"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sync_type = Column(String, nullable=False)       # "employees", "full"
    status = Column(SAEnum(SyncStatus), nullable=False)
    total = Column(Integer, default=0)
    created_count = Column(Integer, default=0)
    updated_count = Column(Integer, default=0)
    dismissed_count = Column(Integer, default=0)
    errors_count = Column(Integer, default=0)
    details = Column(JSON, nullable=True)            # список изменений
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    finished_at = Column(DateTime(timezone=True), nullable=True)
