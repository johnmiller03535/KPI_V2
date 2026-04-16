from sqlalchemy import Column, String, Boolean, DateTime, Enum as SAEnum, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
import uuid
import enum
from app.database import Base


class SubmissionStatus(str, enum.Enum):
    draft = "draft"           # сотрудник заполняет
    submitted = "submitted"   # отправлен на проверку руководителю
    approved = "approved"     # утверждён руководителем
    rejected = "rejected"     # возвращён на доработку


class KpiSubmission(Base):
    """
    KPI-отчёт сотрудника за период.
    Создаётся при открытии формы (draft), отправляется руководителю (submitted),
    утверждается (approved) или возвращается (rejected).
    """
    __tablename__ = "kpi_submissions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Сотрудник
    employee_redmine_id = Column(String, nullable=False, index=True)
    employee_login = Column(String, nullable=False)

    # Период
    period_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    period_name = Column(String, nullable=False)

    # Должность (для подбора KPI-набора)
    position_id = Column(String, nullable=True)

    # Статус
    status = Column(
        SAEnum(SubmissionStatus),
        nullable=False,
        default=SubmissionStatus.draft,
        index=True,
    )

    # Бинарные KPI (описания выполненных работ, заполняет сотрудник)
    bin_discipline_text = Column(Text, nullable=True)   # исполнительская дисциплина
    bin_schedule_text = Column(Text, nullable=True)     # трудовой распорядок
    bin_safety_text = Column(Text, nullable=True)       # охрана труда

    # AI-саммари (генерируется Claude)
    bin_discipline_summary = Column(Text, nullable=True)
    bin_schedule_summary = Column(Text, nullable=True)
    bin_safety_summary = Column(Text, nullable=True)
    ai_generated_at = Column(DateTime(timezone=True), nullable=True)

    # Числовые/специфические KPI (список значений в JSON)
    kpi_values = Column(JSONB, nullable=True)

    # Redmine task_id (задача, к которой привязан отчёт)
    redmine_task_id = Column(String, nullable=True)

    # Временные метки сотрудника
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Решение руководителя
    reviewer_redmine_id = Column(String, nullable=True)
    reviewer_login = Column(String, nullable=True)
    reviewer_comment = Column(Text, nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
