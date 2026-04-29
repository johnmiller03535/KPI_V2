import logging
import os
from datetime import datetime, timezone
from typing import Optional

import httpx
from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.kpi_submission import KpiSubmission, SubmissionStatus
from app.models.employee import Employee
from app.models.period import Period
from app.services.kpi_mapping_service import kpi_mapping_service
from app.core.redmine import redmine_client

logger = logging.getLogger(__name__)

TEMPLATES_DIR = os.path.join(os.path.dirname(__file__), "../templates")

# Redmine status_id для «Оценено» (задача оценена, PDF прикреплён)
REDMINE_STATUS_EVALUATED = 27


class ReportService:

    def _jinja_env(self) -> Environment:
        return Environment(
            loader=FileSystemLoader(TEMPLATES_DIR),
            autoescape=True,
        )

    # ------------------------------------------------------------------
    # Арифметика
    # ------------------------------------------------------------------

    @staticmethod
    def _pct(fact, plan=1) -> str:
        """% выполнения: fact / plan × 100%."""
        try:
            if fact is None:
                return "—"
            v = float(fact) / float(plan) * 100
            return f"{v:.0f}%"
        except (TypeError, ZeroDivisionError):
            return "—"

    @staticmethod
    def _result(fact, weight: float, plan=1) -> str:
        """Доля показателя (выполнение) = weight × fact/plan."""
        try:
            if fact is None:
                return "—"
            v = float(weight) * (float(fact) / float(plan))
            return f"{v:.2f}"
        except (TypeError, ZeroDivisionError):
            return "—"

    # ------------------------------------------------------------------
    # Построение контекста для шаблона
    # ------------------------------------------------------------------

    def _build_context(
        self,
        submission: KpiSubmission,
        employee: Optional[Employee],
        reviewer_name: Optional[str] = None,
    ) -> dict:
        role_info = kpi_mapping_service.get_role_info(submission.position_id) if submission.position_id else None

        kpi_values: list[dict] = submission.kpi_values or []

        # Разбиваем kpi_values на группы
        binary_auto   = [k for k in kpi_values if k.get("formula_type") == "binary_auto"]
        binary_manual = [k for k in kpi_values if k.get("formula_type") == "binary_manual"]
        _NUMERIC_TYPES = {"threshold", "multi_threshold", "quarterly_threshold"}
        numeric       = [k for k in kpi_values if k.get("formula_type") in _NUMERIC_TYPES]

        # --- Специфические (не общие) KPI = binary_auto + numeric ---
        specific_kpis = []
        specific_indicator_name = "Специфические показатели"
        total_result = 0.0

        non_common = [k for k in (binary_auto + numeric) if not k.get("is_common", False)]
        if non_common:
            specific_indicator_name = non_common[0].get("indicator", specific_indicator_name)

        for kv in non_common:
            weight_pct  = float(kv.get("weight", 0))
            weight_frac = weight_pct / 100
            formula_type = kv.get("formula_type", "")
            score        = kv.get("score")          # 0–100 для binary_auto; None если не оценено

            if formula_type == "binary_auto":
                # fact = 1 (выполнено) или 0 (не выполнено), план = 1
                fact_display = "1" if score == 100 else ("0" if score == 0 else "—")
                pct_display  = f"{score:.0f}%" if score is not None else "—"
                result_val   = f"{weight_frac * (score / 100):.2f}" if score is not None else "—"
                measures     = kv.get("summary", "")
                plan_display = "1"
                if score is not None:
                    total_result += weight_frac * (score / 100)
            else:
                # numeric
                fact = kv.get("fact_value")
                plan_display = kv.get("plan_value", "1")
                pct_display  = f"{score:.0f}%" if score is not None else "—"
                fact_display = str(fact) if fact is not None else "—"
                result_val   = f"{weight_frac * (score / 100):.2f}" if score is not None else "—"
                measures     = ""
                if score is not None:
                    total_result += weight_frac * (score / 100)

            specific_kpis.append({
                "criterion":    kv.get("criterion", ""),
                "plan_value":   plan_display,
                "weight_pct":   f"{weight_pct:.0f}%",
                "measures":     measures,
                "fact_value":   fact_display,
                "pct_value":    pct_display,
                "result_value": result_val,
            })

        # --- Общие бинарные KPI (обычно binary_manual с is_common=True) ---
        # Если kpi_values есть — берём из них; иначе берём из старых текстовых полей
        def _kv_by_criterion_fragment(items: list[dict], fragment: str) -> Optional[dict]:
            """Ищет KPI по фрагменту критерия (без учёта регистра)."""
            fragment_l = fragment.lower()
            for kv in items:
                if fragment_l in kv.get("criterion", "").lower():
                    return kv
            return None

        # Дисциплина (30%) — discipline / binary_auto is_common или старый текст
        discipline_kv = _kv_by_criterion_fragment(kpi_values, "исполнительской дисциплин")
        if discipline_kv:
            d_score   = discipline_kv.get("score")
            d_fact    = "1" if d_score == 100 else ("0" if d_score == 0 else "1")
            d_pct     = self._pct(1 if d_score == 100 else 0 if d_score == 0 else 1)
            d_result  = self._result(1 if d_score == 100 else 0 if d_score == 0 else 1, 0.30)
            d_summary = discipline_kv.get("summary") or submission.bin_discipline_summary or ""
            d_num     = 1 if d_score == 100 else 0 if d_score == 0 else 1
        else:
            d_num     = 1
            d_fact    = "1"
            d_pct     = self._pct(1)
            d_result  = self._result(1, 0.30)
            d_summary = submission.bin_discipline_summary or ""
        total_result += 0.30 * d_num

        # Распорядок (10%)
        schedule_kv = _kv_by_criterion_fragment(binary_manual, "трудового распорядка")
        if schedule_kv:
            s_score   = schedule_kv.get("score")
            s_fact    = "1" if s_score == 100 else ("0" if s_score == 0 else "—")
            s_pct     = self._pct(1 if s_score == 100 else 0 if s_score == 0 else None)
            s_result  = self._result(1 if s_score == 100 else 0 if s_score == 0 else None, 0.10)
            s_summary = schedule_kv.get("reviewer_comment") or schedule_kv.get("summary") or submission.bin_schedule_summary or ""
            s_num     = (s_score or 0) / 100
        else:
            s_num     = 1
            s_fact    = "1"
            s_pct     = self._pct(1)
            s_result  = self._result(1, 0.10)
            s_summary = submission.bin_schedule_summary or ""
        total_result += 0.10 * s_num

        # Охрана труда (10%)
        safety_kv = _kv_by_criterion_fragment(binary_manual, "охран")
        if safety_kv:
            sf_score   = safety_kv.get("score")
            sf_fact    = "1" if sf_score == 100 else ("0" if sf_score == 0 else "—")
            sf_pct     = self._pct(1 if sf_score == 100 else 0 if sf_score == 0 else None)
            sf_result  = self._result(1 if sf_score == 100 else 0 if sf_score == 0 else None, 0.10)
            sf_summary = safety_kv.get("reviewer_comment") or safety_kv.get("summary") or submission.bin_safety_summary or ""
            sf_num     = (sf_score or 0) / 100
        else:
            sf_num     = 1
            sf_fact    = "1"
            sf_pct     = self._pct(1)
            sf_result  = self._result(1, 0.10)
            sf_summary = submission.bin_safety_summary or ""
        total_result += 0.10 * sf_num

        return {
            # Шапка
            "employee_full_name": employee.full_name if employee else submission.employee_login,
            "department_name":    employee.department_name if employee else "",
            "role_name":          role_info["role"] if role_info else (submission.position_id or ""),
            "period_name":        submission.period_name,

            # Специфические
            "specific_kpis":           specific_kpis,
            "specific_indicator_name": specific_indicator_name,

            # Бинарные общие
            "bin_discipline_summary": d_summary,
            "bin_discipline_fact":    d_fact,
            "bin_discipline_pct":     d_pct,
            "bin_discipline_result":  d_result,

            "bin_schedule_summary": s_summary,
            "bin_schedule_fact":    s_fact,
            "bin_schedule_pct":     s_pct,
            "bin_schedule_result":  s_result,

            "bin_safety_summary": sf_summary,
            "bin_safety_fact":    sf_fact,
            "bin_safety_pct":     sf_pct,
            "bin_safety_result":  sf_result,

            # Итого
            "total_result":     f"{total_result:.2f}",
            "premium_proposal": f"{total_result:.2f}",

            # Подпись
            "reviewer_title": "Руководитель",
            "reviewer_name":  reviewer_name or "",

            # Мета
            "generated_at": datetime.now(timezone.utc).strftime("%d.%m.%Y"),

            # Новый формат — прямая передача kpi_values для сводной таблицы
            "kpi_results":      kpi_values,
            "total_score":      round(total_result * 100, 1),
            "has_review_flags": any(k.get("requires_review") for k in kpi_values),
        }

    # ------------------------------------------------------------------
    # Рендер и генерация
    # ------------------------------------------------------------------

    def render_html(self, context: dict) -> str:
        return self._jinja_env().get_template("kpi_report.html").render(**context)

    def generate_pdf_bytes(self, html: str) -> bytes:
        return HTML(string=html).write_pdf()

    async def generate_report(self, submission_id: str, db: AsyncSession) -> Optional[bytes]:
        """Полный цикл: загрузить данные → рендер HTML → PDF байты."""
        result = await db.execute(
            select(KpiSubmission).where(KpiSubmission.id == submission_id)
        )
        sub = result.scalar_one_or_none()
        if not sub:
            logger.error(f"Submission {submission_id} не найден")
            return None

        emp_res = await db.execute(
            select(Employee).where(Employee.redmine_id == sub.employee_redmine_id)
        )
        emp = emp_res.scalar_one_or_none()

        context = self._build_context(sub, emp, reviewer_name=sub.reviewer_login)
        html = self.render_html(context)
        pdf_bytes = self.generate_pdf_bytes(html)

        logger.info(
            f"PDF сгенерирован: submission={submission_id}, "
            f"сотрудник={emp.full_name if emp else '?'}, "
            f"период={sub.period_name}, размер={len(pdf_bytes)} байт"
        )
        return pdf_bytes

    # ------------------------------------------------------------------
    # Прикрепление к Redmine
    # ------------------------------------------------------------------

    async def attach_to_redmine(
        self,
        submission: KpiSubmission,
        pdf_bytes: bytes,
        employee: Employee,
    ) -> bool:
        """Загружает PDF и прикрепляет к задаче Redmine."""
        if not submission.redmine_issue_id:
            logger.warning(f"Нет redmine_issue_id для submission {submission.id}")
            return False

        filename = (
            f"KPI_{employee.lastname}_{submission.period_name.replace(' ', '_')}.pdf"
        )

        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                # 1. Загрузить файл
                upload_resp = await client.post(
                    f"{redmine_client.base_url}/uploads.json",
                    headers={
                        **redmine_client._headers(),
                        "Content-Type": "application/octet-stream",
                    },
                    content=pdf_bytes,
                )
                if upload_resp.status_code != 201:
                    logger.error(
                        f"Redmine upload error: {upload_resp.status_code} "
                        f"{upload_resp.text[:200]}"
                    )
                    return False

                token = upload_resp.json()["upload"]["token"]

                # 2. Прикрепить к задаче и сменить статус
                update_resp = await client.put(
                    f"{redmine_client.base_url}/issues/{submission.redmine_issue_id}.json",
                    headers={
                        **redmine_client._headers(),
                        "Content-Type": "application/json",
                    },
                    json={
                        "issue": {
                            "status_id": REDMINE_STATUS_EVALUATED,
                            "uploads": [{
                                "token":        token,
                                "filename":     filename,
                                "content_type": "application/pdf",
                                "description":  f"KPI-отчёт за {submission.period_name}",
                            }],
                        }
                    },
                )

                if update_resp.status_code in (200, 204):
                    logger.info(
                        f"PDF прикреплён к задаче #{submission.redmine_issue_id}: {filename}"
                    )
                    return True

                logger.error(
                    f"Redmine attach error: {update_resp.status_code} "
                    f"{update_resp.text[:200]}"
                )
                return False

            except httpx.RequestError as e:
                logger.error(f"Redmine request error при прикреплении PDF: {e}")
                return False


report_service = ReportService()
