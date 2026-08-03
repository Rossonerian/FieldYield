# FieldYield ↔ Market Engine contract

This is the server-only integration boundary for the separately maintained
`divyansh953/Market-Engine-` service. FieldYield never imports that repository
and the browser never calls it.

## Current implementation

The adapter is `backend/app/integrations/market_engine.py`. It uses:

- `MARKET_ENGINE_BASE_URL` as the origin (no path suffix is assumed).
- `Authorization: Bearer <MARKET_ENGINE_API_KEY>` when a key is configured.
- `X-FieldYield-Version: <MARKET_ENGINE_VERSION>` for compatibility.
- A bounded timeout from `MARKET_ENGINE_TIMEOUT_MS` (no retries for order mutations).
- JSON responses and normalized `MarketEngineUnavailable` failures.

The audited external service currently exposes:

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health/live` | Process liveness (not used for trading readiness). |
| `GET` | `/health/ready` | Dependency/readiness response used by the adapter. |
| `POST` | `/v1/orders` | Market or limit order submission. |
| `DELETE` | `/v1/orders/{order_id}?user_id=...` | Owner-checked cancellation. |
| `GET` | `/v1/users/{user_id}/players/{player_id}/snapshot` | Engine snapshot. |

The repository currently does not provide a catalog/price synchronization
endpoint, signed fill-event delivery, or a signed service identity contract.
Therefore the adapter is health/order/cancellation capable, but it is **not
enabled as the authoritative settlement path**. FieldYield's SQL transaction
service remains authoritative and the external adapter is only used when an
explicitly integrated feature calls it. The Market Engine must not own or
reconcile FieldYield wallets, Gold/Silver balances, holdings, signup bonuses,
or user account state.

## Required contract before live external settlement

The Market Engine owner must provide a versioned contract containing:

1. Service authentication (prefer a rotating API key or mTLS; never a browser credential).
2. `GET /v1/catalog` and `GET /v1/prices` with stable external IDs, source timestamps, and pagination.
3. `POST /v1/orders` accepting `request_id`, user/external account ID, asset ID, side, type, quantity, and optional limit price; the request ID must be idempotent.
4. A response containing the external order ID, status, accepted quantity, authoritative execution details, and version.
5. `DELETE /v1/orders/{id}` with an idempotent cancellation response and race-safe status.
6. A reconciliation endpoint or signed event stream for fills/executions only.
   FieldYield will apply wallet ledger and holding changes in its own database
   transaction after validating a trusted fill.
7. Stable error JSON: `{ "code": string, "message": string, "retryable": boolean }`.
8. Explicit timeout/retry guidance. FieldYield will retry only idempotent reads and never blindly retry order mutations.
9. A replay/reconciliation procedure for timeouts and worker restarts.

Until those items are delivered and contract tests pass, production trading must
remain on the FieldYield SQL path and `MARKET_ENGINE_TRADING_ENABLED` must stay
`false`. The Market Engine health endpoint is an integration diagnostic, not
proof that settlement is safe.

## Test contract

`backend/tests/test_market_engine_adapter.py` uses explicit mocked HTTP
responses only. It never contacts the external repository or stores fixture
catalog data in production.
