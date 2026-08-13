from concurrent.futures import ThreadPoolExecutor

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import main as main_module
from app.core.config import settings
from app.core.database import engine
from app.main import app
from app.models import ActiveSquad, AuditLog, Holding, Notification, Order, OrderMatch, SignupBonusGrant, User, Wallet, WalletTransaction
from .conftest import auth

pytestmark = pytest.mark.postgres


def _require_postgres() -> None:
    if engine.dialect.name != "postgresql":
        pytest.skip("PostgreSQL concurrency test")


def _post(path: str, body: dict[str, object], headers: dict[str, str]) -> tuple[int, dict[str, object]]:
    with TestClient(app) as concurrent_client:
        response = concurrent_client.post(path, json=body, headers=headers)
        return response.status_code, response.json()


def _patch(path: str, body: dict[str, object], headers: dict[str, str]) -> tuple[int, dict[str, object]]:
    with TestClient(app) as concurrent_client:
        response = concurrent_client.patch(path, json=body, headers=headers)
        return response.status_code, response.json()


def test_same_idempotency_key_race_executes_once(client):
    _require_postgres()
    headers = auth(client)
    client.post("/api/v1/wallet/credit", json={"currency": "gold", "amount": 1000}, headers=headers)
    payload = {"symbol": "HA9", "quantity": 2, "idempotency_key": "postgres-race"}

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: _post("/api/v1/trading/orders/market-buy", payload, headers), range(2)))

    assert [status for status, _ in results] == [200, 200]
    assert len({body["id"] for _, body in results}) == 1
    with Session(engine) as db:
        user_id = db.scalar(select(User.id).where(User.email == "test@example.com"))
        assert db.scalar(select(func.count(Order.id)).where(Order.user_id == user_id)) == 1
        assert db.scalar(select(func.count(OrderMatch.id)).join(Order).where(Order.user_id == user_id)) == 1
        assert db.scalar(select(Holding.quantity).where(Holding.user_id == user_id)) == 2
        assert db.scalar(select(func.count(WalletTransaction.id)).where(WalletTransaction.user_id == user_id)) == 2
        assert db.scalar(select(func.count(Notification.id)).where(Notification.user_id == user_id)) == 2


def test_concurrent_buys_serialize_one_wallet(client):
    _require_postgres()
    headers = auth(client)
    client.post("/api/v1/wallet/credit", json={"currency": "gold", "amount": 150}, headers=headers)
    bodies = [
        {"symbol": "HA9", "quantity": 1, "idempotency_key": "wallet-a"},
        {"symbol": "HA9", "quantity": 1, "idempotency_key": "wallet-b"},
    ]

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda body: _post("/api/v1/trading/orders/market-buy", body, headers), bodies))

    assert sorted(status for status, _ in results) == [200, 409]
    with Session(engine) as db:
        user_id = db.scalar(select(User.id).where(User.email == "test@example.com"))
        assert db.scalar(select(Wallet.gold).where(Wallet.user_id == user_id)) == 28
        assert db.scalar(select(Holding.quantity).where(Holding.user_id == user_id)) == 1
        assert db.scalar(select(func.count(OrderMatch.id)).join(Order).where(Order.user_id == user_id)) == 1


def test_concurrent_oversells_cannot_create_negative_holding(client):
    _require_postgres()
    headers = auth(client)
    client.post("/api/v1/wallet/credit", json={"currency": "gold", "amount": 500}, headers=headers)
    client.post("/api/v1/trading/orders/market-buy", json={"symbol": "HA9", "quantity": 1}, headers=headers)
    bodies = [
        {"symbol": "HA9", "quantity": 1, "idempotency_key": "sell-a"},
        {"symbol": "HA9", "quantity": 1, "idempotency_key": "sell-b"},
    ]

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda body: _post("/api/v1/trading/orders/market-sell", body, headers), bodies))

    assert sorted(status for status, _ in results) == [200, 409]
    with Session(engine) as db:
        user_id = db.scalar(select(User.id).where(User.email == "test@example.com"))
        assert db.scalar(select(Holding.quantity).where(Holding.user_id == user_id)) == 0


