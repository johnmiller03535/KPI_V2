from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # Redmine
    redmine_url: str
    redmine_api_key: str

    # PostgreSQL
    postgres_host: str = "postgres"
    postgres_port: int = 5432
    postgres_db: str = "kpi_portal"
    postgres_user: str = "kpi_user"
    postgres_password: str

    # JWT
    jwt_secret_key: str
    jwt_access_token_expire_minutes: int = 15
    jwt_refresh_token_expire_days: int = 7

    # Telegram
    telegram_bot_token: Optional[str] = None
    # chat_id финансового блока через запятую, напр. "123456,654321"
    finance_telegram_ids: str = ""

    # Claude
    anthropic_api_key: Optional[str] = None

    # Gemini
    gemini_api_key: Optional[str] = None

    # App
    app_env: str = "development"
    # Comma-separated list of allowed CORS origins, e.g.:
    # "http://localhost,http://localhost:3000,https://myapp.amvera.io"
    frontend_url: str = "http://localhost,http://localhost:3000"
    backend_url: str = "http://localhost:8000"

    @property
    def cors_origins(self) -> list[str]:
        """Список разрешённых CORS origins (разделитель — запятая)."""
        return [o.strip() for o in self.frontend_url.split(",") if o.strip()]

    @property
    def finance_chat_ids(self) -> list[str]:
        """Список chat_id для уведомлений финансового блока."""
        if not self.finance_telegram_ids:
            return []
        return [x.strip() for x in self.finance_telegram_ids.split(",") if x.strip()]

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def database_url_sync(self) -> str:
        return (
            f"postgresql://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    class Config:
        env_file = ".env"
        case_sensitive = False

settings = Settings()
