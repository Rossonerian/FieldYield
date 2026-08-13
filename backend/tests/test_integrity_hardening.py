from datetime import datetime, timedelta, timezone
from decimal import Decimal

import jwt
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import engine
from app.models import (
    ActiveSquad,
    Holding,
    MarketPrice,
    Notification,
    Order,
    OrderMatch,
    Player,
    User,
    Wallet,
    WalletTransaction,
    Watchlist,
)
from .conftest import auth


def _register(client, email: str) -> dict[str, str]:
    response = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "password123", "date_of_birth": "1990-01-01T00:00:00Z"},
    )
    assert response.status_code == 200
    token = client.post(
        "/api/v1/auth/login", json={"email": email.upper(), "password": "password123"}
    ).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _credit(client, headers: dict[str, str], amount: str = "1000", key: str | None = None):
    body = {"currency": "gold", "amount": amount}
    if key:
        body["idempotency_key"] = key
    response = client.post("/api/v1/wallet/credit", json=body, headers=headers)
    assert response.status_code == 200
    return response


def test_order_idempotency_is_scoped_and_payload_bound(client):
    first = auth(client)
    second = _register(client, "second@example.com")
    _credit(client, first)
    _credit(client, second)
    payload = {"symbol": "HA9", "quantity": 2, "idempotency_key": "shared-order-key"}

    original = client.post("/api/v1/trading/orders/market-buy", json=payload, headers=first)
    retry = client.post("/api/v1/trading/orders/market-buy", json=payload, headers=first)
    other_user = client.post("/api/v1/trading/orders/market-buy", json=payload, headers=second)

    assert original.status_code == retry.status_code == other_user.status_code == 200
    assert original.json()["id"] == retry.json()["id"]
    assert original.json()["id"] != other_user.json()["id"]
    assert original.json()["execution_price"] == 122
    assert original.json()["executed_total"] == 244

    for changed in (
        {**payload, "quantity": 3},
        {**payload, "symbol": "SA7"},
    ):
        response = client.post("/api/v1/trading/orders/market-buy", json=changed, headers=first)
        assert response.status_code == 409
    response = client.post("/api/v1/trading/orders/market-sell", json=payload, headers=first)
    assert response.status_code == 409

    with Session(engine) as db:
        first_id = db.scalar(select(User.id).where(User.email == "test@example.com"))
        assert db.scalar(select(func.count(Order.id)).where(Order.user_id == first_id)) == 1
        assert db.scalar(select(func.count(OrderMatch.id)).join(Order).where(Order.user_id == first_id)) == 1
        assert db.scalar(
            select(func.count(WalletTransaction.id)).where(
                WalletTransaction.user_id == first_id,
                WalletTransaction.reason == "buy_execution",
            )
        ) == 1
        assert db.scalar(select(Holding.quantity).where(Holding.user_id == first_id)) == 2
        assert db.scalar(
            select(func.count(Notification.id)).where(
                Notification.user_id == first_id,
                Notification.kind == "order_filled",
            )
        ) == 1


def test_credit_idempotency_is_scoped_and_payload_bound(client):
    first = auth(client)
    second = _register(client, "credit-second@example.com")
    _credit(client, first, "25", "same-credit-key")
    _credit(client, first, "25", "same-credit-key")
    _credit(client, second, "25", "same-credit-key")
    conflict = client.post(
        "/api/v1/wallet/credit",
        json={"currency": "gold", "amount": "30", "idempotency_key": "same-credit-key"},
        headers=first,
    )
    assert conflict.status_code == 409
    assert client.get("/api/v1/wallet", headers=first).json()["gold"] == 25
    assert client.get("/api/v1/wallet", headers=second).json()["gold"] == 25


def test_rejected_orders_leave_no_financial_rows(client):
    headers = auth(client)
    _credit(client, headers, "500")
    with Session(engine) as db:
        price = db.scalar(select(MarketPrice).join(Player).where(Player.symbol == "HA9"))
        price.updated_at = datetime.now(timezone.utc) - timedelta(seconds=settings.market_price_max_age_seconds + 1)
        db.commit()

    before_wallet = client.get("/api/v1/wallet", headers=headers).json()
    stale = client.post(
        "/api/v1/trading/orders/market-buy",
        json={"symbol": "HA9", "quantity": 1, "idempotency_key": "stale"},
        headers=headers,
    )
    assert stale.status_code == 409
    assert "stale" in stale.json()["detail"].lower()
    assert client.get("/api/v1/wallet", headers=headers).json() == before_wallet

    with Session(engine) as db:
        price = db.scalar(select(MarketPrice).join(Player).where(Player.symbol == "HA9"))
        db.delete(price)
        db.commit()
    missing = client.post(
        "/api/v1/trading/orders/market-buy",
        json={"symbol": "HA9", "quantity": 1, "idempotency_key": "missing"},
        headers=headers,
    )
    assert missing.status_code == 409
    assert "unavailable" in missing.json()["detail"].lower()

    with Session(engine) as db:
        user_id = db.scalar(select(User.id).where(User.email == "test@example.com"))
        assert db.scalar(select(func.count(Order.id)).where(Order.user_id == user_id)) == 0
        assert db.scalar(select(func.count(Holding.id)).where(Holding.user_id == user_id)) == 0
        assert db.scalar(
            select(func.count(WalletTransaction.id)).where(
                WalletTransaction.user_id == user_id,
                WalletTransaction.reason == "buy_execution",
            )
        ) == 0


