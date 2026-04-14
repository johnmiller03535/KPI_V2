from sqlalchemy import Column, String, Boolean, DateTime, Enum as SAEnum, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
import enum
from app.database import Base

class EmployeeStatus(str, enum.Enum):
    active = "active"
    dismissed = "dismissed"
    maternity = "maternity"
    excluded = "excluded"   # исключён из KPI вручную

class Employee(Base):
    __tablename__ = "employees"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Данные из Redmine
    redmine_id = Column(String, unique=True, nullable=False, index=True)
    login = Column(String, nullable=False, index=True)
    firstname = Column(String, nullable=False)
    lastname = Column(String, nullable=False)
    email = Column(String, nullable=True)
    telegram_id = Column(String, nullable=True)

    # KPI-структура (из кастомного поля kpi_role_id в Redmine)
    position_id = Column(String, nullable=True, index=True)   # напр. ЗПД_КОН_056
    department_code = Column(String, nullable=True)            # напр. kpi-zpd
    department_name = Column(String, nullable=True)            # напр. УП подготовки ЗИТ

    # Статус
    status = Column(SAEnum(EmployeeStatus), nullable=False, default=EmployeeStatus.active)
    is_active = Column(Boolean, default=True)

    # Служебные
    last_synced_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    @property
    def full_name(self) -> str:
        return f"{self.lastname} {self.firstname}"
