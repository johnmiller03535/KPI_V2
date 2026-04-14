import httpx
from typing import Optional
from app.config import settings

class RedmineClient:
    def __init__(self):
        self.base_url = settings.redmine_url
        self.api_key = settings.redmine_api_key

    async def verify_credentials(self, login: str, password: str) -> Optional[dict]:
        """
        Проверяет логин/пароль через Redmine API.
        Возвращает данные пользователя или None если неверные данные.
        """
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

    async def get_user_by_id(self, user_id: int) -> Optional[dict]:
        """Получает данные пользователя по ID через admin API key."""
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                response = await client.get(
                    f"{self.base_url}/users/{user_id}.json",
                    headers={"X-Redmine-API-Key": self.api_key},
                )
                if response.status_code == 200:
                    return response.json().get("user")
                return None
            except httpx.RequestError:
                return None

redmine_client = RedmineClient()