def test_future_price_and_missing_wallet_fail_safely(client):
    headers = auth(client)
    with Session(engine) as db:
        price = db.scalar(select(MarketPrice).join(Player).where(Player.symbol == "HA9"))
        price.updated_at = datetime.now(timezone.utc) + timedelta(seconds=settings.market_price_future_skew_seconds + 1)
        db.commit()
    future = client.post(
        "/api/v1/trading/orders/market-buy", json={"symbol": "HA9", "quantity": 1}, headers=headers
    )
    assert future.status_code == 409
    assert "timestamp" in future.json()["detail"].lower()

    with Session(engine) as db:
        user_id = db.scalar(select(User.id).where(User.email == "test@example.com"))
        price = db.scalar(select(MarketPrice).join(Player).where(Player.symbol == "HA9"))
        price.updated_at = datetime.now(timezone.utc)
        wallet = db.scalar(select(Wallet).where(Wallet.user_id == user_id))
        db.delete(wallet)
        db.commit()
    missing_wallet = client.post(
        "/api/v1/trading/orders/market-buy", json={"symbol": "HA9", "quantity": 1}, headers=headers
    )
    assert missing_wallet.status_code == 409
    assert missing_wallet.json()["detail"] == "Account wallet is unavailable"


def test_closed_position_realized_pnl_is_retained_and_consistent(client):
    headers = auth(client)
    _credit(client, headers)
    buy = client.post(
        "/api/v1/trading/orders/market-buy", json={"symbol": "HA9", "quantity": 2}, headers=headers
    )
    assert buy.status_code == 200
    with Session(engine) as db:
        price = db.scalar(select(MarketPrice).join(Player).where(Player.symbol == "HA9"))
        price.bid = Decimal("130")
        price.ask = Decimal("131")
        db.commit()
    sell = client.post(
        "/api/v1/trading/orders/market-sell", json={"symbol": "HA9", "quantity": 2}, headers=headers
    )
    assert sell.status_code == 200
    portfolio = client.get("/api/v1/portfolio", headers=headers).json()
    summary = client.get("/api/v1/users/me/summary", headers=headers).json()
    assert portfolio == {
        "market_value": 0,
        "cost_basis": 0,
        "unrealized_pnl": 0,
        "realized_pnl": 16,
    }
    assert summary["holdings_count"] == 0
    assert summary["realized_pnl"] == 16
    assert summary["unrealized_pnl"] == 0


def test_squad_state_survives_refresh_reuses_gaps_and_cleans_final_sale(client):
    headers = auth(client)
    _credit(client, headers, "2000")
    for symbol in ("HA9", "SA7"):
        assert client.post(
            "/api/v1/trading/orders/market-buy", json={"symbol": symbol, "quantity": 1}, headers=headers
        ).status_code == 200
    initial = client.get("/api/v1/squad/state", headers=headers).json()
    assert {entry["symbol"] for entry in initial["reserve"]} == {"HA9", "SA7"}
    assert client.post("/api/v1/squad/promote", json={"symbol": "HA9"}, headers=headers).status_code == 200
    assert client.post("/api/v1/squad/promote", json={"symbol": "SA7"}, headers=headers).status_code == 200
    assert client.post("/api/v1/squad/demote", json={"symbol": "HA9"}, headers=headers).status_code == 200
    assert client.post("/api/v1/squad/promote", json={"symbol": "HA9"}, headers=headers).status_code == 200
    refreshed = client.get("/api/v1/squad/state", headers=headers).json()
    positions = {entry["symbol"]: entry["position"] for entry in refreshed["active"]}
    assert positions == {"HA9": 1, "SA7": 2}

    assert client.post(
        "/api/v1/trading/orders/market-sell", json={"symbol": "HA9", "quantity": 1}, headers=headers
    ).status_code == 200
    final = client.get("/api/v1/squad/state", headers=headers).json()
    assert "HA9" not in {entry["symbol"] for entry in final["active"]}
    assert "HA9" not in {entry["symbol"] for entry in final["reserve"]}
    with Session(engine) as db:
        assert db.scalar(select(func.count(ActiveSquad.id))) == 1


