from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Any

import httpx

from app.core.config import settings


class MarketEngineUnavailable(RuntimeError):
    """Raised when the external engine cannot safely answer a request."""


@dataclass(frozen=True)
class MarketEngineClient:
    base_url: str
    timeout_ms: int
    api_key: str | None = None
    version: str = "v1"

    @property
    def enabled(self) -> bool:
        return bool(self.base_url)

    def _headers(self) -> dict[str, str]:
        headers = {"Accept": "application/json", "X-FieldYield-Version": self.version}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    def _request(self, method: str, path: str, **kwargs: Any) -> dict[str, Any]:
        if not self.enabled:
            raise MarketEngineUnavailable("Market Engine is not configured")
        try:
            response = httpx.request(
                method,
                f"{self.base_url.rstrip('/')}/{path.lstrip('/')}",
                headers=self._headers(),
                timeout=max(self.timeout_ms, 250) / 1000,
                **kwargs,
            )
            response.raise_for_status()
            payload = response.json()
            if not isinstance(payload, dict):
                raise MarketEngineUnavailable("Market Engine returned an invalid response")
            return payload
        except (httpx.HTTPError, ValueError) as exc:
            raise MarketEngineUnavailable("Market Engine is unavailable") from exc

    def health(self) -> dict[str, Any]:
        return self._request("GET", "/health/ready")

    def bootstrap_user(self, *, user_id: str, cash: Decimal, positions: dict[str, int] | None = None) -> dict[str, Any]:
        if not user_id or cash < 0 or any(quantity < 0 for quantity in (positions or {}).values()):
            raise ValueError("Market Engine bootstrap values are invalid")
        return self._request("POST", f"/v1/users/{user_id}/bootstrap", json={"cash": str(cash), "positions": positions or {}})

    def snapshot(self, *, user_id: str, player_id: str) -> dict[str, Any]:
        if not user_id or not player_id:
            raise ValueError("Market Engine snapshot identifiers are required")
        return self._request("GET", f"/v1/users/{user_id}/players/{player_id}/snapshot")

    def submit_order(
        self,
        *,
        request_id: str,
        user_id: int,
        player_id: str,
        side: str,
        order_type: str = "MARKET",
        quantity: int,
        limit_price: Decimal | None = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "request_id": request_id,
            "user_id": str(user_id),
            "player_id": player_id,
            "side": side.upper(),
            "order_type": order_type.upper(),
            "quantity": quantity,
        }
        if limit_price is not None:
            payload["limit_price"] = str(limit_price)
        return self._request("POST", "/v1/orders", json=payload)

    def cancel_order(self, order_id: str, user_id: int) -> dict[str, Any]:
        return self._request("DELETE", f"/v1/orders/{order_id}", params={"user_id": str(user_id)})


market_engine = MarketEngineClient(
    base_url=settings.market_engine_base_url or "",
    timeout_ms=settings.market_engine_timeout_ms,
    api_key=settings.market_engine_api_key,
    version=settings.market_engine_version,
)
