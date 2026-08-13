# FieldYield API

The backend is a FastAPI service for authentication, profiles, wallets, player markets, market orders, portfolios, squads, watchlists, notifications, signup bonuses, catalog ingestion, and administrator status/audit operations. It uses SQLAlchemy with SQLite locally or PostgreSQL in deployment, and Alembic is the single migration authority. Production startup does not seed catalog data. Supabase Auth (including Google OAuth identities) is the production identity authority (`AUTH_PROVIDER=supabase`); the built-in JWT flow is an explicitly configured local/test compatibility mode only.

Runtime dependencies are fully pinned in `requirements.txt`; maintain direct
pins in `requirements.in`. Development/test tools are separately pinned in
`requirements-dev.txt` from `requirements-dev.in`.

Run locally from this directory:

```bash
pip install -r requirements-dev.txt
alembic upgrade head
uvicorn app.main:app --reload
```

Configure `APP_ENV`, `DATABASE_URL`, `REDIS_URL`, `SECRET_KEY`, `AUTH_PROVIDER`,
the explicit `CORS_ORIGINS`, freshness/request/rate limits, administrator
bootstrap emails, and Supabase/Market Engine settings from `.env.example`.
Render's free-plan startup uses a PostgreSQL advisory lock around Alembic before
Uvicorn, preventing competing instances from migrating concurrently. Redis is
required for production distributed rate limiting; financial truth always
remains in PostgreSQL. `/health/live` and `/health/ready` separate liveness from
dependency readiness.
