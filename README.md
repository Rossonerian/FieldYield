# FieldYield

FieldYield is a responsive React/Vite football-asset trading application backed
by a FastAPI service, PostgreSQL persistence, Redis rate limiting, and Supabase
Auth. V1 supports real
authenticated profiles, wallets, catalog-backed market orders, holdings,
squads, watchlists, notifications, and server-controlled signup bonuses.

## Current status

The V1 frontend and API are configured for Vercel and Render. Repository
configuration alone does not prove a live deployment. Supabase Auth is the
production identity authority when `AUTH_PROVIDER=supabase`; local JWT
endpoints remain only for explicit local/test compatibility. The external
Market Engine is owned by another developer and is not part of this repository.
Its server-side adapter is present, but live external settlement and catalog
synchronization remain disabled until the documented contract is agreed.

## Architecture at a glance

```text
Browser (Vercel Vite SPA)
  -> FieldYield FastAPI (Render, strict CORS)
     -> Supabase Auth token validation
     -> Render PostgreSQL (Alembic-managed)
     -> Render Redis (distributed request/user rate limits)
     -> server-only Market Engine adapter (external repository)
```

The browser calls only `https://fieldyield-api.onrender.com`; it never calls
the Market Engine or receives service-role/database/API credentials. The SQL
database is authoritative for local profiles, wallets, holdings, orders, and
ledger records. See the [architecture documentation](docs/architecture/README.md)
for request, data, and deployment flows.

## Implemented V1 features

- Supabase email/password and Google OAuth session restoration
- Idempotent local profile, wallet, and signup-bonus synchronization
- Responsive Dashboard, Markets, Portfolio, Squad, Watchlist, Settings, and
  notification drawer
- Real catalog/price reads and bounded admin catalog import
- SQL-backed market buy/sell orders with balance/holding checks and idempotency
- Per-user, payload-bound idempotency with PostgreSQL-safe account lock ordering
- Price freshness enforcement and authoritative execution price/total output
- Portfolio, wallet ledger, holdings, squad, watchlist, and notification APIs
- Authoritative Active 25 / derived Reserve 15 squad state across refreshes
- Server-side admin user status/audit operations
- Retro-Glass light/dark theme, accessible controls, reduced-motion support,
  responsive desktop dock, and mobile navigation

The application renders empty states when production data is absent. It does
not seed demo players, balances, trades, charts, or notifications at startup.

## Repository boundaries

FieldYield is maintained in this repository. The Market Engine repository is an
external dependency and must be inspected read-only. Do not modify, fork,
commit to, or push to it. The audited external endpoints and missing contract
requirements are documented in [the Market Engine contract](docs/market-engine-contract.md).

## Repository layout

| Path | Purpose |
| --- | --- |
| `src/` | React application, account state, API client, and feature screens |
| `backend/app/` | FastAPI routes, authentication, trading services, and models |
| `backend/alembic/` | Deterministic database migrations |
| `backend/tests/` | Fast SQLite tests and PostgreSQL concurrency coverage |
| `src/test/` | Vitest, React Testing Library, and axe coverage |
| `e2e/` | Playwright desktop and mobile workflows |
| `docs/` | Architecture, operations, and external integration contracts |
| `.github/workflows/ci.yml` | Frontend, backend, PostgreSQL, security, Docker, and E2E gates |

## Prerequisites and local setup

- Node.js 20.19+ (Vite 7)
- Python 3.12+
- PostgreSQL 17 for production-like concurrency tests; SQLite is used for fast tests

```bash
npm ci
cp .env.example .env.local
npm run dev

cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
alembic upgrade head
uvicorn app.main:app --reload
```

On Windows PowerShell, use `Copy-Item` instead of `cp`, activate the backend
environment with `.\.venv\Scripts\Activate.ps1`, and run the Python commands
through `python -m ...`. Environment examples contain placeholders only and
must be reviewed before use.

For local API tests, set `AUTH_PROVIDER=local`. For Supabase testing, use
`AUTH_PROVIDER=supabase` with the public/server variables described in the
[deployment guide](docs/architecture/deployment-and-operations.md). Never
place service-role keys in `.env.local`.

## Environment variables

Frontend build variables are public by design:

