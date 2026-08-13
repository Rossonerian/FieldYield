import os
from pathlib import Path

os.environ["DATABASE_URL"] = os.environ.get(
    "TEST_DATABASE_URL",
    f"sqlite:///{(Path(__file__).resolve().parents[1] / 'test_fieldyield.db').as_posix()}",
)
os.environ["APP_ENV"] = "test"
os.environ["SECRET_KEY"] = "fieldyield-test-secret-key-at-least-32-bytes"
os.environ["CORS_ORIGINS"] = "https://field-yield.vercel.app"
os.environ["AUTH_PROVIDER"] = "local"
os.environ["ALLOW_TEST_CREDIT"] = "true"
os.environ["RATE_LIMIT_ENABLED"] = "false"
os.environ["SIGNUP_BONUS_ENABLED"] = "false"
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import Base, engine
from app.models import MarketPrice, Player
from decimal import Decimal
from sqlalchemy.orm import Session
import pytest

@pytest.fixture()
def client():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        for symbol, name, price in (("HA9", "Test Player A", Decimal("120.00")), ("SA7", "Test Player B", Decimal("95.00")), ("WI11", "Test Player C", Decimal("88.00"))):
            player = Player(symbol=symbol, name=name, club="Test Club", league="EPL")
            db.add(player)
            db.flush()
            db.add(MarketPrice(player_id=player.id, bid=price - 2, ask=price + 2))
        db.commit()
    with TestClient(app) as c:
        yield c
    Base.metadata.drop_all(engine)

def auth(client):
    client.post("/api/v1/auth/register", json={"email":"test@example.com","password":"password123","date_of_birth":"1990-01-01T00:00:00Z"})
    token = client.post("/api/v1/auth/login", json={"email":"test@example.com","password":"password123"}).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
