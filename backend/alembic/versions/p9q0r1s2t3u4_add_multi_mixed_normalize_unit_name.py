"""add multi_mixed formula_type support and normalize unit_name values

Revision ID: p9q0r1s2t3u4
Revises: o8p9q0r1s2t3
Branch Labels: None
Depends On: None
Create Date: 2026-05-05

Changes:
- formula_type is VARCHAR — multi_mixed supported automatically, no schema change needed
- Data migration: normalize unit_name values in kpi_indicators
  (removes extra whitespace, corrects known typos)
- quarterly_thresholds JSONB already supports {q1:[...], q2:[...], q3:[...], q4:[...]}
  for absolute_threshold — no schema change needed
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


revision = 'p9q0r1s2t3u4'
down_revision = 'o8p9q0r1s2t3'
branch_labels = None
depends_on = None


def upgrade():
    # Нормализовать unit_name: убрать лишние пробелы
    op.execute(text("""
        UPDATE kpi_indicators
        SET unit_name = TRIM(unit_name)
        WHERE unit_name IS NOT NULL AND unit_name != TRIM(unit_name)
    """))

    # Исправить известные варианты написания управлений
    # (актуальные значения берём из SELECT DISTINCT unit_name FROM kpi_indicators)
    normalization_map = [
        ("Руководство ", "Руководство"),
        (" Руководство", "Руководство"),
        ("руководство", "Руководство"),
        ("РУКОВОДСТВО", "Руководство"),
    ]
    for old_val, new_val in normalization_map:
        op.execute(text(
            f"UPDATE kpi_indicators SET unit_name = '{new_val}' WHERE unit_name = '{old_val}'"
        ))


def downgrade():
    # Data migrations не откатываются
    pass
