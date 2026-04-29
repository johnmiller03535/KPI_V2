"""
KpiEngineService — главный оркестратор обработки KPI-отчёта.

Поток:
1. Загрузка submission + period из БД
2. Получение трудозатрат из Redmine
3. Загрузка KPI-структуры по pos_id сотрудника
4. Параллельная AI-оценка binary_auto KPI (asyncio.gather)
5. Разметка binary_manual и numeric
6. Сохранение результатов в submission.kpi_values
7. Возврат KpiEngineResult
"""

import asyncio
import logging
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException

from app.models.kpi_submission import KpiSubmission
from app.models.period import Period
from app.schemas.kpi import KpiResult, KpiEngineResult, KpiItem
from app.services.kpi_mapping_service import kpi_mapping_service
from app.services.ai_service import ai_service
from app.services.threshold_parser import parse_thresholds
from app.core.redmine import redmine_client

logger = logging.getLogger(__name__)


def _compute_partial_score(results: list[KpiResult]) -> tuple[Optional[float], int, int]:
    """Возвращает (partial_score, total_weight, scored_weight)."""
    total_weight = sum(r.weight for r in results)
    scored = [r for r in results if r.score is not None]
    scored_weight = sum(r.weight for r in scored)

    if not scored:
        return None, total_weight, 0

    partial_score = (
        sum(r.score * r.weight for r in scored) / scored_weight
    )
    return round(partial_score, 2), total_weight, scored_weight


async def _evaluate_one(
    kpi: KpiItem,
    time_entries: list[dict],
) -> KpiResult:
    """Оценивает один binary_auto KPI через AI (используется внутри gather)."""
    try:
        ai_result = await ai_service.evaluate_binary_kpi(
            time_entries=time_entries,
            criterion=kpi.criterion,
            formula_desc=kpi.formula_desc,
        )
        return KpiResult(
            indicator=kpi.indicator,
            criterion=kpi.criterion,
            formula_type=kpi.formula_type,
            weight=kpi.weight,
            is_common=kpi.is_common,
            cumulative=kpi.cumulative,
            kpi_type="binary_auto",
            score=float(ai_result["score"]),
            confidence=int(ai_result["confidence"]),
            summary=ai_result["summary"],
            requires_review=int(ai_result["confidence"]) < 80,
        )
    except Exception as e:
        logger.warning(f"Ошибка AI-оценки критерия '{kpi.criterion[:40]}': {e}")
        return KpiResult(
            indicator=kpi.indicator,
            criterion=kpi.criterion,
            formula_type=kpi.formula_type,
            weight=kpi.weight,
            is_common=kpi.is_common,
            cumulative=kpi.cumulative,
            kpi_type="binary_auto",
            score=100,
            confidence=50,
            summary="Данные для анализа отсутствуют. Требует ручной проверки.",
            requires_review=True,
        )


