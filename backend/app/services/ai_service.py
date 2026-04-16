import logging
import json
import httpx
from typing import Optional
from app.config import settings

logger = logging.getLogger(__name__)

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"


class AIService:

    async def summarize_time_entries(
        self,
        employee_name: str,
        period_name: str,
        time_entries: list[dict],
        kpi_criteria: list[str],
    ) -> Optional[dict]:

        if not time_entries:
            return self._fallback(employee_name, period_name, kpi_criteria)

        tasks_text = []
        for entry in time_entries[:80]:
            comment = entry.get("comments", "").strip()
            issue = entry.get("issue", {})
            issue_subject = issue.get("subject", "") if issue else ""
            spent_on = entry.get("spent_on", "")
            if comment:
                tasks_text.append(f"- {spent_on}: {comment}")
            elif issue_subject:
                tasks_text.append(f"- {spent_on}: {issue_subject}")

        tasks_joined = "\n".join(tasks_text) if tasks_text else "Нет описаний задач"
        criteria_joined = "\n".join(f"- {c}" for c in kpi_criteria)

        prompt = f"""Ты помощник для формирования KPI-отчётов государственного учреждения.

Сотрудник: {employee_name}
Период: {period_name}

Выполненные работы:
{tasks_joined}

KPI-критерии:
{criteria_joined}

Задача: для каждого критерия напиши краткое профессиональное описание (2-3 предложения) выполненных работ.
Также напиши общее саммари и описание исполнительской дисциплины.

Отвечай ТОЛЬКО в формате JSON без markdown-блоков и без пояснений:
{{
  "criteria": {{
    "название критерия": "описание работ"
  }},
  "general_summary": "общее описание",
  "discipline_summary": "описание дисциплины"
}}"""

        if not settings.gemini_api_key:
            logger.warning("GEMINI_API_KEY не задан — используем заглушку")
            return self._fallback(employee_name, period_name, kpi_criteria)

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{GEMINI_URL}?key={settings.gemini_api_key}",
                    json={
                        "contents": [{"parts": [{"text": prompt}]}],
                        "generationConfig": {
                            "temperature": 0.3,
                            "maxOutputTokens": 2000,
                        },
                    },
                )

                if response.status_code != 200:
                    logger.error(f"Gemini error {response.status_code}: {response.text}")
                    return self._fallback(employee_name, period_name, kpi_criteria)

                data = response.json()
                raw_text = data["candidates"][0]["content"]["parts"][0]["text"].strip()

                if raw_text.startswith("```"):
                    lines = raw_text.split("\n")
                    raw_text = "\n".join(lines[1:-1])

                result = json.loads(raw_text)
                logger.info(f"Gemini саммари сгенерировано для {employee_name}")
                return result

        except json.JSONDecodeError as e:
            logger.error(f"Gemini JSON parse error: {e}, raw: {raw_text[:200]}")
            return self._fallback(employee_name, period_name, kpi_criteria)
        except Exception as e:
            logger.error(f"Gemini error: {e}")
            return self._fallback(employee_name, period_name, kpi_criteria)

    def _fallback(self, employee_name: str, period_name: str, kpi_criteria: list[str]) -> dict:
        return {
            "criteria": {
                c: (
                    f"В рамках критерия «{c}» сотрудником {employee_name} "
                    f"выполнялась работа в соответствии с должностными обязанностями "
                    f"в период {period_name}."
                )
                for c in kpi_criteria
            },
            "general_summary": (
                f"Сотрудник {employee_name} в период {period_name} выполнял "
                f"должностные обязанности в полном объёме."
            ),
            "discipline_summary": (
                "Исполнительская дисциплина соблюдается в полном объёме. "
                "Сроки исполнения поручений не нарушались."
            ),
        }


ai_service = AIService()
