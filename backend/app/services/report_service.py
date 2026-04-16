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

        # Специфические KPI
        specific_kpis = []
        specific_indicator_name = "Специфические показатели"
        total_result = 0.0

        if submission.kpi_values:
            # Название из первого показателя
            specific_indicator_name = submission.kpi_values[0].get(
                "indicator", specific_indicator_name
            )
            for kv in submission.kpi_values:
                weight_pct = float(kv.get("weight", 0))   # вес в %
                weight_frac = weight_pct / 100             # вес в долях
                fact = kv.get("fact_value")
                plan_val = kv.get("plan_value", "1")

                pct = self._pct(fact, 1)
                result_val = self._result(fact, weight_frac, 1)

                specific_kpis.append({
                    "criterion":   kv.get("criterion", ""),
                    "plan_value":  plan_val,
                    "weight_pct":  f"{weight_pct:.0f}%",
                    "measures":    kv.get("summary", kv.get("measures", "")),
                    "fact_value":  fact if fact is not None else "—",
                    "pct_value":   pct,
                    "result_value": result_val,
                })

                try:
                    f = float(fact) if fact is not None else 0
                    total_result += weight_frac * f
                except (TypeError, ValueError):
                    pass

        # Бинарные KPI (предполагаем выполнены = 1, если отчёт утверждён)
        bin_facts = {
            "discipline": 1,
            "schedule":   1,
            "safety":     1,
        }
        total_result += 0.30 * bin_facts["discipline"]
        total_result += 0.10 * bin_facts["schedule"]
        total_result += 0.10 * bin_facts["safety"]

        return {
            # Шапка
            "employee_full_name": employee.full_name if employee else submission.employee_login,
            "department_name":    employee.department_name if employee else "",
            "role_name":          role_info["role"] if role_info else (submission.position_id or ""),
            "period_name":        submission.period_name,

            # Специфические
            "specific_kpis":           specific_kpis,
            "specific_indicator_name": specific_indicator_name,

            # Бинарные
            "bin_discipline_summary": submission.bin_discipline_summary or "",
            "bin_discipline_fact":    bin_facts["discipline"],
            "bin_discipline_pct":     self._pct(bin_facts["discipline"]),
            "bin_discipline_result":  self._result(bin_facts["discipline"], 0.30),

            "bin_schedule_summary": submission.bin_schedule_summary or "",
            "bin_schedule_fact":    bin_facts["schedule"],
            "bin_schedule_pct":     self._pct(bin_facts["schedule"]),
            "bin_schedule_result":  self._result(bin_facts["schedule"], 0.10),

            "bin_safety_summary": submission.bin_safety_summary or "",
            "bin_safety_fact":    bin_facts["safety"],
            "bin_safety_pct":     self._pct(bin_facts["safety"]),
            "bin_safety_result":  self._result(bin_facts["safety"], 0.10),

            # Итого
            "total_result":    f"{total_result:.2f}",
            "premium_proposal": f"{total_result:.2f}",

            # Подпись
            "reviewer_title": "Руководитель",
            "reviewer_name":  reviewer_name or "",

            # Мета
            "generated_at": datetime.now(timezone.utc).strftime("%d.%m.%Y"),
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
