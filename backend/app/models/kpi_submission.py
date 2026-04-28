from sqlalchemy import Column, String, Boolean, DateTime, Enum as SAEnum
from sqlalchemy import Text, Float, Integer, JSON, Date
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
import enum
from app.database import Base

class SubmissionStatus(str, enum.Enum):
    draft = "draft"               # сотрудник заполняет
    submitted = "submitted"       # отправлено на проверку
    approved = "approved"         # утверждено руководителем
    rejected = "rejected"         # возвращено на доработку

class KpiSubmission(Base):
    """
    Одна запись = один KPI-отчёт сотрудника за период.
    Привязан к тройке: employee + period + position_id
    (position_id нужен на случай перевода — два отчёта за период)
    """
    __tablename__ = "kpi_submissions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Привязка
    employee_redmine_id = Column(String, nullable=False, index=True)
    employee_login = Column(String, nullable=False)
    period_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    period_name = Column(String, nullable=False)
    position_id = Column(String, nullable=True)      # ЗПД_КОН_056

    # Redmine задача
    redmine_issue_id = Column(Integer, nullable=True)

    # Статус
    status = Column(SAEnum(SubmissionStatus), nullable=False, default=SubmissionStatus.draft)

    # Бинарные KPI (стандартные для всех)
    bin_discipline_summary = Column(Text, nullable=True)   # AI-саммари + правки
    bin_schedule_summary = Column(Text, nullable=True)
    bin_safety_summary = Column(Text, nullable=True)

    # Данные по специфическим KPI — JSON массив:
    # [{"criterion_id": "ЗПД_КОН_056_1", "indicator": "...", "plan_value": "...",
    #   "formula_type": "threshold", "fact_value": 5.0, "base_value": 10.0,
    #   "summary": "текст для binary_auto"}]
    kpi_values = Column(JSON, nullable=True)

    # Саммари (новый флоу: сотрудник загружает и редактирует, AI оценивает при submit)
    summary_text = Column(Text, nullable=True)           # текст-заготовка / отредактированный
    summary_loaded_at = Column(DateTime(timezone=True), nullable=True)  # когда загружено из Redmine

    # AI-генерация
    ai_raw_summary = Column(Text, nullable=True)      # сырой ответ Claude
    ai_generated_at = Column(DateTime(timezone=True), nullable=True)

    # Проверка руководителем
    reviewer_redmine_id = Column(String, nullable=True)
    reviewer_login = Column(String, nullable=True)
    reviewer_comment = Column(Text, nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)

    # Служебные
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