- `VITE_API_BASE_URL`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SITE_URL`

Backend-only variables include `DATABASE_URL`, `REDIS_URL`, `SECRET_KEY`,
`AUTH_PROVIDER`, `CORS_ORIGINS`, signup-bonus values, Supabase server values,
`ADMIN_EMAILS`, `ALLOW_TEST_CREDIT`, and `MARKET_ENGINE_*`. Use placeholders
only; the complete reference is in [deployment and operations](docs/architecture/deployment-and-operations.md).

## Validation

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npm run bundle:report
npm run bundle:verify
npm audit --audit-level=high
npm audit --omit=dev --audit-level=high
npm run test:e2e

cd backend
python -m ruff check app tests
python -m pytest -m "not postgres" --cov=app -q
python -m pip check
python -m pip_audit -r requirements.txt
DATABASE_URL=sqlite:///./validation.db python -m alembic upgrade head
DATABASE_URL=sqlite:///./validation.db python -m alembic check
cd .. && python scripts/secret_scan.py
git diff --check
```

PowerShell uses `$env:DATABASE_URL='sqlite:///./validation.db'` before the two
Alembic commands. PostgreSQL concurrency coverage runs separately with
`TEST_DATABASE_URL` configured and `python -m pytest -m postgres -q`.

The required GitHub Actions matrix repeats these checks on Node 22 and Python
3.12, adds dependency review and bundle/secret scanning, builds the non-root
production image, and runs the Playwright smoke suite without production
Supabase credentials.

Do not run destructive database resets against production. Generated build,
cache, virtual-environment, and environment files are ignored by Git.

## Deployment summary

- **Vercel:** `npm ci`, `npm run build`, serve `dist/`; configure the four
  `VITE_*` variables for Preview/Production.
- **Render:** builds `backend/Dockerfile`; `backend/start.sh` invokes the
  advisory-lock-protected `app.migrate` entrypoint before Uvicorn; configure
  server-only variables and keep PostgreSQL/Redis on their internal networks.
- **Supabase:** enable Auth providers, Google callback/site URL, and approved
  redirect origins. The exact callback and OAuth flow are documented in
  [frontend flow](docs/architecture/frontend-flow.md).
- **Health:** `/health/live` is process liveness. `/health/ready` returns 503
  when a required database/auth/settlement dependency is unavailable. `/health`
  remains backward-compatible but is not the deployment readiness probe.

## Transaction rules

Order and test-credit idempotency keys are at most 120 characters and unique
per user. A same-user retry returns the original result only when the payload
matches; key reuse with a changed side, symbol, quantity, currency, or amount
returns 409. Trades reject missing, stale, or materially future-dated prices.
Market reads remain visible when stale, but execution requires a quote no older
than `MARKET_PRICE_MAX_AGE_SECONDS`.

Positive holdings in `active_squad` are Active (capacity 25). Positive holdings
without an active row are Reserve (capacity 15). This state is server-derived,
survives refresh, fills the lowest available active position, and removes an
active row atomically when the final share is sold.

## Production smoke test

1. Open `https://field-yield.vercel.app`.
2. Register/sign in with email/password and Google.
3. Refresh and confirm the Supabase session/profile persists.
4. Confirm the signup bonus appears once in wallet data and does not repeat.
5. Confirm a normal user receives 403 from admin operations.
6. Confirm an approved admin can inspect users/audit and import real catalog data.
7. Confirm empty markets/portfolio render empty states, never fixtures.
8. Confirm approved CORS preflight succeeds and an unknown origin is rejected.
9. Do not call external trading settlement verified until the Market Engine
   contract and reconciliation flow are configured.

## Architecture documentation

- [Documentation index and audit matrix](docs/architecture/README.md)
- [Frontend flow](docs/architecture/frontend-flow.md)
- [Backend flow](docs/architecture/backend-flow.md)
- [Database flow](docs/architecture/database-flow.md)
- [Deployment and operations](docs/architecture/deployment-and-operations.md)
- [Known issues and fixes](docs/architecture/known-issues-and-fixes.md)
- [Operations runbook](docs/operations-runbook.md)
- [External Market Engine contract](docs/market-engine-contract.md)

## Security and support

Do not commit `.env`, credentials, OAuth secrets, service-role keys, database
URLs, or Market Engine keys. Treat every `VITE_*` value as public. Report
security issues privately to the repository owner and rotate exposed provider
credentials through the owning platform. Production incidents should begin
with `/health/ready`, CORS preflight, request IDs, Render logs, Supabase provider
settings, and the migration head; use the
[operations runbook](docs/operations-runbook.md) and
[known-issues backlog](docs/architecture/known-issues-and-fixes.md) for ownership
and next steps.
