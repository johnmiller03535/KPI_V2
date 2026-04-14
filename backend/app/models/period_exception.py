from sqlalchemy import Column, String, DateTime, Enum as SAEnum, Text, Date
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
import enum
from app.database import Base

class ExceptionType(str, enum.Enum):
    dismissed = "dismissed"       # уволен в середине периода
    transferred = "transferred"   # переведён (нужны 2 отчёта)
    excluded = "excluded"         # исключён из KPI этого периода
    maternity = "maternity"       # декрет

class PeriodException(Base):
    __tablename__ = "period_exceptions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    period_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    employee_redmine_id = Column(String, nullable=False, index=True)
    employee_login = Column(String, nullable=False)
    exception_type = Column(SAEnum(ExceptionType), nullable=False)

    # Для dismissed/transferred — дата события
    event_date = Column(Date, nullable=True)

    # Для transferred — новая должность
    new_position_id = Column(String, nullable=True)
    new_department_code = Column(String, nullable=True)

    comment = Column(Text, nullable=True)
    created_by = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