class KpiEngineService:

    async def process_submission(
        self,
        submission_id: str,
        db: AsyncSession,
    ) -> KpiEngineResult:
        """Полная обработка KPI-отчёта: AI + разметка + сохранение."""

        # ШАГ 1 — загрузка submission
        sub_result = await db.execute(
            select(KpiSubmission).where(KpiSubmission.id == submission_id)
        )
        sub = sub_result.scalar_one_or_none()
        if not sub:
            raise HTTPException(status_code=404, detail="Отчёт не найден")

        # ШАГ 2 — загрузка period и вычисление квартала
        period_result = await db.execute(
            select(Period).where(Period.id == sub.period_id)
        )
        period = period_result.scalar_one_or_none()
        quarter = 1
        date_from = ""
        date_to = ""
        if period:
            quarter = (period.date_start.month - 1) // 3 + 1
            date_from = str(period.date_start)
            date_to = str(period.date_end)

        # ШАГ 3 — трудозатраты из Redmine
        time_entries: list[dict] = []
        if date_from and date_to:
            try:
                time_entries = await redmine_client.get_time_entries(
                    user_id=int(sub.employee_redmine_id),
                    date_from=date_from,
                    date_to=date_to,
                )
                logger.info(f"Получено {len(time_entries)} трудозатрат для {sub.employee_login}")
            except Exception as e:
                logger.warning(f"Не удалось получить трудозатраты: {e}")

        # ШАГ 4 — KPI-структура по pos_id
        structure = kpi_mapping_service.get_kpi_structure_by_pos_id(sub.position_id or "")
        all_kpis = structure.binary_auto + structure.binary_manual + structure.numeric

        if not all_kpis:
            logger.warning(f"Нет KPI для position_id={sub.position_id}")

        # ШАГ 5 — параллельная AI-оценка binary_auto
        binary_auto_tasks = [
            _evaluate_one(kpi, time_entries)
            for kpi in structure.binary_auto
        ]
        binary_auto_results: list[KpiResult] = []
        if binary_auto_tasks:
            binary_auto_results = list(await asyncio.gather(*binary_auto_tasks))

        # ШАГ 6 — binary_manual: ожидают ввода руководителя
        binary_manual_results = [
            KpiResult(
                indicator=kpi.indicator,
                criterion=kpi.criterion,
                formula_type=kpi.formula_type,
                weight=kpi.weight,
                is_common=kpi.is_common,
                cumulative=kpi.cumulative,
                kpi_type="binary_manual",
                score=None,
                awaiting_manual_input=True,
            )
            for kpi in structure.binary_manual
        ]

        # ШАГ 7 — numeric: ожидают ввода факта от сотрудника
        numeric_results = [
            KpiResult(
                indicator=kpi.indicator,
                criterion=kpi.criterion,
                formula_type=kpi.formula_type,
                weight=kpi.weight,
                is_common=kpi.is_common,
                cumulative=kpi.cumulative,
                kpi_type="numeric",
                score=None,
                requires_fact_input=True,
                parsed_thresholds=[r.model_dump() for r in parse_thresholds(kpi.thresholds)],
            )
            for kpi in structure.numeric
        ]

        all_results = binary_auto_results + binary_manual_results + numeric_results

        # ШАГ 8 — общее AI-саммари
        general_summary = ""
        try:
            binary_criteria = [kpi.criterion for kpi in structure.binary_auto]
            summary_result = await ai_service.summarize_time_entries(
                employee_name=sub.employee_login,
                period_name=sub.period_name,
                time_entries=time_entries,
                kpi_criteria=binary_criteria,
            )
            if summary_result:
                general_summary = summary_result.get("general_summary", "")
        except Exception as e:
            logger.warning(f"Ошибка генерации саммари: {e}")

        # ШАГ 9 — сохранение в БД
        partial_score, total_weight, scored_weight = _compute_partial_score(all_results)
        sub.kpi_values = [r.model_dump() for r in all_results]
        sub.ai_raw_summary = general_summary
        from datetime import datetime, timezone
        sub.ai_generated_at = datetime.now(timezone.utc)
        await db.commit()

        # ШАГ 10 — системные флаги
        requires_review_items = [
            r.criterion[:50] for r in all_results if r.requires_review
        ]
        system_flags = {
            "partial_result": scored_weight < total_weight,
            "requires_review": requires_review_items,
            "awaiting_manual": sum(1 for r in all_results if r.awaiting_manual_input),
            "requires_fact": sum(1 for r in all_results if r.requires_fact_input),
            "time_entries_count": len(time_entries),
        }

        completion_pct = round(scored_weight / total_weight * 100, 1) if total_weight > 0 else 0.0

        logger.info(
            f"KpiEngine: {sub.employee_login} | "
            f"binary_auto={len(binary_auto_results)}, "
            f"manual={len(binary_manual_results)}, "
            f"numeric={len(numeric_results)} | "
            f"partial_score={partial_score}"
        )

        return KpiEngineResult(
            kpi_results=all_results,
            partial_score=partial_score,
            total_weight=total_weight,
            scored_weight=scored_weight,
            completion_pct=completion_pct,
            system_flags=system_flags,
        )

    def compute_score_from_kpi_values(
        self,
        kpi_values: list[dict],
    ) -> tuple[Optional[float], int, int]:
        """
        Пересчёт partial_score из сохранённых kpi_values (без БД).
        Для binary_auto: manager_override имеет приоритет над ai-score.
        """
        adjusted: list[dict] = []
        for v in kpi_values:
            item = dict(v)
            if item.get("formula_type") == "binary_auto":
                override = item.get("manager_override")
                if override is not None:
                    item["score"] = 100.0 if override else 0.0
            adjusted.append(item)
        results = [KpiResult(**v) for v in adjusted]
        return _compute_partial_score(results)


kpi_engine_service = KpiEngineService()
