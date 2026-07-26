from sqlalchemy.orm import Session
from sqlalchemy import select

from app.core.database import engine
from app.models import User
from .conftest import auth


def test_admin_endpoints_require_database_role(client):
    headers = auth(client)
    assert client.get("/api/v1/admin/users", headers=headers).status_code == 403

    with Session(engine) as db:
        user = db.scalar(select(User).where(User.email == "test@example.com"))
        user.role = "admin"
        db.commit()

    assert client.get("/api/v1/admin/users", headers=headers).status_code == 200


def test_admin_catalog_import_is_bounded_and_real_data_only(client):
    headers = auth(client)
    with Session(engine) as db:
        user = db.scalar(select(User).where(User.email == "test@example.com"))
        user.role = "admin"
        db.commit()
    response = client.post(
        "/api/v1/admin/catalog/import",
        headers=headers,
        json={"source": "provider-test", "records": [{"symbol": "NEW9", "name": "Imported Player", "league": "EPL", "club": "Imported FC", "bid": 10, "ask": 11}]},
    )
    assert response.status_code == 200
    assert response.json()["created"] == 1
