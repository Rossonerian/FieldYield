# FieldYield Backend v1

FastAPI backend for the first real exchange release. The default configuration uses SQLite for a quick local run; Docker Compose uses PostgreSQL and Redis.

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
pytest
```

The API is available at `http://localhost:8000`, with OpenAPI docs at `/docs`. Run `alembic upgrade head` for a persistent database. Market orders execute against seeded house bid/ask prices. Wallet changes are paired with immutable `wallet_transactions` rows and order placement accepts idempotency keys.

Render setup:

1. Create a PostgreSQL database and Redis-compatible Key Value instance in the Render dashboard.
2. Create a Web Service from `render.yaml` using `backend/Dockerfile`.
3. Create a Background Worker from `render.yaml` using the same image.
4. Set `DATABASE_URL`, `REDIS_URL`, `SECRET_KEY`, and `FRONTEND_URL` in the Render environment.
5. Run the frontend separately on Vercel with `VITE_API_BASE_URL` pointed at the Render API URL.

Production TODO: move from Render free-tier experiments to paid services before real users, keep Postgres as the source of truth, and add backups/monitoring/retry policies before launch.
