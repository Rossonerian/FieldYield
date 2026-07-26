from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Literal
from pydantic import field_validator

PRODUCTION_FRONTEND_ORIGIN = "https://field-yield.vercel.app"


class Settings(BaseSettings):
    database_url: str = "sqlite:///./fieldyield.db"
    redis_url: str = "redis://localhost:6379/0"
    secret_key: str = "change-me-in-development"
    access_token_expire_minutes: int = 60
    # Supabase is the production authority.  The local JWT path is retained
    # only for explicitly configured local/test environments.
    auth_provider: Literal["supabase", "local"] = "local"
    frontend_url: str = PRODUCTION_FRONTEND_ORIGIN
    signup_bonus_enabled: bool = True
    signup_bonus_gold: int = 100
    signup_bonus_silver: int = 0
    market_engine_base_url: str | None = None
    market_engine_api_key: str | None = None
    market_engine_timeout_ms: int = 3000
    market_engine_version: str = "v1"
    supabase_url: str | None = None
    supabase_anon_key: str | None = None
    supabase_service_role_key: str | None = None
    admin_emails: str = ""
    allow_test_credit: bool = False
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

    @property
    def configured_admin_emails(self) -> set[str]:
        return {email.strip().lower() for email in self.admin_emails.split(",") if email.strip()}

    @property
    def supabase_configured(self) -> bool:
        return bool(self.supabase_url and self.supabase_anon_key)

    @property
    def effective_auth_provider(self) -> Literal["supabase", "local"]:
        # This deliberately does not fall back. A production deployment with
        # AUTH_PROVIDER=supabase but missing Supabase credentials fails closed
        # instead of silently accepting local JWTs.
        return self.auth_provider


settings = Settings()
