# Deployment and operations

## Repository-defined topology

| Service | Repository configuration | Responsibility |
| --- | --- | --- |
| Vercel | `vercel.json` | `npm ci`, Vite build, SPA routing, browser security headers |
| Render web | `render.yaml`, `backend/Dockerfile` | Non-root FastAPI/Uvicorn API and serialized Alembic migration |
| Render PostgreSQL | private `fieldyield-db` | Authoritative application and financial records |
| Render Key Value | private `fieldyield-redis`, `allkeys-lru` | Distributed rate-limit counters; never financial truth |
| Supabase | public URL + operator secrets/settings | Production identity authority |
| Market Engine | external, disabled | No settlement authority until the contract checklist passes |

These files describe intended deployment. They do not prove that services,
backups, provider settings, secrets, or live health have been configured.

## Vercel

Vercel runs `npm ci` and `npm run build`, serving `dist/`. Configure these
browser-public values separately for each environment:

| Variable | Production shape |
| --- | --- |
| `VITE_API_BASE_URL` | `https://fieldyield-api.onrender.com` (never localhost) |
| `VITE_SUPABASE_URL` | public Supabase project HTTPS URL |
| `VITE_SUPABASE_ANON_KEY` | public anon/publishable key only |
| `VITE_SITE_URL` | exact HTTPS browser origin |

No database URL, signing key, OAuth client secret, service-role key, admin list,
or Market Engine credential may use `VITE_*`.

`vercel.json` defines CSP, nosniff, strict referrer policy, permissions policy,
frame denial, same-origin-allow-popups COOP, and HSTS. The pre-paint theme script
is an external same-origin file, so `script-src` does not need `unsafe-inline`
or `unsafe-eval`. `style-src 'unsafe-inline'` remains because React/Motion use
runtime style attributes; scripts stay strict. COEP is intentionally absent to
avoid breaking OAuth and approved remote images.

## Render

Production validation requires:

```text
APP_ENV=production
DATABASE_URL=<internal Render PostgreSQL connection>
REDIS_URL=<internal Render Key Value connection>
SECRET_KEY=<generated 32+ character secret>
AUTH_PROVIDER=supabase
CORS_ORIGINS=https://field-yield.vercel.app
TRUSTED_PROXY_IPS=<reviewed Render proxy addresses>
SUPABASE_URL=<project HTTPS URL>
SUPABASE_ANON_KEY=<public anon/publishable key>
ADMIN_EMAILS=<reviewed server-only bootstrap list>
ALLOW_TEST_CREDIT=false
MARKET_ENGINE_TRADING_ENABLED=false
```

The environment examples document freshness, request-size, rate-limit, pool,
bonus, Supabase cache/timeout, and optional adapter values. Production settings
fail closed if auth, Redis, exact CORS, or secrets are unsafe.

Both Render data services have `ipAllowList: []`; the web service consumes their
internal connection strings. `autoDeployTrigger: checksPass` waits for repository
checks where supported. The selected plan has no repository-configured
pre-deploy command, so `start.sh` calls `app.migrate`. PostgreSQL takes a stable
session advisory lock around Alembic, ensuring only one instance migrates at a
time; migration failure prevents Uvicorn startup. Uvicorn has a 30-second
graceful shutdown window.

The image is pinned to Python 3.12.13 and its reviewed multi-architecture digest,
installs only fully pinned runtime dependencies, excludes tests/dev tools/local
data, sets read-only application files, and runs as `fieldyield:fieldyield`
(UID/GID 10001). Its container health check uses `/health/live`; Render uses
the dependency-aware `/health/ready`.

## Health contract

- `/health/live`: always dependency-free 200 while the process can serve.
- `/health/ready`: 200 only when database and required Supabase/settlement
  dependencies are healthy; otherwise 503 with component status.
- `/health`: backward-compatible component payload, not the deployment probe.

Market Engine health is optional while trading is disabled. Redis is exercised
by rate-limited requests rather than included as a global readiness dependency;
production requests fail with 503 rather than bypassing protection when Redis
is unavailable.

## Supabase and Google

The operator must verify Supabase Site URL/redirect allowlists, email provider,
Google provider, and the exact Google callback
`<SUPABASE_URL>/auth/v1/callback`. Only `openid email profile` scopes are needed.
Google client secrets stay in provider configuration. Production FastAPI uses
JWKS verification for asymmetric tokens and bounded provider verification for
legacy HS tokens; it never accepts local JWTs as a fallback.

## Release and incidents

Follow [the operations runbook](../operations-runbook.md) for backup/restore
rehearsal, migration decisions, secret/admin rotation, provider validation,
CORS/header smoke tests, dependency response, readiness alerting, request-ID
incident correlation, and Market Engine enablement. A repository merge alone
does not prove any of those external actions.
