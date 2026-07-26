# Known issues and fixes

This is an evidence-based backlog for the code and deployed configuration
audited on 2026-07-27. “Fixed” means the repository contains the change and a
local/deployed check was run; it does not mean an external provider has been
configured.

## Prioritized backlog

### P1 — External Market Engine contract is incomplete

- **Symptom:** Render health reports `market_engine: not_configured`; FieldYield
  does not have an external catalog/price/reconciliation flow.
- **Evidence:** `backend/app/integrations/market_engine.py`,
  `docs/market-engine-contract.md`, and `GET /health`.
- **Impact:** The external engine cannot be treated as authoritative for live
  settlement, fills, balances, or price synchronization.
- **Recommended fix:** The Market Engine owner must agree to versioned service
  authentication, catalog/prices, idempotent order/cancel responses, signed
  reconciliation events, stable errors, and replay behavior. Implement the
  adapter contract tests in FieldYield before enabling it.
- **Type/owner:** External contract plus FieldYield adapter; external Market
  Engine developer and FieldYield backend owner.
- **Validation:** Health readiness, mocked adapter contract tests, sandbox order
  lifecycle, reconciliation replay, and failure/timeout tests.

### P1 — Catalog and price ingestion is manual

- **Symptom:** Production startup never seeds assets; markets are empty until
  an administrator imports bounded catalog/price records.
- **Evidence:** `GET /api/v1/market/prices`,
  `POST /api/v1/admin/catalog/import`, `backend/app/main.py`, and the absence of
  an ingestion worker/provider route.
- **Impact:** Prices can become stale or unavailable; the current API has no
  freshness SLA or automatic source reconciliation.
- **Recommended fix:** Add a real provider/Market Engine sync boundary after
  its contract exists. Store source and update timestamps, reject stale or
  conflicting updates, and alert operators instead of falling back to fake
  data.
- **Type/owner:** Code plus external contract; FieldYield/external provider.
- **Validation:** Duplicate/malformed input tests, source freshness checks,
  replay/idempotency tests, and a production catalog smoke test.

### P1 — Preview OAuth and API CORS need an explicit environment policy

- **Symptom:** Backend `FRONTEND_URL` is validated to exactly
  `https://field-yield.vercel.app`; a Vercel Preview origin is not allowed by
  the current production configuration.
- **Evidence:** `backend/app/core/config.py`, CORS setup in
  `backend/app/main.py`, and `VITE_SITE_URL` handling in
  `src/lib/supabase.ts`.
- **Impact:** Preview builds can be served but cannot safely call the strict
  production API unless a separate Preview API/configuration is provided.
- **Recommended fix:** Decide whether Preview uses a separate Render service
  and Supabase redirect allowlist, or keep Preview UI-only. Do not broaden the
  production origin to `*` or an unbounded wildcard.
- **Type/owner:** Configuration/deployment decision; FieldYield + Vercel +
  Render + Supabase.
- **Validation:** Preview OAuth redirect, preflight, protected request, and
  logout tests with the approved preview origin.

### P1 — Admin bootstrap configuration is external to the repository

- **Symptom:** `ADMIN_EMAILS` defaults to empty, so no configured email is an
  administrator unless its persisted role is already `admin`.
- **Evidence:** `Settings.configured_admin_emails`, `admin_user`, and
  `render.yaml` marks `ADMIN_EMAILS` as `sync: false`.
- **Impact:** Admin catalog import, user status, and audit endpoints may be
  unavailable after a fresh deployment; hardcoding an administrator would be
  unsafe.
- **Recommended fix:** Configure a controlled administrator address in Render
  and document the bootstrap/rotation procedure. Keep the value server-only.
- **Type/owner:** Configuration/operational procedure; Render/FieldYield owner.
- **Validation:** Normal-user 403, configured-admin success, suspension audit,
  and removal/rotation check.

### P1 — Production backup and migration rehearsal are not automated

- **Symptom:** Alembic is authoritative, but backup/restore and staging
  rehearsal are operator procedures; `v4_remove_live_notebook` has a no-op
  downgrade.
- **Evidence:** `backend/start.sh`, `backend/alembic/versions/v4_remove_live_notebook.py`,
  and Render configuration.
- **Impact:** A bad migration or restore failure could cause downtime or data
  loss.
- **Recommended fix:** Configure Render PostgreSQL backups, test restores, and
  run migrations against a staging clone before production. Keep financial
  history immutable.
- **Type/owner:** Operational procedure; Render/database operator.
- **Validation:** Restore drill, `alembic upgrade head`, schema diff, and
  rollback rehearsal on non-production data.

### P2 — Rate limiting and external observability are absent

- **Symptom:** The API has request logging and audit rows but no application
  rate limiter, metrics export, alerting, or structured log retention policy.
- **Evidence:** `backend/app/main.py`, `backend/requirements.txt`, and the
  absence of rate-limit/metrics middleware.
- **Impact:** Brute-force auth, abusive catalog requests, and degraded provider
  behavior may be detected late.
- **Recommended fix:** Add an infrastructure/API-gateway rate limit for auth
  and admin routes, plus redacted structured logs and health/error alerts.
- **Type/owner:** Code/infrastructure; FieldYield + Render.
- **Validation:** Rate-limit integration tests, redaction review, and alert
  delivery test.

### P2 — Historical chart and market-stat APIs are not implemented

- **Symptom:** Portfolio and market screens use current bounded holdings,
  prices, and derived presentation values; no time-series endpoint exists.
- **Evidence:** `src/features/dashboard/Dashboard.tsx`,
  `src/features/portfolio/Portfolio.tsx`, `src/lib/api.ts`, and
  `backend/app/main.py`.
- **Impact:** Historical performance, price charts, and reliable trend claims
  cannot be offered without inventing data.
- **Recommended fix:** Add a real, bounded historical-price/trade data contract
  and query only after storage/retention requirements are approved.
- **Type/owner:** Product/data model decision; FieldYield + external provider.
- **Validation:** Source timestamp coverage, downsampled API response, empty
  state, and large-range performance tests.

## Already addressed controls

- **CORS:** The allowed origin is strict, preflight uses all methods/headers,
  and error responses include CORS headers. This was validated against the live
  API with approved and unknown origins.
- **Token exposure:** The built frontend bundle contains no service-role,
  client-secret, Market Engine key, or localhost API value in the audited scan.
  Keep this scan in release checks.
- **Signup bonus:** The server grants the configured bonus transactionally with
  unique user/idempotency constraints; frontend state cannot claim it.
- **Suspension/admin boundaries:** Dependencies derive identity from verified
  tokens and enforce status/role checks server-side. Local tests cover these
  paths; a production admin smoke test still requires the configured admin
  address.
- **Migration authority:** The FastAPI startup `create_all` fallback was
  removed; Render's Alembic step is now the only production schema creation
  path. Re-run migration and backend tests after changes.

## External verification still required

Repository tests and HTTP smoke checks do not prove Google consent, Supabase
redirect settings, Render secret values, PostgreSQL backup recovery, or a real
Market Engine trade. Those must be verified by the owning operator/provider
before inviting production users.
