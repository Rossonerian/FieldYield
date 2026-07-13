import os
os.environ["DATABASE_URL"] = "sqlite:///./test_fieldyield.db"
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import Base, engine
import pytest

@pytest.fixture()
def client():
    Base.metadata.drop_all(engine); Base.metadata.create_all(engine)
    with TestClient(app) as c: yield c
    Base.metadata.drop_all(engine)

def auth(client):
    client.post("/api/v1/auth/register", json={"email":"test@example.com","password":"password123","date_of_birth":"1990-01-01T00:00:00Z"})
    token = client.post("/api/v1/auth/login", json={"email":"test@example.com","password":"password123"}).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

