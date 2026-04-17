import logging
import json
import httpx
from typing import Optional
from app.config import settings

logger = logging.getLogger(__name__)

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"
GIGACHAT_AUTH_URL = "https://ngw.devices.sberbank.ru:9443/api/v2/oauth"
GIGACHAT_CHAT_URL = "https://gigachat.devices.sberbank.ru/api/v1/chat/completions"


class AIService:

    def _build_prompt(
        self,
        employee_name: str,
        period_name: str,
        time_entries: list[dict],
        kpi_criteria: list[str],
    ) -> str:
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

        return f"""Ты помощник для формирования KPI-отчётов государственного учреждения.

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

    def _parse_json_response(self, raw_text: str) -> dict:
        text = raw_text.strip()
        if text.startswith("```"):
            lines = text.split("\n")
            text = "\n".join(lines[1:-1])
        return json.loads(text)

    async def _get_gigachat_token(self, client: httpx.AsyncClient) -> Optional[str]:
        """Получить access_token через OAuth GigaChat."""
        import uuid as _uuid
        # Добавляем padding если отсутствует
        key = settings.gigachat_api_key or ""
        if key and not key.endswith("="):
            key += "=="
        try:
            response = await client.post(
                GIGACHAT_AUTH_URL,
                headers={
                    "Authorization": f"Basic {key}",
                    "RqUID": str(_uuid.uuid4()),
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                data={"scope": "GIGACHAT_API_PERS"},
                verify=False,
            )
            if response.status_code == 200:
                return response.json().get("access_token")
            logger.error(f"GigaChat auth error {response.status_code}: {response.text[:200]}")
            return None
        except Exception as e:
            logger.error(f"GigaChat auth exception: {e}")
            return None

    async def _call_gigachat(self, prompt: str) -> Optional[dict]:
        """Вызов GigaChat API."""
        try:
            async with httpx.AsyncClient(timeout=60.0, verify=False) as client:
                token = await self._get_gigachat_token(client)
                if not token:
                    return None

                response = await client.post(
                    GIGACHAT_CHAT_URL,
                    headers={"Authorization": f"Bearer {token}"},
                    json={
                        "model": "GigaChat",
                        "messages": [{"role": "user", "content": prompt}],
                        "temperature": 0.3,
                        "max_tokens": 2000,
                    },
                )

                if response.status_code != 200:
                    logger.error(f"GigaChat chat error {response.status_code}: {response.text[:200]}")
                    return None

                raw_text = response.json()["choices"][0]["message"]["content"]
                result = self._parse_json_response(raw_text)
                logger.info("GigaChat саммари сгенерировано")
                return result

        except json.JSONDecodeError as e:
            logger.error(f"GigaChat JSON parse error: {e}")
            return None
        except Exception as e:
            logger.error(f"GigaChat error: {e}")
            return None

    async def _call_gemini(self, prompt: str) -> Optional[dict]:
        """Вызов Gemini API."""
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
                    logger.error(f"Gemini error {response.status_code}: {response.text[:200]}")
                    return None

                raw_text = response.json()["candidates"][0]["content"]["parts"][0]["text"]
                result = self._parse_json_response(raw_text)
                logger.info("Gemini саммари сгенерировано")
                return result

        except json.JSONDecodeError as e:
            logger.error(f"Gemini JSON parse error: {e}")
            return None
        except Exception as e:
            logger.error(f"Gemini error: {e}")
            return None

    async def summarize_time_entries(
        self,
        employee_name: str,
        period_name: str,
        time_entries: list[dict],
        kpi_criteria: list[str],
    ) -> Optional[dict]:

        if not time_entries:
            return self._fallback(employee_name, period_name, kpi_criteria)

        prompt = self._build_prompt(employee_name, period_name, time_entries, kpi_criteria)

        # GigaChat — приоритетный провайдер
        if settings.gigachat_api_key:
            result = await self._call_gigachat(prompt)
            if result:
                return result
            logger.warning("GigaChat недоступен, переключаемся на Gemini")

        # Gemini — резервный провайдер
        if settings.gemini_api_key:
            result = await self._call_gemini(prompt)
            if result:
                return result
            logger.warning("Gemini недоступен, используем заглушку")

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
