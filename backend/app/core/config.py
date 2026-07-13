from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "sqlite:///./fieldyield.db"
    redis_url: str = "redis://localhost:6379/0"
    secret_key: str = "change-me-in-development"
    access_token_expire_minutes: int = 60
    frontend_url: str = "http://localhost:5173"
    bzzoiro_api_key: str | None = None
    bzzoiro_base_url: str = "https://sports.bzzoiro.com"
    bzzoiro_cache_ttl_seconds: int = 300
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def sqlalchemy_database_url(self) -> str:
        if self.database_url.startswith("postgresql://"):
            return self.database_url.replace("postgresql://", "postgresql+psycopg://", 1)
        return self.database_url


settings = Settings()
