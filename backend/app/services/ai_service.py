import logging
import json
from typing import Optional
from anthropic import AsyncAnthropic
from app.config import settings

logger = logging.getLogger(__name__)


class AIService:
    def __init__(self):
        self.client = AsyncAnthropic(api_key=settings.anthropic_api_key)

    async def summarize_time_entries(
        self,
        employee_name: str,
        period_name: str,
        time_entries: list[dict],
        kpi_criteria: list[str],
    ) -> Optional[dict]:
        """
        Анализирует трудозатраты сотрудника и распределяет по KPI-критериям.

        kpi_criteria — список критериев, напр.:
        ["Обеспечение проектной деятельности",
         "Обеспечение бизнес-анализа",
         "Обеспечение аналитической деятельности"]

        Возвращает dict:
        {
            "criteria": {
                "Обеспечение проектной деятельности": "текст саммари",
                ...
            },
            "general_summary": "общее описание работы",
            "discipline_summary": "описание для KPI дисциплины",
        }
        """
        if not time_entries:
            return {
                "criteria": {c: "Трудозатраты за период не найдены." for c in kpi_criteria},
                "general_summary": "Трудозатраты за период не найдены.",
                "discipline_summary": "Данные о выполненных задачах за период отсутствуют.",
            }

        # Формируем список выполненных задач (только описания, без часов)
        tasks_text = []
        for entry in time_entries:
            comment = entry.get("comments", "").strip()
            issue = entry.get("issue", {})
            issue_subject = issue.get("subject", "") if issue else ""
            spent_on = entry.get("spent_on", "")

            if comment:
                tasks_text.append(f"- {spent_on}: {comment}")
            elif issue_subject:
                tasks_text.append(f"- {spent_on}: {issue_subject}")

        tasks_joined = "\n".join(tasks_text[:100])  # не более 100 записей
        criteria_joined = "\n".join(f"- {c}" for c in kpi_criteria)

        prompt = f"""Ты помощник для формирования KPI-отчётов государственного учреждения.

Сотрудник: {employee_name}
Период: {period_name}

Выполненные работы (из системы учёта трудозатрат):
{tasks_joined}

KPI-критерии сотрудника:
{criteria_joined}

Задача:
1. Проанализируй список выполненных работ
2. Распредели работы по KPI-критериям
3. Для каждого критерия напиши краткое профессиональное описание (2-4 предложения) \
что конкретно было сделано в рамках этого критерия
4. Напиши общее саммари работы (3-5 предложений)
5. Напиши описание для критерия исполнительской дисциплины (своевременность, \
качество выполнения поручений)

Отвечай ТОЛЬКО в формате JSON, без markdown-блоков, без пояснений:
{{
  "criteria": {{
    "название критерия 1": "описание работ по этому критерию",
    "название критерия 2": "описание работ по этому критерию"
  }},
  "general_summary": "общее описание",
  "discipline_summary": "описание исполнительской дисциплины"
}}"""

        try:
            response = await self.client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=2000,
                messages=[{"role": "user", "content": prompt}],
            )

            raw_text = response.content[0].text.strip()

            # Убираем возможные markdown-блоки
            if raw_text.startswith("```"):
                lines = raw_text.split("\n")
                raw_text = "\n".join(lines[1:-1])

            result = json.loads(raw_text)
            return result

        except json.JSONDecodeError as e:
            logger.error(f"AI response JSON parse error: {e}")
            return None
        except Exception as e:
            logger.error(f"AI service error: {e}")
            return None


ai_service = AIService()