def test_schema_bounds_auth_failures_and_notification_ownership(client):
    first = auth(client)
    second = _register(client, "ownership@example.com")
    assert client.post(
        "/api/v1/trading/orders/market-buy", json={"symbol": "HA9", "quantity": 0}, headers=first
    ).status_code == 422
    assert client.post(
        "/api/v1/trading/orders/market-buy",
        json={"symbol": "HA9", "quantity": settings.max_order_quantity + 1},
        headers=first,
    ).status_code == 422
    assert client.post(
        "/api/v1/wallet/credit",
        json={"currency": "gold", "amount": 1, "idempotency_key": "x" * 121},
        headers=first,
    ).status_code == 422
    assert client.get("/api/v1/users/me", headers={"Authorization": "Bearer not-a-token"}).status_code == 401

    expired = jwt.encode(
        {
            "sub": "1",
            "iat": datetime.now(timezone.utc) - timedelta(hours=2),
            "exp": datetime.now(timezone.utc) - timedelta(hours=1),
            "iss": settings.local_jwt_issuer,
            "aud": settings.local_jwt_audience,
        },
        settings.secret_key,
        algorithm="HS256",
    )
    assert client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {expired}"}).status_code == 401

    _credit(client, first, "5")
    notification = client.get("/api/v1/notifications", headers=first).json()[0]
    assert client.post(
        f"/api/v1/notifications/{notification['id']}/read", headers=second
    ).status_code == 404
    assert client.post(
        f"/api/v1/notifications/{notification['id']}/read", headers=first
    ).json()["read"] is True


def test_profile_input_bounds_and_watchlist_price_invariant(client):
    headers = auth(client)
    invalid_profiles = [
        {"username": "bad space"},
        {"first_name": "<script>"},
        {"country": "USA"},
        {"avatar_url": "http://example.com/avatar.png"},
        {"preferences": {"nested": {"a": {"b": {"c": {"d": {"e": True}}}}}}},
        {"preferences": {str(index): True for index in range(65)}},
    ]
    for payload in invalid_profiles:
        assert client.patch("/api/v1/users/me", json=payload, headers=headers).status_code == 422
    assert client.post(
        "/api/v1/auth/register",
        json={
            "email": "long-password@example.com",
            "password": "x" * 129,
            "date_of_birth": "1990-01-01T00:00:00Z",
        },
    ).status_code == 422

    with Session(engine) as db:
        player = db.scalar(select(Player).where(Player.symbol == "SA7"))
        price = db.scalar(select(MarketPrice).where(MarketPrice.player_id == player.id))
        db.delete(price)
        db.commit()
        player_id = player.id

    response = client.post("/api/v1/watchlists", json={"symbol": "SA7"}, headers=headers)
    assert response.status_code == 409
    with Session(engine) as db:
        assert db.scalar(select(func.count(Watchlist.id)).where(Watchlist.player_id == player_id)) == 0


def test_request_size_request_id_and_health(client, monkeypatch):
    oversized = "x" * (settings.request_body_max_bytes + 1)
    response = client.post(
        "/api/v1/auth/login",
        content=oversized,
        headers={"Content-Type": "application/json", "X-Request-ID": "support:valid-1"},
    )
    assert response.status_code == 413
    assert response.json()["detail"] == "Request body is too large"

    oversized_form = client.post(
        "/api/v1/auth/token",
        content=("username=" + oversized).encode(),
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert oversized_form.status_code == 413

    boundary = "fieldyield-boundary"
    multipart = (
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"username\"; filename=\"{oversized}\"\r\n\r\nx\r\n"
        f"--{boundary}--\r\n"
    ).encode()
    oversized_multipart = client.post(
        "/api/v1/auth/token",
        content=multipart,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
    )
    assert oversized_multipart.status_code == 413

    def chunks():
        for _ in range(5):
            yield b"x" * (settings.request_body_max_bytes // 4)

    streamed = client.post(
        "/api/v1/auth/token",
        content=chunks(),
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert streamed.status_code == 413

    live = client.get("/health/live")
    ready = client.get("/health/ready")
    assert live.status_code == ready.status_code == 200
    assert live.headers["x-request-id"]
    assert ready.json()["database"] == "ok"

    monkeypatch.setattr("app.main._database_ready", lambda: "error")
    unavailable = client.get("/health/ready", headers={"X-Request-ID": "bad request id!"})
    assert unavailable.status_code == 503
    assert unavailable.json()["status"] == "degraded"
    assert unavailable.headers["x-request-id"] != "bad request id!"
