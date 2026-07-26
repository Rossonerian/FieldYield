# Deployment and operations

## Confirmed topology

| Service | Production endpoint/configuration | Responsibility |
| --- | --- | --- |
| Vercel | `https://field-yield.vercel.app` | Builds and serves the Vite `dist/` bundle |
| Render | `https://fieldyield-api.onrender.com` | Runs the FastAPI Docker service, migrations, and SQL API |
| Render PostgreSQL | Render-managed `fieldyield-db` connection string | Persistent application data |
| Render Redis | Render-managed `fieldyield-redis` | Optional Celery/cache acceleration; not financial truth |
| Supabase | Repository-configured Supabase Auth project URL | Auth identities, Google OAuth, and token validation |
| Market Engine | External developer-owned service | Optional server-side diagnostic/order adapter only |

The external Market Engine repository is not part of this repository's build,
deployment, or Git history.

## Vercel frontend

`vercel.json` uses:

```text
installCommand: npm install
buildCommand: npm run build
outputDirectory: dist
```

Set these public build variables in Vercel separately for Preview and
Production:

| Variable | Example placeholder | Notes |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `https://fieldyield-api.onrender.com` | No trailing slash; never localhost in Production |
| `VITE_SUPABASE_URL` | `https://uewpyfwnuiqjzxahmesz.supabase.co` | Public project URL |
| `VITE_SUPABASE_ANON_KEY` | `<public-supabase-anon-key>` | Public anon key only |
| `VITE_SITE_URL` | `https://field-yield.vercel.app` | Exact OAuth browser origin for each environment |

Only variables prefixed `VITE_` are compiled into the browser. Never put
`SUPABASE_SERVICE_ROLE_KEY`, a database URL, signing secret, Google client
secret, or Market Engine credential in Vercel browser variables.

## Render backend

`render.yaml` builds `backend/Dockerfile`, points the health check at `/health`,
and supplies PostgreSQL/Redis service connections. `backend/start.sh` runs
Alembic before Uvicorn, with Render's `PORT` or 8000 as the fallback.

Required server-only variables:

```text
DATABASE_URL=<render-postgresql-connection-string>
REDIS_URL=<render-redis-connection-string>
SECRET_KEY=<generated-server-signing-key>
AUTH_PROVIDER=supabase
FRONTEND_URL=https://field-yield.vercel.app
SUPABASE_URL=https://uewpyfwnuiqjzxahmesz.supabase.co
SUPABASE_ANON_KEY=<server-side-copy-of-public-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<server-only-service-role-key>
ADMIN_EMAILS=<approved-admin-email-list>
SIGNUP_BONUS_ENABLED=true
SIGNUP_BONUS_GOLD=<configured-integer>
SIGNUP_BONUS_SILVER=<configured-integer>
MARKET_ENGINE_BASE_URL=<optional-external-origin>
MARKET_ENGINE_API_KEY=<optional-server-only-key>
MARKET_ENGINE_TIMEOUT_MS=3000
MARKET_ENGINE_VERSION=v1
ALLOW_TEST_CREDIT=false
```

The service-role variable is reserved for server-side administration and is
not currently sent to the browser. `ALLOW_TEST_CREDIT` must remain false in
production. Empty `MARKET_ENGINE_*` values are intentional until the external
contract is complete.

## Supabase Auth and Google

1. Enable Google under Supabase **Authentication → Providers → Google**.
2. Configure the Google Cloud OAuth authorized redirect URI exactly as
   `https://uewpyfwnuiqjzxahmesz.supabase.co/auth/v1/callback`, matching the
   Supabase URL already present in the repository configuration.
3. Add `https://field-yield.vercel.app` as the production origin and add only
   explicitly approved local/preview origins.
4. Set Supabase Site URL to `https://field-yield.vercel.app`.
5. Use only `openid email profile` scopes.
6. Keep Google Client Secret inside Supabase provider configuration. It must
   never be committed or copied to Vercel.

The browser uses Supabase's implicit flow. The FieldYield backend receives the
Supabase bearer token, validates it against `/auth/v1/user`, and maps the
verified Supabase user ID to local records. Supabase provider settings and
redirect allowlists must be configured independently for local, Preview, and
Production.

## Deployment order

1. Back up the Render database and review the Alembic heads.
2. Configure Render server variables and verify Supabase provider settings.
3. Deploy the backend; confirm migrations finish before Uvicorn starts.
4. Check `GET https://fieldyield-api.onrender.com/health` and confirm
   `database: ok`, `supabase: ok`, and the expected optional
   `market_engine` state.
5. Set Vercel public variables and deploy the frontend.
6. Confirm the deployed bundle contains the Render API origin and no localhost
   or server-only secrets.
7. Run the smoke checklist below with a fresh test account.

## Post-deployment smoke checks

```bash
curl -i https://fieldyield-api.onrender.com/health
curl -i -X OPTIONS https://fieldyield-api.onrender.com/api/v1/users/me \
  -H 'Origin: https://field-yield.vercel.app' \
  -H 'Access-Control-Request-Method: GET'
curl -i https://fieldyield-api.onrender.com/api/v1/users/me \
  -H 'Origin: https://field-yield.vercel.app'
curl -I https://field-yield.vercel.app
```

Expected results are health HTTP 200 with truthful component fields, approved
preflight HTTP 200 with the exact `Access-Control-Allow-Origin`, protected
request HTTP 401 with CORS headers, and frontend HTTP 200. An unknown origin
must not receive an allow-origin header.

Then manually verify email/password and Google sign-in, refresh/session
restoration, logout, profile sync, one-time bonus, admin denial for a normal
user, and an empty-catalog state. Do not call a successful trade verified until
the external settlement contract is configured and tested.

## Logs, migration, and rollback

Render logs contain Uvicorn request logs, exception traces, and startup output
such as the allowed CORS origin. Do not copy tokens or provider payloads into
logs. Alembic runs on every Render boot; a failed migration should prevent the
API process from starting. Back up before upgrades and rehearse rollback on a
staging database because the notebook-removal migration intentionally does not
recreate historical tables on downgrade.

For an incident, check in order: Vercel build/deploy status, deployed API base
URL, `/health`, CORS preflight, Supabase provider/redirect settings, Render
logs, database migration head, and only then the optional Market Engine health
endpoint. A `market_engine: not_configured` result is an external integration
status, not a database or authentication failure.

## Security rules

- Never commit `.env`, `.env.local`, Render exports, Supabase keys, OAuth
  secrets, database URLs, or Market Engine credentials.
- Treat all `VITE_*` values as public; use Supabase RLS and server validation
  for authorization.
- Keep one exact production CORS origin. Preview origins require an explicit
  configuration decision; do not use `*` or broad wildcards with credentials.
- Rotate exposed credentials through the owning provider, not through Git.
- Keep admin bootstrap emails in Render secrets and audit all status/catalog
  mutations.
