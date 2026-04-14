import httpx
from typing import Optional
from app.config import settings

class RedmineClient:
    def __init__(self):
        self.base_url = settings.redmine_url
        self.api_key = settings.redmine_api_key

    def _headers(self) -> dict:
        return {"X-Redmine-API-Key": self.api_key}

    async def verify_credentials(self, login: str, password: str) -> Optional[dict]:
        async with httpx.AsyncClient(timeout=10.0) as client:
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
        async with httpx.AsyncClient(timeout=30.0) as client:
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
        async with httpx.AsyncClient(timeout=10.0) as client:
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
        async with httpx.AsyncClient(timeout=15.0) as client:
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

redmine_client = RedmineClient()
