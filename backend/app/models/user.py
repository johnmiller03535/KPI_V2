from sqlalchemy import Column, String, Boolean, DateTime, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
import enum
from app.database import Base

class UserRole(str, enum.Enum):
    employee = "employee"
    manager = "manager"
    admin = "admin"
    finance = "finance"

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    redmine_id = Column(String, unique=True, nullable=False, index=True)
    login = Column(String, unique=True, nullable=False, index=True)
    firstname = Column(String, nullable=False)
    lastname = Column(String, nullable=False)
    email = Column(String, nullable=True)
    role = Column(SAEnum(UserRole), nullable=False, default=UserRole.employee)
    department = Column(String, nullable=True)
    position_id = Column(String, nullable=True)   # role_id из KPI_Mapping (напр. ЗПД_КОН_056)
    telegram_id = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    last_synced_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    @property
    def full_name(self) -> str:
        return f"{self.lastname} {self.firstname}"
