# FieldYield

FieldYield is a React/Vite football asset-trading frontend paired with a FastAPI/SQLAlchemy API. It supports authenticated profiles, compact wallets, player markets, market orders, portfolios, squads, watchlists, notifications, and native light/dark themes.

## Current status

The project is an active full-stack MVP. Authentication, age verification, profile editing, wallet balances, market orders, portfolio summaries, and in-app notifications are backend-backed. Persistent watchlists, limit-order trading, market scheduling, and push notifications are not yet implemented. The removed live sports notebook is no longer part of the product.

## Stack

- Frontend: React 19, TypeScript, Vite 7, Tailwind CSS 4, Motion, Lucide-compatible icons.
- Backend: Python 3.12+, FastAPI, SQLAlchemy 2, Alembic, Pydantic, JWT, passlib.
- Storage: SQLite for local development; PostgreSQL for deployment.
- Optional infrastructure: Redis/Celery scaffolding, never authoritative for financial state.

## Structure

```text
src/
  app/                 application shell and navigation
  components/          shared UI and layout primitives
  context/             theme context
  features/            auth, dashboard, markets, portfolio, squad, watchlist, settings, trading
  lib/api.ts           browser API client
backend/
  app/main.py          FastAPI routes and startup
  app/models.py        SQLAlchemy models
  app/schemas.py       request/response validation
  app/services.py      authentication, wallet and order services
  alembic/             database migrations
  tests/               backend concurrency and API tests
```

## Development

```bash
npm install
npm run dev
npm run typecheck
npm run build

cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
pytest
```

The frontend reads `VITE_API_BASE_URL`. The backend reads `DATABASE_URL`, `SECRET_KEY`, `FRONTEND_URL`, optional Redis settings, and the signup-bonus settings in `backend/.env.example`.

## Authenticated API areas

- `/api/v1/auth/*` — registration and login.
- `/api/v1/users/me` — profile read/update and account summary.
- `/api/v1/wallet/*` — balances and bounded ledger.
- `/api/v1/trading/orders/*` — market buy/sell and bounded order history.
- `/api/v1/portfolio/*` — portfolio totals and holdings.
- `/api/v1/squad/*` — active squad operations.
- `/api/v1/market/prices` — seeded market prices.
- `/api/v1/notifications/*` — bounded user notifications and read state.

All private routes derive the user from the bearer token. Password hashes, balances, verification state, signup-bonus state, and roles cannot be changed through profile APIs.

## Signup bonus

The one-time signup credit is processed in the registration transaction and protected by unique per-user idempotency keys. It is disabled by default; enable it explicitly with `SIGNUP_BONUS_ENABLED=true`, `SIGNUP_BONUS_GOLD`, and/or `SIGNUP_BONUS_SILVER`. Existing users are not awarded retroactively.

## Migrations

Run `alembic upgrade head` before deployment. Migration `v3_user_profiles_bonus` adds compact profile and bonus fields. Migration `v4_remove_live_notebook` safely drops the obsolete provider notebook tables without recreating them on downgrade.

## Validation

The production frontend is validated with `npm run typecheck` and `npm run build`. Backend tests are run with `pytest backend/tests`. There is currently no frontend lint script or CI workflow in the repository.

## Limitations

Market catalog data is seeded by the backend. Some dashboard presentation widgets and watchlist controls remain frontend-only until their persistence APIs are added. Market-order review panels do not yet submit persistent limit orders. Push delivery, scheduler workers, provider reconciliation, and admin review queues are not implemented.
