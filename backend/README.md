# FieldYield API

The backend is a FastAPI service for authentication, profiles, wallets, player markets, market orders, portfolios, squads, watchlists, notifications, signup bonuses, catalog ingestion, and administrator status/audit operations. It uses SQLAlchemy with SQLite locally or PostgreSQL in deployment, and Alembic is the single migration authority. Production startup does not seed catalog data. Supabase Auth (including Google OAuth identities) is the production identity authority (`AUTH_PROVIDER=supabase`); the built-in JWT flow is an explicitly configured local/test compatibility mode only.

Run locally from this directory:

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Apply migrations with `alembic upgrade head`. Configure `DATABASE_URL`, `SECRET_KEY`, `AUTH_PROVIDER`, the strict `FRONTEND_URL`, signup-bonus variables, administrator bootstrap emails, and Supabase/Market Engine settings from `.env.example`. Render uses `start.sh` to run migrations before Uvicorn. Redis and the Celery scaffold remain optional infrastructure; financial state is always stored in the database. `POST /api/v1/admin/catalog/import` is the bounded real-data ingestion boundary until the external Market Engine adds catalog APIs.
