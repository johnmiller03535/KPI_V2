from sqlalchemy import Column, String, Boolean, DateTime, Date, Enum as SAEnum, Integer, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
import enum
from app.database import Base

class PeriodType(str, enum.Enum):
    monthly = "monthly"
    quarterly = "quarterly"
    yearly = "yearly"

class PeriodStatus(str, enum.Enum):
    draft = "draft"           # создан, задачи ещё не созданы
    active = "active"         # задачи созданы, идёт заполнение
    review = "review"         # идёт проверка руководителями
    closed = "closed"         # период закрыт, все отчёты утверждены

class Period(Base):
    __tablename__ = "periods"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Тип и временной охват
    period_type = Column(SAEnum(PeriodType), nullable=False)
    year = Column(Integer, nullable=False)
    month = Column(Integer, nullable=True)     # 1-12, только для monthly
    quarter = Column(Integer, nullable=True)   # 1-4, только для quarterly

    # Человекочитаемое название, напр. "Март 2026", "Q1 2026", "2026 год"
    name = Column(String, nullable=False)

    # Даты
    date_start = Column(Date, nullable=False)   # начало отчётного периода
    date_end = Column(Date, nullable=False)     # конец отчётного периода
    submit_deadline = Column(Date, nullable=False)   # дедлайн сдачи сотрудником
    review_deadline = Column(Date, nullable=False)   # дедлайн проверки руководителем

    # Статус
    status = Column(SAEnum(PeriodStatus), nullable=False, default=PeriodStatus.draft)

    # Создание задач в Redmine
    redmine_tasks_created = Column(Boolean, default=False)
    redmine_tasks_count = Column(Integer, default=0)

    # Служебные
    created_by = Column(String, nullable=True)   # login администратора
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    @property
    def short_name(self) -> str:
        """Короткое название для отображения."""
        return self.name
