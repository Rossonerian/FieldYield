"""Small fixed-cardinality operational counters emitted as structured logs."""

from __future__ import annotations

import logging
import threading
from collections import Counter

logger = logging.getLogger("fieldyield.metrics")

_NAMES = frozenset(
    {
        "authentication_failures",
        "rate_limit_rejections",
        "orders_filled",
        "orders_rejected",
        "idempotent_replays",
        "stale_price_rejections",
        "database_errors",
        "supabase_verification_failures",
        "market_engine_failures",
        "readiness_failures",
    }
)
_counts: Counter[str] = Counter()
_lock = threading.Lock()


def record_metric(name: str) -> None:
    """Increment one allow-listed counter without accepting dynamic labels."""
    if name not in _NAMES:
        raise ValueError(f"Unsupported metric name: {name}")
    with _lock:
        _counts[name] += 1
        total = _counts[name]
    logger.info("metric=%s increment=1 process_total=%s", name, total)


def metric_snapshot() -> dict[str, int]:
    """Return a test/diagnostic snapshot without exposing a public endpoint."""
    with _lock:
        return {name: _counts[name] for name in sorted(_NAMES)}
