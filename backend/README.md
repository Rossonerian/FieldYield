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
2. Render creates the API web service, Postgres database, and Key Value instance from the Blueprint.
3. Enter the Vercel URL for `FRONTEND_URL` when Render prompts for it. Keep the generated `SECRET_KEY` private.
4. After the API deploys, open the API service shell in Render and run `alembic upgrade head` once to create/update the database tables.
5. Verify `https://<api-service>.onrender.com/health` returns `{"status":"ok"}`.
6. Run the frontend separately on Vercel with `VITE_API_BASE_URL` pointed at the Render API URL.

The Blueprint uses only free Render resources for the demo: the API web service, Postgres database, and Key Value instance. Render free web services do not support pre-deploy commands, so database migrations must be run manually from the service shell unless the API is upgraded to a paid plan. Background workers are intentionally omitted because Render does not provide a free worker plan.

Production TODO: move from Render free-tier experiments to paid services before real users, keep Postgres as the source of truth, and add backups/monitoring/retry policies before launch.
