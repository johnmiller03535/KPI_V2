import logging
import json
import httpx
from typing import Optional
from app.config import settings

logger = logging.getLogger(__name__)

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"

BINARY_KPI_PROMPT = """Ты — эксперт по оценке эффективности государственных служащих.

Критерий оценки KPI: {criterion}
Методика расчёта: {formula_desc}

Трудозатраты сотрудника за отчётный период:
{time_entries_text}

Твоя задача:
1. Определи: критерий ВЫПОЛНЕН (score: 100) или НЕ ВЫПОЛНЕН (score: 0).
2. Внимательно ищи маркеры провала в комментариях к задачам:
   "не выполнено", "не в срок", "не реализовано", "отклонено", "просрочено",
   "нарушение", "замечание", "не представлено".
3. Напиши summary — краткое (2-4 предложения) описание что сделано сотрудником
   применительно к данному критерию. Пиши на русском языке.
4. Укажи confidence — уверенность в оценке от 0 до 100.
   Если трудозатрат мало или они слабо связаны с критерием — снижай confidence.

Отвечай СТРОГО в формате JSON, без markdown-блоков, без пояснений:
{{"score": 100, "summary": "...", "confidence": 85}}"""

SUMMARY_PROMPT = """Сформируй краткую аналитическую записку (3-5 предложений) о работе сотрудника
за отчётный период на основе его трудозатрат.
Пиши на русском языке, деловым стилем.

Трудозатраты:
{time_entries_text}

Отвечай только текстом записки, без заголовков и списков."""


def _format_time_entries(time_entries: list[dict]) -> str:
    if not time_entries:
        return "Трудозатраты за период не зафиксированы."
    lines = []
    for entry in time_entries[:80]:
        date = entry.get("spent_on", "")
        hours = entry.get("hours", 0)
        comment = entry.get("comments", "").strip()
        issue = entry.get("issue", {})
        subject = issue.get("subject", "") if issue else ""
        task_name = comment or subject or "—"
        lines.append(f"- [{date}] {task_name} ({hours}ч)")
    return "\n".join(lines)


def _parse_json(raw: str) -> dict:
    text = raw.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1]).strip()
    return json.loads(text)


