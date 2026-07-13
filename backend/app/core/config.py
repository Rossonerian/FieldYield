from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator


class Settings(BaseSettings):
    database_url: str = "sqlite:///./fieldyield.db"
    redis_url: str = "redis://localhost:6379/0"
    secret_key: str = "change-me-in-development"
    access_token_expire_minutes: int = 60
    frontend_url: str
    signup_bonus_enabled: bool = False
    signup_bonus_gold: int = 100
    signup_bonus_silver: int = 0
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @field_validator("frontend_url")
    @classmethod
    def validate_frontend_url(cls, value: str) -> str:
        normalized = value.rstrip("/")
        if not normalized.startswith("https://"):
            raise ValueError("FRONTEND_URL must be the production HTTPS Vercel origin")
        blocked_hosts = ("localhost", "127.0.0.1", "0.0.0.0")
        host = normalized.removeprefix("https://").split("/", 1)[0].split(":", 1)[0]
        if host in blocked_hosts or host.endswith(".local"):
            raise ValueError("FRONTEND_URL cannot be a local or development origin")
        return normalized

    @property
    def sqlalchemy_database_url(self) -> str:
        if self.database_url.startswith("postgresql://"):
            return self.database_url.replace("postgresql://", "postgresql+psycopg://", 1)
        return self.database_url


settings = Settings()
