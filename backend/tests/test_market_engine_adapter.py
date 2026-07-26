from decimal import Decimal

import httpx

from app.integrations.market_engine import MarketEngineClient, MarketEngineUnavailable


def test_market_engine_order_contract(monkeypatch):
    calls = []

    def fake_request(method, url, **kwargs):
        calls.append((method, url, kwargs))
        return httpx.Response(200, json={"order_id": "engine-1", "status": "accepted"}, request=httpx.Request(method, url))

    monkeypatch.setattr(httpx, "request", fake_request)
    client = MarketEngineClient("https://engine.example", 1000, api_key="secret", version="v2")
    result = client.submit_order(request_id="req-1", user_id=7, player_id="HA9", side="BUY", quantity=2, limit_price=Decimal("10.25"))
    assert result["order_id"] == "engine-1"
    assert calls[0][0:2] == ("POST", "https://engine.example/v1/orders")
    assert calls[0][2]["json"]["request_id"] == "req-1"
    assert calls[0][2]["json"]["limit_price"] == "10.25"
    assert calls[0][2]["headers"]["Authorization"] == "Bearer secret"


def test_market_engine_cancellation_is_owner_scoped(monkeypatch):
    captured = {}

    def fake_request(method, url, **kwargs):
        captured.update(method=method, url=url, params=kwargs["params"])
        return httpx.Response(200, json={"status": "cancelled"}, request=httpx.Request(method, url))

    monkeypatch.setattr(httpx, "request", fake_request)
    result = MarketEngineClient("https://engine.example", 1000).cancel_order("engine-1", 7)
    assert result["status"] == "cancelled"
    assert captured == {"method": "DELETE", "url": "https://engine.example/v1/orders/engine-1", "params": {"user_id": "7"}}


def test_disabled_market_engine_fails_closed():
    client = MarketEngineClient("", 1000)
    try:
        client.health()
    except MarketEngineUnavailable as exc:
        assert "not configured" in str(exc)
    else:
        raise AssertionError("disabled Market Engine must fail closed")
