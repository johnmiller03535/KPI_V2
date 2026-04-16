from sqlalchemy import Column, String, Boolean, DateTime, Date
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
from app.database import Base


class DeputyAssignment(Base):
    """
    Замещение руководителя на период.
    Когда руководитель недоступен — назначает заместителя,
    который будет проверять отчёты вместо него.
    """
    __tablename__ = "deputy_assignments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Кто отсутствует
    manager_redmine_id = Column(String, nullable=False, index=True)
    manager_login = Column(String, nullable=False)
    manager_position_id = Column(String, nullable=True)

    # Кто замещает
    deputy_redmine_id = Column(String, nullable=False, index=True)
    deputy_login = Column(String, nullable=False)

    # Период замещения
    date_from = Column(Date, nullable=False)
    date_to = Column(Date, nullable=True)   # None = бессрочно

    is_active = Column(Boolean, default=True)
    comment = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