def test_concurrent_promotions_allocate_unique_positions(client):
    _require_postgres()
    headers = auth(client)
    client.post("/api/v1/wallet/credit", json={"currency": "gold", "amount": 1000}, headers=headers)
    for symbol in ("HA9", "SA7"):
        client.post("/api/v1/trading/orders/market-buy", json={"symbol": symbol, "quantity": 1}, headers=headers)

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(
            lambda symbol: _post("/api/v1/squad/promote", {"symbol": symbol}, headers),
            ("HA9", "SA7"),
        ))

    assert [status for status, _ in results] == [200, 200]
    with Session(engine) as db:
        user_id = db.scalar(select(User.id).where(User.email == "test@example.com"))
        positions = db.scalars(select(ActiveSquad.position).where(ActiveSquad.user_id == user_id)).all()
        assert sorted(positions) == [1, 2]


def test_watchlist_duplicate_race_is_controlled(client):
    _require_postgres()
    headers = auth(client)
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(
            lambda _: _post("/api/v1/watchlists", {"symbol": "HA9"}, headers),
            range(2),
        ))
    assert sorted(status for status, _ in results) == [201, 409]


def test_signup_bonus_sync_race_grants_once(client, monkeypatch):
    _require_postgres()
    monkeypatch.setattr(settings, "auth_provider", "supabase")
    monkeypatch.setattr(settings, "supabase_url", "https://project.supabase.co")
    monkeypatch.setattr(settings, "supabase_anon_key", "anon")
    monkeypatch.setattr(settings, "signup_bonus_enabled", True)
    monkeypatch.setattr(settings, "signup_bonus_gold", 100)
    monkeypatch.setattr(settings, "signup_bonus_silver", 50)
    monkeypatch.setattr(
        main_module,
        "supabase_identity",
        lambda _token: {"id": "postgres-sync-race", "email": "sync-race@example.com", "provider": "google"},
    )
    headers = {"Authorization": "Bearer valid"}
    payload = {"date_of_birth": "1990-01-01T00:00:00Z"}

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: _post("/api/v1/auth/supabase-sync", payload, headers), range(2)))

    assert [status for status, _ in results] == [200, 200]
    assert sorted(body["bonus"]["granted_now"] for _, body in results) == [False, True]
    with Session(engine) as db:
        user_id = db.scalar(select(User.id).where(User.auth_provider_id == "postgres-sync-race"))
        assert db.scalar(select(func.count(SignupBonusGrant.id)).where(SignupBonusGrant.user_id == user_id)) == 1
        assert db.scalar(select(func.count(WalletTransaction.id)).where(WalletTransaction.user_id == user_id)) == 2
        wallet = db.scalar(select(Wallet).where(Wallet.user_id == user_id))
        assert wallet.gold == 100
        assert wallet.silver == 50


def test_credit_and_buy_share_deadlock_safe_account_lock_order(client):
    _require_postgres()
    headers = auth(client)
    assert client.post("/api/v1/wallet/credit", json={"currency": "gold", "amount": 500}, headers=headers).status_code == 200
    mutations = [
        ("/api/v1/wallet/credit", {"currency": "gold", "amount": 10, "idempotency_key": "parallel-credit"}),
        ("/api/v1/trading/orders/market-buy", {"symbol": "HA9", "quantity": 1, "idempotency_key": "parallel-buy"}),
    ]

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda mutation: _post(mutation[0], mutation[1], headers), mutations))

    assert [status for status, _ in results] == [200, 200]
    with Session(engine) as db:
        user_id = db.scalar(select(User.id).where(User.email == "test@example.com"))
        assert db.scalar(select(Wallet.gold).where(Wallet.user_id == user_id)) == 388
        assert db.scalar(select(Holding.quantity).where(Holding.user_id == user_id)) == 1
        assert db.scalar(select(func.count(WalletTransaction.id)).where(WalletTransaction.user_id == user_id)) == 3


def test_concurrent_admin_status_updates_are_audited(client):
    _require_postgres()
    headers = auth(client)
    with Session(engine) as db:
        admin = db.scalar(select(User).where(User.email == "test@example.com"))
        admin.role = "admin"
        db.commit()
    created = client.post(
        "/api/v1/auth/register",
        json={"email": "target@example.com", "password": "password123", "date_of_birth": "1990-01-01T00:00:00Z"},
    )
    target_id = created.json()["id"]

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(
            pool.map(
                lambda status: _patch(
                    f"/api/v1/admin/users/{target_id}/status",
                    {"account_status": status},
                    headers,
                ),
                ("suspended", "active"),
            )
        )

    assert [status for status, _ in results] == [200, 200]
    with Session(engine) as db:
        assert db.scalar(select(User.account_status).where(User.id == target_id)) in {"active", "suspended"}
        assert db.scalar(select(func.count(AuditLog.id)).where(AuditLog.target_user_id == target_id)) == 2
