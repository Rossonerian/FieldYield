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

1. In Render, choose **New > Blueprint**, connect the GitHub repository, and select the root `render.yaml`.
2. Render creates the API web service, Postgres database, Key Value instance, and Celery worker from the Blueprint.
3. Enter the Vercel URL for `FRONTEND_URL` when Render prompts for it. Keep the generated `SECRET_KEY` private.
4. After the API deploys, verify `https://<api-service>.onrender.com/health` returns `{"status":"ok"}`.
5. Run the frontend separately on Vercel with `VITE_API_BASE_URL` pointed at the Render API URL.

The Blueprint uses the free plan for the API, Postgres, and Key Value where Render makes those plans available. Render background workers require a paid `starter` plan, so remove the `fieldyield-worker` entry if this demo does not use Celery jobs yet.

Production TODO: move from Render free-tier experiments to paid services before real users, keep Postgres as the source of truth, and add backups/monitoring/retry policies before launch.
