from __future__ import annotations

import threading
import time
from collections import OrderedDict

from fastapi import HTTPException, Request
from redis.exceptions import RedisError

from app.core.config import settings
from app.core.redis import get_redis

_fallback: OrderedDict[str, tuple[int, float]] = OrderedDict()
_fallback_lock = threading.Lock()
_FALLBACK_MAX_KEYS = 10_000
_ATOMIC_INCREMENT = """
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return {count, redis.call('TTL', KEYS[1])}
"""


def client_address(request: Request) -> str:
    direct = request.client.host if request.client else "unknown"
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded and direct in settings.trusted_proxy_ip_set:
        candidate = forwarded.split(",", 1)[0].strip()
        if candidate and len(candidate) <= 64 and all(character.isalnum() or character in ".:-" for character in candidate):
            return candidate
    return direct


def _fallback_increment(key: str, window_seconds: int) -> tuple[int, int]:
    current_time = time.monotonic()
    with _fallback_lock:
        expired = [entry for entry, (_, expires) in _fallback.items() if expires <= current_time]
        for entry in expired:
            _fallback.pop(entry, None)
        count, expires = _fallback.get(key, (0, current_time + window_seconds))
        if expires <= current_time:
            count, expires = 0, current_time + window_seconds
        count += 1
        _fallback[key] = (count, expires)
        _fallback.move_to_end(key)
        while len(_fallback) > _FALLBACK_MAX_KEYS:
            _fallback.popitem(last=False)
        return count, max(1, int(expires - current_time))


def enforce_rate_limit(
    request: Request,
    bucket: str,
    limit: int | None = None,
    *,
    window_seconds: int = 60,
    user_id: int | None = None,
) -> None:
    if not settings.rate_limit_enabled:
        return
    effective_limit = limit or settings.rate_limit_default
    dimensions = [f"ip:{client_address(request)}"]
    if user_id is not None:
        dimensions.append(f"user:{user_id}")
    for dimension in dimensions:
        key = f"fieldyield:rate:{bucket}:{dimension}:{window_seconds}"
        try:
            redis = get_redis()
            count, ttl = redis.eval(_ATOMIC_INCREMENT, 1, key, window_seconds)
        except RedisError as exc:
            if settings.app_env == "production":
                raise HTTPException(503, "Rate limiting is temporarily unavailable") from exc
            count, ttl = _fallback_increment(key, window_seconds)
        if count > effective_limit:
            raise HTTPException(429, "Too many requests; retry later", headers={"Retry-After": str(max(1, ttl))})
