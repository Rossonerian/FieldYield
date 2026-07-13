from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator

PRODUCTION_FRONTEND_ORIGIN = "https://field-yield.vercel.app"


class Settings(BaseSettings):
    database_url: str = "sqlite:///./fieldyield.db"
    redis_url: str = "redis://localhost:6379/0"
    secret_key: str = "change-me-in-development"
    access_token_expire_minutes: int = 60
    frontend_url: str = PRODUCTION_FRONTEND_ORIGIN
    signup_bonus_enabled: bool = False
    signup_bonus_gold: int = 100
    signup_bonus_silver: int = 0
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @field_validator("frontend_url")
    @classmethod
    def validate_frontend_url(cls, value: str) -> str:
        normalized = value.rstrip("/")
        if normalized != PRODUCTION_FRONTEND_ORIGIN:
            raise ValueError(f"FRONTEND_URL must be exactly {PRODUCTION_FRONTEND_ORIGIN}")
        return normalized

    @property
    def sqlalchemy_database_url(self) -> str:
        if self.database_url.startswith("postgresql://"):
            return self.database_url.replace("postgresql://", "postgresql+psycopg://", 1)
        return self.database_url


settings = Settings()
