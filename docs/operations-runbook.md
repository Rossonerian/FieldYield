# FieldYield operations runbook

This runbook separates repository preparation from actions that must be
performed and evidenced in Render, Vercel, Supabase, Google Cloud, and any
future Market Engine. Repository changes alone do not prove those actions.

## Release preparation

1. Require all GitHub Actions jobs: frontend, backend, PostgreSQL, security,
   Docker, and end-to-end.
2. Review `alembic current`, `alembic history`, and the forward migration.
3. Confirm the managed PostgreSQL backup/retention status in Render.
4. Restore the latest backup into a staging clone and record row counts and
   ledger totals before and after `alembic upgrade head`.
5. Run application smoke tests on the clone. Confirm order, match, wallet
   transaction, holding, bonus, and audit history counts did not decrease.
6. Decide forward-fix versus rollback before release. V11 is intentionally
   irreversible; never reset or drop a production database to roll it back.

## Backup and restore rehearsal

- Confirm the provider’s actual backup schedule, retention, encryption, and
  responsible owner. `render.yaml` cannot configure or prove backups.
- Restore to a new isolated database, not over production.
- Verify the Alembic revision, table/index/constraint inventory, user/wallet
  pairs, nonnegative balances/holdings, one match per filled order, and ledger
  totals against wallet changes.
- Record restore duration, recovery point, failures, and approval. A successful
  SQL dump is not proof of a successful restore.

## Secrets and administrator rotation

1. Rotate in the owning provider: database/Redis credentials, `SECRET_KEY`,
   Supabase anon key if required, Google client secret, Market Engine key, and
   `ADMIN_EMAILS` membership.
2. Never paste secret values into tickets, logs, Git, Vercel browser variables,
   or `VITE_*` variables.
3. Restart/redeploy only the affected service, verify readiness, then revoke the
   old value.
4. For admin rotation, add the replacement, verify admin success and audit-row
   creation, remove the previous admin, and verify that account now receives
   403. Do not hardcode an administrator in source.

## Supabase and OAuth validation

- Confirm Site URL and each explicit redirect URL in Supabase.
- Confirm the Google callback in Google Cloud exactly matches the Supabase
  callback, the consent configuration is approved, and only required scopes
  (`openid email profile`) are requested.
- Exercise email/password and Google login, first-profile completion, refresh,
  logout, expired token, suspension, and provider outage.
- Confirm production FastAPI uses `AUTH_PROVIDER=supabase`; it must never fall
  back to local HS256 verification.

## Production CORS and browser security smoke test

```bash
curl -i https://fieldyield-api.onrender.com/health/live
curl -i https://fieldyield-api.onrender.com/health/ready
curl -i -X OPTIONS https://fieldyield-api.onrender.com/api/v1/users/me \
  -H 'Origin: https://field-yield.vercel.app' \
  -H 'Access-Control-Request-Method: GET' \
  -H 'Access-Control-Request-Headers: authorization'
curl -I https://field-yield.vercel.app
```

Expect liveness 200; readiness 200 only when required dependencies are healthy;
the exact allow-origin and no credential header; and CSP, HSTS, nosniff,
referrer, permissions, frame, and opener headers on the frontend. Repeat the
preflight with an unapproved origin and confirm no allow-origin header.

## Readiness and incident response

- Alert on sustained `/health/ready` non-200, not `/health/live` alone.
- Begin an incident with the support-visible `X-Request-ID`; correlate it with
  redacted API logs. Never ask users to send bearer tokens.
- Triage database, Supabase, Redis, and enabled settlement state from readiness;
  then inspect error rate, recent deployment, migration head, and provider
  status. `market_engine: not_configured` is expected while settlement is off.
- Production rate limiting fails closed if Redis is unavailable. Treat the 503
  as a dependency incident rather than bypassing limits.

## Dependency advisory response

1. Reproduce `npm audit`, `npm audit --omit=dev`, and
   `python -m pip_audit -r backend/requirements.txt`.
2. Determine runtime reachability and severity. Resolve every high/critical
   runtime issue before release; document any lower accepted issue with exact
   reachability and compensating control.
3. Update direct pins in `requirements.in`/`requirements-dev.in`, regenerate
   compiled files with Python 3.12 and `pip-compile --strip-extras`, and retain
   the explicit `-r requirements.txt` base in `requirements-dev.txt`. Preserve
   the `uvloop` non-Windows marker when compiling on Linux, update the npm lock
   with the declared npm version, and rerun the full CI matrix.

## External Market Engine enablement checklist

Do not set `MARKET_ENGINE_TRADING_ENABLED=true` until code validation permits
it and all items below have evidence:

- versioned authenticated catalog and fresh-price contracts;
- idempotent order acceptance, fills, cancellation, and stable error schemas;
- signed/replay-safe events and settlement reconciliation;
- timeout, duplicate, partial failure, and out-of-order delivery tests;
- balance/ledger ownership and recovery rules;
- sandbox lifecycle and restore/replay rehearsal;
- monitoring, kill switch, owner, and rollback decision.

The current configuration deliberately rejects enablement because these are not
implemented. No local SQL fill should be presented as external settlement.
