# Known issues and verified fixes

Audit date: 2026-08-13. “Fixed” below means implemented and verified in the
repository. It does not assert that an external provider or live deployment
has been configured.

## Open external and product dependencies

### P1 — External Market Engine settlement is intentionally disabled

`MARKET_ENGINE_TRADING_ENABLED=true` is rejected by configuration validation.
The external contract still lacks a proven catalog, price, acceptance, fill,
cancellation, reconciliation, authentication, and replay lifecycle. FieldYield
therefore executes only its closed-loop SQL market orders. Enablement requires
the checklist in `docs/operations-runbook.md` and sandbox contract tests; no
repository fallback may claim external success.

### P1 — Production catalog ingestion remains operator-driven

The bounded admin catalog import is the only implemented source. The API stores
source/timestamps and refuses to trade on missing, stale, or future-skewed
prices, but it cannot make data fresh. A real provider contract, scheduled
ingestion, reconciliation, and freshness alert must be implemented before a
continuous market is promised.

### P1 — Provider configuration and recovery are external

The repository cannot prove Render backups, a restore drill, Supabase email or
Google provider settings, Google OAuth consent, production secrets, live CORS,
or Vercel/Render availability. Operators must perform and record the runbook
checks. Preview environments need a separate explicit API/CORS/Supabase policy;
the production API deliberately accepts only the production frontend origin.

### P2 — Historical market data is not implemented

No history source or storage contract exists, so chart/stat/dividend/schedule
views remain truthful empty states. Do not derive trend or dividend claims from
the current quote. Implement retention, provenance, bounded queries, and a real
provider before enabling these features.

### P2 — External metrics and alert delivery remain operational work

The API emits redacted request-ID logs, audit rows, readiness, and distributed
Redis rate limits. This repository does not configure a log drain, paging
destination, retention policy, or managed alert. Readiness and error-rate alerts
must be connected and tested by the deployment owner.

## Fixed in this hardening pass

- Order and wallet idempotency are per-user, payload-bound, length-bounded, and
  concurrency-safe. Same keys cannot cross users or duplicate side effects.
- PostgreSQL account mutations take the user lock before foreign-key inserts,
  eliminating the deadlock discovered by genuine concurrent tests.
- Missing/stale/future prices and missing wallets fail with controlled errors;
  rejected attempts do not mutate financial state.
- Decimal settlement, bounded quantities, authoritative fill values, closed
  position realized P/L, and SQL financial constraints are enforced.
- Active/Reserve squad state is authoritative, gap-safe, capped, persistent,
  isolated by user, and cleaned on final-share sales.
- Buy, sell, watchlist, squad, notification, wallet, and dividend UI flows use
  centralized account refresh and stable order intent keys.
- Supabase uses cached asymmetric JWKS validation with explicit algorithms and
  claims; legacy HS projects use bounded remote verification. Local JWTs are
  explicit test/development only. Tokens are not raw cache keys.
- Request bodies, schemas, catalog size, request IDs, CORS, readiness, and Redis
  rate limits are bounded and tested. Production fails closed if Redis fails.
- Runtime dependencies are pinned/audited separately from development tools;
  npm and Python runtime audits pass.
- The Docker image is Python 3.12.13 digest-pinned and non-root. Render data
  services are private by default, migrations use a PostgreSQL advisory lock,
  and Vercel defines CSP/security headers.
- Alembic v1 is explicit rather than dynamic metadata; v11 scopes idempotency
  and adds validated constraints/indexes. V11 is intentionally irreversible.
- Accessibility semantics, focus containment, target sizes, contrast, lazy
  screen loading, typed API calls, linting, unit tests, Playwright, and CI gates
  are in place without changing the visual design.

## Residual risk

The remaining repository-level risk is low-to-moderate and operational: startup
migrations are serialized but still run in the web service because the selected
Render plan has no configured pre-deploy command. A migration failure prevents
startup; backup and staging rehearsal are mandatory. Provider outage behavior
is fail-closed for authentication/readiness and therefore may reduce
availability while preserving authorization correctness.
