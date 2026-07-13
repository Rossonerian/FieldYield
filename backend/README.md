# FieldYield API

The backend is a FastAPI service for authentication, profiles, wallets, player markets, market orders, portfolios, squads, and in-app notifications. It uses SQLAlchemy with SQLite locally or PostgreSQL in deployment, and Alembic for migrations.

Run locally from this directory:

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Apply migrations with `alembic upgrade head`. Configure `DATABASE_URL`, `SECRET_KEY`, `FRONTEND_URL`, and optional signup-bonus variables from `.env.example`. Redis and the Celery scaffold remain optional infrastructure; financial state is always stored in the database.
