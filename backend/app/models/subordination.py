from sqlalchemy import Column, String, DateTime
from sqlalchemy.sql import func

from app.database import Base


class Subordination(Base):
    """Матрица подчинения — хранит evaluator_id для каждой должности."""
    __tablename__ = "subordination"

    position_id = Column(String, primary_key=True)   # role_id: "РУК_ЗАМД_002"
    evaluator_id = Column(String, nullable=True)      # role_id руководителя; None = директорский уровень
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
