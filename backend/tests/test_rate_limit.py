import pytest
from fastapi import HTTPException
from starlette.requests import Request

from app.core.config import settings
from app.core import rate_limit


class FakeRedis:
    def __init__(self, counts: list[tuple[int, int]]) -> None:
        self.counts = counts
        self.calls: list[tuple[str, int, str, int]] = []

    def eval(self, script: str, key_count: int, key: str, window: int):
        self.calls.append((script, key_count, key, window))
        return self.counts.pop(0)


def _request(headers: list[tuple[bytes, bytes]] | None = None, client: str = "198.51.100.2") -> Request:
    return Request({
        "type": "http",
        "method": "GET",
        "path": "/",
        "headers": headers or [],
        "client": (client, 1234),
        "server": ("test", 80),
        "scheme": "http",
        "query_string": b"",
    })


def test_redis_counter_is_atomic_and_rate_limit_returns_retry_after(monkeypatch):
    fake = FakeRedis([(1, 60), (2, 59)])
    monkeypatch.setattr(settings, "rate_limit_enabled", True)
    monkeypatch.setattr(rate_limit, "get_redis", lambda: fake)
    request = _request()

    rate_limit.enforce_rate_limit(request, "test", 1)
    with pytest.raises(HTTPException) as error:
        rate_limit.enforce_rate_limit(request, "test", 1)

    assert error.value.status_code == 429
    assert error.value.headers == {"Retry-After": "59"}
    assert "redis.call('INCR'" in fake.calls[0][0]
    assert fake.calls[0][1:] == (1, "fieldyield:rate:test:ip:198.51.100.2:60", 60)


def test_forwarded_address_is_trusted_only_from_configured_proxy(monkeypatch):
    monkeypatch.setattr(settings, "trusted_proxy_ips", "127.0.0.1")
    forwarded = [(b"x-forwarded-for", b"203.0.113.8, 127.0.0.1")]
    assert rate_limit.client_address(_request(forwarded, client="127.0.0.1")) == "203.0.113.8"
    assert rate_limit.client_address(_request(forwarded, client="198.51.100.2")) == "198.51.100.2"


def test_development_fallback_is_bounded(monkeypatch):
    monkeypatch.setattr(settings, "rate_limit_enabled", True)
    monkeypatch.setattr(settings, "app_env", "test")
    monkeypatch.setattr(rate_limit, "_FALLBACK_MAX_KEYS", 3)
    monkeypatch.setattr(rate_limit, "get_redis", lambda: (_ for _ in ()).throw(rate_limit.RedisError()))
    rate_limit._fallback.clear()

    for index in range(5):
        rate_limit.enforce_rate_limit(_request(client=f"198.51.100.{index}"), "fallback", 5)

    assert len(rate_limit._fallback) == 3


def test_production_fails_closed_when_redis_is_unavailable(monkeypatch):
    monkeypatch.setattr(settings, "rate_limit_enabled", True)
    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(rate_limit, "get_redis", lambda: (_ for _ in ()).throw(rate_limit.RedisError()))

    with pytest.raises(HTTPException) as error:
        rate_limit.enforce_rate_limit(_request(), "production", 5)

    assert error.value.status_code == 503
    assert "temporarily unavailable" in error.value.detail
