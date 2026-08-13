from __future__ import annotations

from typing import Literal

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

PRODUCTION_FRONTEND_ORIGIN = "https://field-yield.vercel.app"
DEVELOPMENT_SECRET = "change-me-in-development"


class Settings(BaseSettings):
    app_env: Literal["test", "development", "production"] = "development"
    database_url: str = "sqlite:///./fieldyield.db"
    redis_url: str = "redis://localhost:6379/0"
    secret_key: str = DEVELOPMENT_SECRET
    access_token_expire_minutes: int = 60
    local_jwt_issuer: str = "fieldyield-local"
    local_jwt_audience: str = "fieldyield-api"
    auth_provider: Literal["supabase", "local"] = "local"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    trusted_proxy_ips: str = "127.0.0.1,::1"
    signup_bonus_enabled: bool = True
    signup_bonus_gold: int = 100
    signup_bonus_silver: int = 0
    market_price_max_age_seconds: int = 900
    market_price_future_skew_seconds: int = 60
    max_order_quantity: int = 10_000
    active_squad_capacity: int = 25
    reserve_squad_capacity: int = 15
    request_body_max_bytes: int = 262_144
    catalog_body_max_bytes: int = 1_048_576
    request_timeout_seconds: float = 10.0
    rate_limit_enabled: bool = True
    rate_limit_default: int = 120
    enable_api_docs: bool = True
    database_pool_recycle_seconds: int = 300
    database_connect_timeout_seconds: int = 5
    market_engine_base_url: str | None = None
    market_engine_api_key: str | None = None
    market_engine_timeout_ms: int = 3000
    market_engine_version: str = "v1"
    market_engine_trading_enabled: bool = False
    supabase_url: str | None = None
    supabase_anon_key: str | None = None
    supabase_jwt_audience: str = "authenticated"
    supabase_jwks_cache_seconds: int = 600
    supabase_remote_cache_seconds: int = 30
    supabase_http_timeout_seconds: float = 3.0
    admin_emails: str = ""
    allow_test_credit: bool = False
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @field_validator("cors_origins")
    @classmethod
    def validate_cors_origins(cls, value: str) -> str:
        origins = [origin.strip().rstrip("/") for origin in value.split(",") if origin.strip()]
        if not origins:
            raise ValueError("CORS_ORIGINS must contain at least one explicit origin")
        if any(origin == "*" for origin in origins):
            raise ValueError("CORS_ORIGINS cannot contain a wildcard")
        return ",".join(dict.fromkeys(origins))

    @field_validator(
        "access_token_expire_minutes",
        "market_price_max_age_seconds",
        "market_price_future_skew_seconds",
        "max_order_quantity",
        "request_body_max_bytes",
        "catalog_body_max_bytes",
        "rate_limit_default",
        "database_pool_recycle_seconds",
        "database_connect_timeout_seconds",
        "supabase_jwks_cache_seconds",
        "supabase_remote_cache_seconds",
    )
    @classmethod
    def positive_integer(cls, value: int) -> int:
        if value <= 0:
            raise ValueError("configuration values must be positive")
        return value

    @model_validator(mode="after")
    def validate_environment(self) -> "Settings":
        if self.catalog_body_max_bytes < self.request_body_max_bytes:
            raise ValueError("CATALOG_BODY_MAX_BYTES cannot be smaller than REQUEST_BODY_MAX_BYTES")
        if self.app_env == "production":
            if self.auth_provider != "supabase":
                raise ValueError("Production requires AUTH_PROVIDER=supabase")
            if not self.supabase_configured:
                raise ValueError("Production Supabase authentication is not configured")
            if self.secret_key == DEVELOPMENT_SECRET or len(self.secret_key) < 32:
                raise ValueError("Production SECRET_KEY must be a generated value of at least 32 characters")
            if self.allow_test_credit:
                raise ValueError("ALLOW_TEST_CREDIT cannot be enabled in production")
            if self.cors_origin_list != [PRODUCTION_FRONTEND_ORIGIN]:
                raise ValueError(f"Production CORS_ORIGINS must be exactly {PRODUCTION_FRONTEND_ORIGIN}")
            if not self.redis_url:
                raise ValueError("Production requires REDIS_URL for distributed rate limiting")
            self.enable_api_docs = False
        elif self.auth_provider == "local" and self.app_env not in {"test", "development"}:
            raise ValueError("Local authentication is restricted to test/development")
        if self.market_engine_trading_enabled:
            raise ValueError("External Market Engine settlement is not implemented; MARKET_ENGINE_TRADING_ENABLED must remain false")
        return self

    @property
    def sqlalchemy_database_url(self) -> str:
        if self.database_url.startswith("postgresql://"):
            return self.database_url.replace("postgresql://", "postgresql+psycopg://", 1)
        return self.database_url

    @property
    def configured_admin_emails(self) -> set[str]:
        return {email.strip().lower() for email in self.admin_emails.split(",") if email.strip()}

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin for origin in self.cors_origins.split(",") if origin]

    @property
    def trusted_proxy_ip_set(self) -> set[str]:
        return {address.strip() for address in self.trusted_proxy_ips.split(",") if address.strip()}

    @property
    def supabase_configured(self) -> bool:
        return bool(self.supabase_url and self.supabase_anon_key)

    @property
    def effective_auth_provider(self) -> Literal["supabase", "local"]:
        return self.auth_provider


settings = Settings()