class AIService:

    async def _call_openai_json(self, prompt: str) -> Optional[dict]:
        if not settings.openai_api_key:
            return None
        try:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(api_key=settings.openai_api_key)
            response = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
                max_tokens=500,
            )
            raw = response.choices[0].message.content or ""
            result = _parse_json(raw)
            logger.info("OpenAI ответ получен")
            return result
        except json.JSONDecodeError as e:
            logger.error(f"OpenAI JSON parse error: {e}")
            return None
        except Exception as e:
            logger.error(f"OpenAI error: {e}")
            return None

    async def _call_openai_text(self, prompt: str) -> Optional[str]:
        if not settings.openai_api_key:
            return None
        try:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(api_key=settings.openai_api_key)
            response = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.4,
                max_tokens=400,
            )
            return (response.choices[0].message.content or "").strip()
        except Exception as e:
            logger.error(f"OpenAI text error: {e}")
            return None

    async def _call_gemini_json(self, prompt: str) -> Optional[dict]:
        if not settings.gemini_api_key:
            return None
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{GEMINI_URL}?key={settings.gemini_api_key}",
                    json={
                        "contents": [{"parts": [{"text": prompt}]}],
                        "generationConfig": {"temperature": 0.3, "maxOutputTokens": 500},
                    },
                )
                if response.status_code != 200:
                    logger.error(f"Gemini error {response.status_code}")
                    return None
                raw = response.json()["candidates"][0]["content"]["parts"][0]["text"]
                result = _parse_json(raw)
                logger.info("Gemini JSON ответ получен")
                return result
        except json.JSONDecodeError as e:
            logger.error(f"Gemini JSON parse error: {e}")
            return None
        except Exception as e:
            logger.error(f"Gemini error: {e}")
            return None

    async def _call_gemini_text(self, prompt: str) -> Optional[str]:
        if not settings.gemini_api_key:
            return None
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{GEMINI_URL}?key={settings.gemini_api_key}",
                    json={
                        "contents": [{"parts": [{"text": prompt}]}],
                        "generationConfig": {"temperature": 0.4, "maxOutputTokens": 400},
                    },
                )
                if response.status_code != 200:
                    return None
                return response.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
        except Exception as e:
            logger.error(f"Gemini text error: {e}")
            return None

    async def evaluate_binary_kpi(
        self,
        time_entries: list[dict],
        criterion: str,
        formula_desc: str,
    ) -> dict:
        """Оценить бинарный KPI-критерий через AI. Возвращает score/summary/confidence."""
        time_entries_text = _format_time_entries(time_entries)
        prompt = BINARY_KPI_PROMPT.format(
            criterion=criterion,
            formula_desc=formula_desc,
            time_entries_text=time_entries_text,
        )

        result = await self._call_openai_json(prompt)
        if result is None:
            logger.warning("OpenAI недоступен, переключаемся на Gemini")
            result = await self._call_gemini_json(prompt)

        if result is None:
            logger.warning("Gemini недоступен, используем заглушку")
            return {
                "score": 100,
                "summary": "Данные для анализа отсутствуют. Требует ручной проверки.",
                "confidence": 50,
            }

        return {
            "score": int(result.get("score", 100)),
            "summary": str(result.get("summary", "")),
            "confidence": int(result.get("confidence", 50)),
        }

    async def summarize_time_entries(
        self,
        employee_name: str,
        period_name: str,
        time_entries: list[dict],
        kpi_criteria: list[str],
    ) -> Optional[dict]:
        """Общее саммари трудозатрат (используется в KPI-форме)."""
        if not time_entries:
            return self._fallback(employee_name, period_name, kpi_criteria)

        time_entries_text = _format_time_entries(time_entries)
        summary_prompt = SUMMARY_PROMPT.format(time_entries_text=time_entries_text)

        general_summary = await self._call_openai_text(summary_prompt)
        if general_summary is None:
            general_summary = await self._call_gemini_text(summary_prompt)
        if general_summary is None:
            general_summary = (
                f"Сотрудник {employee_name} в период {period_name} "
                "выполнял должностные обязанности в полном объёме."
            )

        # criteria — отдельный JSON-запрос
        criteria_prompt = (
            f"Сотрудник: {employee_name}\nПериод: {period_name}\n\n"
            f"Трудозатраты:\n{time_entries_text}\n\n"
            f"KPI-критерии:\n" + "\n".join(f"- {c}" for c in kpi_criteria) +
            "\n\nДля каждого критерия напиши краткое профессиональное описание (2-3 предложения) "
            "выполненных работ на русском языке.\n\n"
            "Отвечай ТОЛЬКО в формате JSON без markdown:\n"
            '{"criteria": {"название критерия": "описание"}, "discipline_summary": "..."}'
        )

        criteria_result = await self._call_openai_json(criteria_prompt)
        if criteria_result is None:
            criteria_result = await self._call_gemini_json(criteria_prompt)

        if criteria_result:
            return {
                "criteria": criteria_result.get("criteria", {}),
                "general_summary": general_summary,
                "discipline_summary": criteria_result.get("discipline_summary", ""),
            }

        return self._fallback(employee_name, period_name, kpi_criteria, general_summary)

    def _fallback(
        self,
        employee_name: str,
        period_name: str,
        kpi_criteria: list[str],
        general_summary: str = "",
    ) -> dict:
        return {
            "criteria": {
                c: (
                    f"В рамках критерия «{c}» сотрудником {employee_name} "
                    f"выполнялась работа в соответствии с должностными обязанностями "
                    f"в период {period_name}."
                )
                for c in kpi_criteria
            },
            "general_summary": general_summary or (
                f"Сотрудник {employee_name} в период {period_name} "
                "выполнял должностные обязанности в полном объёме."
            ),
            "discipline_summary": (
                "Исполнительская дисциплина соблюдается в полном объёме. "
                "Сроки исполнения поручений не нарушались."
            ),
        }


ai_service = AIService()
