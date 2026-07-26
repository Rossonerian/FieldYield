# FieldYield

FieldYield is a responsive React/Vite football-asset trading interface backed
by a FastAPI service, SQL persistence, and Supabase Auth. V1 supports real
authenticated profiles, wallets, catalog-backed market orders, holdings,
squads, watchlists, notifications, and server-controlled signup bonuses.

## Current status

The V1 frontend and API are deployed through Vercel and Render. Supabase Auth
is the production identity authority when `AUTH_PROVIDER=supabase`; local JWT
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
     -> optional Redis/Celery infrastructure
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
- Portfolio, wallet ledger, holdings, squad, watchlist, and notification APIs
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

## Prerequisites and local setup

- Node.js 20.19+ (Vite 7)
- Python 3.12+
- PostgreSQL for production-like local work; SQLite is sufficient for tests

```bash
npm install
cp .env.example .env.local
npm run dev

cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
alembic upgrade head
uvicorn app.main:app --reload
```

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
`AUTH_PROVIDER`, `FRONTEND_URL`, signup-bonus values, Supabase server values,
`ADMIN_EMAILS`, `ALLOW_TEST_CREDIT`, and `MARKET_ENGINE_*`. Use placeholders
only; the complete reference is in [deployment and operations](docs/architecture/deployment-and-operations.md).

## Validation

```bash
node -v                         # Node 20.19+
npm install
npm run typecheck
npm run build
npm audit --audit-level=high

cd backend
.venv/bin/pytest -q
DATABASE_URL=sqlite:///./validation.db .venv/bin/alembic upgrade head
DATABASE_URL=sqlite:///./validation.db .venv/bin/alembic check
git diff --check
```

Do not run destructive database resets against production. Generated build,
cache, virtual-environment, and environment files are ignored by Git.

## Deployment summary

- **Vercel:** `npm install`, `npm run build`, serve `dist/`; configure the four
  `VITE_*` variables for Preview/Production.
- **Render:** builds `backend/Dockerfile`; `backend/start.sh` runs
  `alembic upgrade head` before Uvicorn; configure server-only variables.
- **Supabase:** enable Auth providers, Google callback/site URL, and approved
  redirect origins. The exact callback and OAuth flow are documented in
  [frontend flow](docs/architecture/frontend-flow.md).
- **Health:** `GET https://fieldyield-api.onrender.com/health` must report
  database and selected auth readiness truthfully. `market_engine: not_configured`
  is expected until the external contract is enabled.

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
- [External Market Engine contract](docs/market-engine-contract.md)

## Security and support

Do not commit `.env`, credentials, OAuth secrets, service-role keys, database
URLs, or Market Engine keys. Treat every `VITE_*` value as public. Report
security issues privately to the repository owner and rotate exposed provider
credentials through the owning platform. Production incidents should begin
with `/health`, CORS preflight, Render logs, Supabase provider settings, and
the migration head; use the [known-issues backlog](docs/architecture/known-issues-and-fixes.md)
for ownership and next steps.
