import logging
import json
import time
import uuid
import httpx
from app.config import settings

logger = logging.getLogger(__name__)


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


# ─── GigaChat ────────────────────────────────────────────────────────────────

class GigaChatProvider:
    _token: str = ""
    _expires_at: float = 0.0

    async def _get_token(self) -> str:
        if self._token and self._expires_at > time.time() + 60:
            return self._token
        async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
            resp = await client.post(
                "https://ngw.devices.sberbank.ru:9443/api/v2/oauth",
                headers={
                    "Authorization": f"Basic {settings.gigachat_api_key}",
                    "Content-Type": "application/x-www-form-urlencoded",
                    "RqUID": str(uuid.uuid4()),
                },
                data="scope=GIGACHAT_API_PERS",
            )
            resp.raise_for_status()
            data = resp.json()
            GigaChatProvider._token = data["access_token"]
            GigaChatProvider._expires_at = float(data.get("expires_at", time.time() + 1800))
            return GigaChatProvider._token

    async def complete(self, prompt: str) -> str:
        token = await self._get_token()
        async with httpx.AsyncClient(timeout=60.0, verify=False) as client:
            resp = await client.post(
                "https://gigachat.devices.sberbank.ru/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "GigaChat",
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 1000,
                },
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"]


# ─── YandexGPT ───────────────────────────────────────────────────────────────

class YandexGPTProvider:

    async def complete(self, prompt: str) -> str:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                "https://llm.api.cloud.yandex.net/foundationModels/v1/completion",
                headers={
                    "Authorization": f"Api-Key {settings.yandex_api_key}",
                    "x-folder-id": settings.yandex_folder_id,
                    "Content-Type": "application/json",
                },
                json={
                    "modelUri": f"gpt://{settings.yandex_folder_id}/yandexgpt-lite",
                    "completionOptions": {
                        "stream": False,
                        "temperature": 0.3,
                        "maxTokens": 1000,
                    },
                    "messages": [{"role": "user", "text": prompt}],
                },
            )
            resp.raise_for_status()
            return resp.json()["result"]["alternatives"][0]["message"]["text"]


# ─── AIService ───────────────────────────────────────────────────────────────

class AIService:

    async def _call_ai(self, prompt: str) -> str:
        if settings.gigachat_api_key:
            try:
                result = await GigaChatProvider().complete(prompt)
                logger.info("GigaChat ответ получен")
                return result
            except Exception as e:
                logger.warning(f"GigaChat недоступен: {e}, переключаемся на YandexGPT")

        if settings.yandex_api_key and settings.yandex_folder_id:
            try:
                result = await YandexGPTProvider().complete(prompt)
                logger.info("YandexGPT ответ получен")
                return result
            except Exception as e:
                logger.warning(f"YandexGPT недоступен: {e}, используем заглушку")

        raise Exception("Все провайдеры недоступны")

    async def evaluate_binary_kpi(
        self,
        time_entries: list[dict],
        criterion: str,
        formula_desc: str,
    ) -> dict:
        """Оценить бинарный KPI-критерий через AI. Возвращает score/summary/confidence."""
        if time_entries:
            entries_text = "\n".join([
                f"- {e.get('spent_on', '')} {e.get('issue', {}).get('subject', 'Задача')}: "
                f"{e.get('comments', 'без комментария')} ({e.get('hours', 0)}ч)"
                for e in time_entries
            ])
        else:
            entries_text = "Трудозатраты за период не зафиксированы."

        prompt = f"""Ты — эксперт по оценке эффективности государственных служащих.

Критерий оценки KPI: {criterion}
Методика расчёта: {formula_desc}

Трудозатраты сотрудника за отчётный период:
{entries_text}

Твоя задача:
1. Определи: критерий ВЫПОЛНЕН (score: 100) или НЕ ВЫПОЛНЕН (score: 0).
2. Ищи маркеры провала в комментариях: "не выполнено", "не в срок", \
"не реализовано", "отклонено", "просрочено", "нарушение", "замечание".
3. Напиши summary — краткое (2-4 предложения) описание что сделано \
применительно к данному критерию. Пиши на русском языке.
4. Укажи confidence — уверенность в оценке от 0 до 100.
   Если трудозатрат мало или они слабо связаны с критерием — снижай confidence.

Отвечай СТРОГО в формате JSON без markdown-блоков:
{{"score": 100, "summary": "...", "confidence": 85}}"""

        try:
            response = await self._call_ai(prompt)
            clean = response.strip()
            if clean.startswith("```"):
                clean = clean.split("```")[1]
                if clean.startswith("json"):
                    clean = clean[4:]
            data = json.loads(clean.strip())
            return {
                "score": int(data.get("score", 100)),
                "summary": str(data.get("summary", "")),
                "confidence": int(data.get("confidence", 50)),
            }
        except Exception as e:
            logger.error(f"evaluate_binary_kpi error: {e}")
            return {
                "score": 100,
                "summary": "Данные для анализа отсутствуют. Требует ручной проверки.",
                "confidence": 50,
            }

    async def summarize_time_entries(self, time_entries: list[dict]) -> str:
        """Общее саммари по трудозатратам."""
        if not time_entries:
            return "Трудозатраты за период не зафиксированы."

        entries_text = "\n".join([
            f"- {e.get('spent_on', '')} {e.get('issue', {}).get('subject', 'Задача')}: "
            f"{e.get('comments', '')} ({e.get('hours', 0)}ч)"
            for e in time_entries
        ])

        prompt = f"""Сформируй краткую аналитическую записку (3-5 предложений) \
о работе сотрудника за отчётный период на основе его трудозатрат.
Пиши на русском языке, деловым стилем, без заголовков и списков.

Трудозатраты:
{entries_text}"""

        try:
            return await self._call_ai(prompt)
        except Exception:
            return "Сотрудник выполнял должностные обязанности в соответствии с планом работы."


ai_service = AIService()
