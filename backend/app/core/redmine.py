import asyncio
import logging
import warnings
import httpx
from typing import Optional
from app.config import settings

warnings.filterwarnings('ignore', message='Unverified HTTPS request')

logger = logging.getLogger(__name__)

class RedmineClient:
    def __init__(self):
        self.base_url = settings.redmine_url
        self.api_key = settings.redmine_api_key

    def _headers(self) -> dict:
        return {"X-Redmine-API-Key": self.api_key}

    async def verify_credentials(self, login: str, password: str) -> Optional[dict]:
        async with httpx.AsyncClient(timeout=10.0, verify=False) as client:
            try:
                response = await client.get(
                    f"{self.base_url}/users/current.json",
                    auth=(login, password),
                )
                if response.status_code == 200:
                    return response.json().get("user")
                return None
            except httpx.RequestError:
                return None

    async def get_all_users(self) -> list[dict]:
        """
        Получает всех активных пользователей Redmine постранично.
        Требует admin API key.
        """
        users = []
        offset = 0
        limit = 100
        async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
            while True:
                try:
                    response = await client.get(
                        f"{self.base_url}/users.json",
                        headers=self._headers(),
                        params={"status": 1, "limit": limit, "offset": offset},
                    )
                    if response.status_code != 200:
                        break
                    data = response.json()
                    batch = data.get("users", [])
                    users.extend(batch)
                    total = data.get("total_count", 0)
                    offset += limit
                    if offset >= total:
                        break
                except httpx.RequestError:
                    break
        return users

    async def get_user_detail(self, user_id: int) -> Optional[dict]:
        """
        Получает детали пользователя включая кастомные поля.
        """
        async with httpx.AsyncClient(timeout=10.0, verify=False) as client:
            try:
                response = await client.get(
                    f"{self.base_url}/users/{user_id}.json",
                    headers=self._headers(),
                    params={"include": "memberships,groups"},
                )
                if response.status_code == 200:
                    return response.json().get("user")
                return None
            except httpx.RequestError:
                return None

    async def get_project_memberships(self, project_id: str) -> list[dict]:
        """Получает участников KPI-проекта."""
        async with httpx.AsyncClient(timeout=15.0, verify=False) as client:
            try:
                response = await client.get(
                    f"{self.base_url}/projects/{project_id}/memberships.json",
                    headers=self._headers(),
                    params={"limit": 100},
                )
                if response.status_code == 200:
                    return response.json().get("memberships", [])
                return []
            except httpx.RequestError:
                return []

    async def create_issue(self, project_id: str, subject: str, description: str,
                           tracker_id: int, assigned_to_id: int,
                           custom_fields: list[dict]) -> Optional[dict]:
        """Создаёт задачу в Redmine."""
        payload = {
            "issue": {
                "project_id": project_id,
                "subject": subject,
                "description": description,
                "tracker_id": tracker_id,
                "assigned_to_id": assigned_to_id,
                "custom_fields": custom_fields,
            }
        }
        async with httpx.AsyncClient(timeout=15.0, verify=False) as client:
            try:
                response = await client.post(
                    f"{self.base_url}/issues.json",
                    headers={**self._headers(), "Content-Type": "application/json"},
                    json=payload,
                )
                if response.status_code == 201:
                    return response.json().get("issue")
                logger.error(f"Redmine create_issue error {response.status_code}: {response.text}")
                return None
            except httpx.RequestError as e:
                logger.error(f"Redmine create_issue request error: {e}")
                return None

    async def get_issue(self, issue_id: int) -> Optional[dict]:
        """Получает задачу по ID."""
        async with httpx.AsyncClient(timeout=10.0, verify=False) as client:
            try:
                response = await client.get(
                    f"{self.base_url}/issues/{issue_id}.json",
                    headers=self._headers(),
                )
                if response.status_code == 200:
                    return response.json().get("issue")
                return None
            except httpx.RequestError:
                return None

    async def _fetch_issue_subject(self, client: httpx.AsyncClient, issue_id: int) -> tuple[int, str]:
        """Запрашивает subject одной задачи. Возвращает (issue_id, subject)."""
        try:
            resp = await client.get(
                f"{self.base_url}/issues/{issue_id}.json",
                headers=self._headers(),
            )
            if resp.status_code == 200:
                return issue_id, resp.json().get("issue", {}).get("subject", "")
        except Exception:
            pass
        return issue_id, ""

    async def get_time_entries(self, user_id: int,
                               date_from: str, date_to: str,
                               limit: int = 200) -> list[dict]:
        """
        Получает трудозатраты пользователя за период.
        date_from, date_to — формат 'YYYY-MM-DD'
        Возвращает список записей с полями: hours, comments, spent_on, activity, issue
        issue.subject обогащается отдельными запросами (Redmine не отдаёт subject в time_entries).
        """
        async with httpx.AsyncClient(timeout=20.0, verify=False) as client:
            try:
                params = {
                    "user_id": user_id,
                    "from": date_from,
                    "to": date_to,
                    "limit": limit,
                }
                logger.info(f"get_time_entries: user_id={user_id} from={date_from} to={date_to}")
                response = await client.get(
                    f"{self.base_url}/time_entries.json",
                    headers=self._headers(),
                    params=params,
                )
                if response.status_code != 200:
                    logger.error(f"get_time_entries HTTP {response.status_code}: {response.text[:200]}")
                    return []

                entries = response.json().get("time_entries", [])
                logger.info(f"get_time_entries: получено {len(entries)} записей")

                # ── Обогащение: подгружаем subject для каждой уникальной задачи ──
                issue_ids = list({
                    e["issue"]["id"]
                    for e in entries
                    if e.get("issue") and e["issue"].get("id")
                })
                if issue_ids:
                    results = await asyncio.gather(
                        *[self._fetch_issue_subject(client, iid) for iid in issue_ids]
                    )
                    subjects: dict[int, str] = dict(results)
                    logger.info(f"get_time_entries: обогащено {len(subjects)} задач subject-ами")

                    for entry in entries:
                        issue = entry.get("issue")
                        if issue and issue.get("id"):
                            issue["subject"] = subjects.get(issue["id"], "")

                return entries

            except httpx.RequestError as e:
                logger.error(f"get_time_entries request error: {e}")
                return []

    async def get_user_issues(self, assigned_to_id: int, project_id: str,
                              tracker_id: Optional[int] = None) -> list[dict]:
        """Получает задачи пользователя в проекте."""
        params = {
            "project_id": project_id,
            "assigned_to_id": assigned_to_id,
            "limit": 100,
        }
        if tracker_id:
            params["tracker_id"] = tracker_id

        async with httpx.AsyncClient(timeout=15.0, verify=False) as client:
            try:
                response = await client.get(
                    f"{self.base_url}/issues.json",
                    headers=self._headers(),
                    params=params,
                )
                if response.status_code == 200:
                    return response.json().get("issues", [])
                return []
            except httpx.RequestError:
                return []

    async def get_trackers(self) -> dict[str, int]:
        """Возвращает словарь {tracker_name: tracker_id} из Redmine."""
        async with httpx.AsyncClient(timeout=10.0, verify=False) as client:
            try:
                response = await client.get(
                    f"{self.base_url}/trackers.json",
                    headers=self._headers(),
                )
                if response.status_code == 200:
                    trackers = response.json().get("trackers", [])
                    return {t["name"]: t["id"] for t in trackers}
                logger.warning(f"get_trackers: status {response.status_code}")
                return {}
            except httpx.RequestError as e:
                logger.error(f"get_trackers request error: {e}")
                return {}

    async def upload_file(self, file_bytes: bytes, filename: str) -> dict:
        """POST /uploads.json — загрузить файл, получить token."""
        async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
            response = await client.post(
                f"{self.base_url}/uploads.json",
                headers={**self._headers(), "Content-Type": "application/octet-stream"},
                content=file_bytes,
                params={"filename": filename},
            )
            response.raise_for_status()
            return response.json()

    async def attach_to_issue(self, issue_id: int, token: str,
                               filename: str, content_type: str) -> None:
        """PUT /issues/{id}.json — прикрепить загруженный файл к задаче."""
        async with httpx.AsyncClient(timeout=15.0, verify=False) as client:
            response = await client.put(
                f"{self.base_url}/issues/{issue_id}.json",
                headers={**self._headers(), "Content-Type": "application/json"},
                json={
                    "issue": {
                        "uploads": [{
                            "token": token,
                            "filename": filename,
                            "content_type": content_type,
                        }]
                    }
                },
            )
            if response.status_code not in (200, 204):
                logger.error(f"attach_to_issue error {response.status_code}: {response.text[:200]}")


redmine_client = RedmineClient()
