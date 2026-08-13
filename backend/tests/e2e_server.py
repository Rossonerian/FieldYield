"""Disposable local API server for the Playwright suite."""

import os
from decimal import Decimal
from pathlib import Path

import uvicorn
from alembic import command
from alembic.config import Config
from sqlalchemy.orm import Session

DATABASE_PATH = Path(__file__).resolve().parents[1] / "test_e2e.db"
DATABASE_PATH.unlink(missing_ok=True)

os.environ.update({
    "APP_ENV": "test",
    "DATABASE_URL": f"sqlite:///{DATABASE_PATH.as_posix()}",
    "SECRET_KEY": "fieldyield-e2e-secret-key-at-least-32-bytes",
    "AUTH_PROVIDER": "local",
    "CORS_ORIGINS": "http://127.0.0.1:4173",
    "ALLOW_TEST_CREDIT": "true",
    "SIGNUP_BONUS_ENABLED": "false",
    "RATE_LIMIT_ENABLED": "false",
})

# The app reads settings during import, so these imports must follow the isolated
# E2E environment above.
from app.core.database import engine  # noqa: E402
from app.models import MarketPrice, Player  # noqa: E402


def setup() -> None:
    command.upgrade(Config("alembic.ini"), "head")
    with Session(engine) as db:
        player = Player(symbol="HA9", name="E2E Player", club="Test FC", league="EPL")
        db.add(player)
        db.flush()
        db.add(MarketPrice(player_id=player.id, bid=Decimal("120"), ask=Decimal("122"), source="e2e-fixture"))
        db.commit()


if __name__ == "__main__":
    setup()
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, log_level="warning")
