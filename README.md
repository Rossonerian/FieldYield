# FieldYield

FieldYield is a football asset-trading platform with a React + Vite frontend and a FastAPI backend. The current codebase is a full-stack MVP used for local/demo trading flows, backend-authenticated access, and Bzzoiro-powered sports data browsing.

Current stage: active MVP / production hardening.

Main purpose: let users browse football markets, inspect portfolio and squad states, review trades, and read sports fixtures in a closed-loop environment.

Intended users: internal testers, demo users, and developers working on the frontend/backend integration.

## Table of Contents

- [Project Overview](#project-overview)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Repository Structure](#repository-structure)
- [System Architecture](#system-architecture)
- [Application Startup Flow](#application-startup-flow)
- [Environment Variables](#environment-variables)
- [Installation](#installation)
- [Development Workflow](#development-workflow)
- [Production Deployment](#production-deployment)
- [API Reference](#api-reference)
- [Authentication and Authorization](#authentication-and-authorization)
- [Database](#database)
- [Core Business Logic](#core-business-logic)
- [Frontend Architecture](#frontend-architecture)
- [Backend Architecture](#backend-architecture)
- [Caching](#caching)
- [Notifications](#notifications)
- [Real-time Functionality](#real-time-functionality)
- [External Services](#external-services)
- [Validation and Error Handling](#validation-and-error-handling)
- [Security](#security)
- [Logging and Monitoring](#logging-and-monitoring)
- [Scripts and Commands](#scripts-and-commands)
- [CI/CD](#cicd)
- [Testing Status](#testing-status)
- [Known Limitations](#known-limitations)
- [Troubleshooting](#troubleshooting)
- [Contributing and Coding Conventions](#contributing-and-coding-conventions)
- [License](#license)

## Project Overview

The repository contains two coordinated parts:

- A React frontend under `src/` that renders the trading UI, navigation, action search, dashboard carousels, trading review dialogs, notification drawer, theme switch, and responsive dock/mobile navigation.
- A FastAPI backend under `backend/` that provides JWT auth, age verification, wallet and trading endpoints, sports data sync and cleanup endpoints, and a Bzzoiro-backed cache layer for league/fixture/player data.

The main user journey is:

1. Open the frontend.
2. Sign up or log in through the auth screen.
3. Store the returned JWT in browser localStorage.
4. Browse the dashboard, markets, portfolio, squad, watchlist, settings, search, notifications, and dialogs.
5. Use backend-backed sports data notebook and account endpoints where wired.

What is currently implemented:

- Responsive React screens for dashboard, markets, portfolio, squad, watchlist, settings, asset detail, auth, search, dialogs, notifications, and navigation.
- Backend authentication, age verification, wallet crediting, market buy/sell order execution, squad promotion/demotion, sports sync, sports cleanup, and sports browsing APIs.
- SQLite local mode, PostgreSQL deployment support, Redis-backed cache access for sports provider reads, and Alembic migration files.

What is not implemented:

- Refresh tokens.
- Cookie-based sessions.
- Real push notifications.
- WebSockets or SSE.
- Background jobs that actually run application work.
- Frontend lint script.
- Frontend test suite.
- A CI workflow directory in this repository.

Important limitations:

- The React trading panels are review flows; they do not currently submit buy/sell actions back to the backend.
- The frontend portfolio, squad, watchlist, and notification surfaces are mostly local/demo state.
- The backend includes a Celery app and Docker Compose worker service, but there are no Celery tasks defined in the codebase.
- Startup calls `Base.metadata.create_all(...)`, so schema creation happens at runtime in addition to Alembic migrations.

## Features

| Feature | Where it is implemented | Frontend components | Backend modules / routes | Database tables | Validation / permissions / errors | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Auth screen | `src/features/auth/AuthPage.tsx`, `src/app/App.tsx`, `src/lib/api.ts` | `AuthPage` | `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `GET /api/v1/users/me` | `users`, `wallets` | Email format, password length/policy on frontend, backend age check, duplicate email check, invalid credentials, token validation | Frontend stores JWT in `localStorage` under `fieldyield.authToken` |
| Age verification | `backend/app/main.py`, `backend/app/services.py`, `backend/app/api/deps.py` | None directly | `POST /api/v1/users/verify-age` | `users` | Requires authenticated user, rejects users under 18 | `verified_user` dependency gates wallet credit and trading routes |
| Dashboard | `src/features/dashboard/Dashboard.tsx`, `src/components/ui/card-carousel.tsx`, `src/components/shared/field-components.tsx` | `Dashboard`, `CardCarousel`, `GlassCard`, `CardTitle`, `BadgeDelta`, `AssetRow`, `FeedRow`, `MiniChart`, `RankList` | No backend dependency in the current UI | None | Local state filters for movers/trending/dividends | Uses static data from `src/data/fieldyield.ts` |
| Markets | `src/features/markets/Markets.tsx`, `src/features/markets/SportsDataNotebook.tsx`, `src/components/shared/field-components.tsx` | `Markets`, `SportsDataNotebook`, `GlassCard`, `PlayerTable`, `Button`, `Input` | `GET /api/v1/sports/leagues`, `GET /api/v1/sports/fixtures`, optional backend sports sync routes | `sports_leagues`, `sports_fixtures`, `sports_teams`, `sports_players`, `sports_sync_runs` | Query validation on backend (`limit`, `offset` bounds); provider token requirement for refresh/sync | Main market table in the current UI is local demo data; notebook fetches backend sports data |
| Portfolio | `src/features/portfolio/Portfolio.tsx` | `Portfolio`, `GlassCard`, `BadgeDelta`, `PlayerTable`, `Bars`, `Donut`, `TreeMap` | Backend portfolio routes exist but are not currently wired to this UI | Frontend demo state; backend uses `holdings` and `orders` if called | Local filters on holdings; backend requires auth for portfolio routes | Portfolio screen is currently presentation-first |
| Squad | `src/features/squad/Squad.tsx` | `Squad`, `HoldAndReleaseButton`, `Avatar`, `Badge`, `GlassCard` | Backend squad routes exist but are not currently wired to this UI | Frontend demo state; backend uses `active_squad`, `holdings` | Frontend hold-to-reserve timing; backend requires auth and verified user for promote | Current UI uses local slot state |
| Watchlist | `src/features/watchlist/Watchlist.tsx`, `src/components/shared/field-components.tsx` | `Watchlist`, `AssetRow`, `Input`, `EmptyWatchlist` | No backend calls in the current UI | None | Local removal and alert field interactions | This is a client-side watchlist surface |
| Settings | `src/features/settings/SettingsPage.tsx`, `src/features/theme/ThemeSwitch.tsx`, `src/context/ThemeContext.tsx` | `SettingsPage`, `ThemeSwitch`, `Button`, `Input`, `Badge` | No backend calls in the current UI | None | Local tab/pill state; theme persistence in `localStorage` | Theme is applied via `document.documentElement.dataset.theme` |
| Search / command palette | `src/features/search/ActionSearchBar.tsx` | `ActionSearchBar`, `Button`, `Input`, `AnimatedIcon`, `SearchIcon` | Triggers existing frontend navigation/actions only | None | Keyboard navigation, Escape close, arrow navigation, Enter execute | Search items are assembled in `src/app/App.tsx` |
| Notifications | `src/features/notifications/NotificationDrawer.tsx`, `src/components/ui/alert-badge.tsx` | `NotificationDrawer`, `NotificationItem`, `AlertBadge`, `Button` | `GET /api/v1/notifications`, `POST /api/v1/notifications/{notification_id}/read` | `notifications` | Auth required; read state update requires ownership | Current drawer content is local demo data, backend endpoints exist |
| Asset detail / trading review | `src/features/assets/AssetPage.tsx`, `src/features/trading/TradingDialogs.tsx`, `src/features/trading/TradeButton.tsx`, `src/features/trading/HoldAndReleaseButton.tsx` | `AssetPage`, `TradeButton`, `HoldAndReleaseButton`, `Dialog`, `Input`, `BadgeDelta`, `MiniChart`, `OrderBook`, `DividendTable` | Backend trading endpoints exist but are not currently called by these review panels | Frontend demo state; backend uses `orders`, `order_matches`, `wallet_transactions`, `holdings` if called | Frontend validates button states and hold timing; backend validates auth, age verification, active EPL player, quantity, wallet balance, holdings | Buy/Sell interactions are visual review flows in the React UI |
| Backend wallet and trading API | `backend/app/main.py`, `backend/app/services.py`, `backend/app/api/deps.py` | None | `POST /api/v1/wallet/credit`, `GET /api/v1/wallet`, `GET /api/v1/wallet/ledger`, `POST /api/v1/trading/orders/market-buy`, `POST /api/v1/trading/orders/market-sell`, `GET /api/v1/trading/orders`, `GET /api/v1/portfolio`, `GET /api/v1/portfolio/holdings`, `GET /api/v1/squad`, `POST /api/v1/squad/promote`, `POST /api/v1/squad/demote` | `wallets`, `wallet_transactions`, `orders`, `order_matches`, `holdings`, `active_squad` | JWT bearer auth, age verification for trading/credit, quantity and balance checks, unique idempotency keys | Wallet credit and order placement create notification rows |
| Sports data sync | `backend/app/sports_data.py`, `backend/app/main.py` | `SportsDataNotebook` | `GET /api/v1/sports/leagues`, `GET /api/v1/sports/teams`, `GET /api/v1/sports/fixtures`, `GET /api/v1/sports/provider-players`, `POST /api/v1/sports/ingest`, `POST /api/v1/sports/sync/top-leagues`, `POST /api/v1/sports/cleanup` | `sports_leagues`, `sports_teams`, `sports_fixtures`, `sports_players`, `sports_sync_runs` | Requires `BZZOIRO_API_KEY` for provider-backed reads; query bounds enforced by FastAPI | Redis caching is used for provider reads when available |

## Technology Stack

| Area | Technology | Version / source |
| --- | --- | --- |
| Language | TypeScript, Python | `tsconfig.json`, `backend/requirements.txt` |
| Frontend framework | React, React DOM | `package.json` (`19.1.0`) |
| Frontend build tool | Vite | `package.json` (`7.0.5`), `vite.config.ts` |
| Styling | Tailwind CSS 4, scoped `fy-*` CSS, CSS variables | `package.json` (`4.3.2`), `src/styles.css` |
| Animation | Motion | `package.json` (`12.42.2`) |
| UI primitives | `class-variance-authority`, `@radix-ui/react-slot`, `clsx`, `tailwind-merge` | `package.json` |
| Icons | `lucide-react`, local animated Lucide-compatible icon components | `package.json`, `src/components/ui/*.tsx` |
| Frontend telemetry | Vercel Speed Insights | `src/main.tsx`, `package.json` |
| Backend framework | FastAPI | `backend/requirements.txt` (`0.115.6`) |
| ORM | SQLAlchemy | `backend/requirements.txt` (`>=2.0.50,<2.1`) |
| Migrations | Alembic | `backend/requirements.txt` (`1.14.1`), `backend/alembic/` |
| Auth | python-jose JWT, passlib `pbkdf2_sha256` | `backend/requirements.txt` |
| Validation | Pydantic / pydantic-settings | `backend/requirements.txt` |
| Cache / broker | Redis | `backend/requirements.txt`, `backend/docker-compose.yml`, `render.yaml` |
| Worker runtime | Celery | `backend/requirements.txt`, `backend/app/core/celery_app.py` |
| Database | SQLite locally, PostgreSQL in Docker/Render | `backend/app/core/config.py`, `backend/docker-compose.yml`, `render.yaml` |
| Test tooling | pytest, httpx test client | `backend/requirements.txt`, `backend/tests/` |
| Deployment | Vercel frontend, Render backend blueprint | `vercel.json`, `render.yaml`, `backend/Dockerfile` |

## Repository Structure

```text
README.md
.env.example
package.json
vite.config.ts
tsconfig.json
vercel.json
render.yaml
components.json
src/
  main.tsx
  styles.css
  app/
    App.tsx
    navigation.tsx
  context/
    ThemeContext.tsx
  data/
    fieldyield.ts
  features/
    auth/
    assets/
    dashboard/
    markets/
    notifications/
    portfolio/
    search/
    settings/
    squad/
    theme/
    trading/
    watchlist/
  components/
    layout/
    shared/
    ui/
  lib/
    api.ts
    utils.ts
backend/
  app/
    main.py
    models.py
    schemas.py
    services.py
    sports_data.py
    api/
      deps.py
    core/
      config.py
      database.py
      redis.py
      security.py
      celery_app.py
  alembic/
    env.py
    versions/
  tests/
  Dockerfile
  docker-compose.yml
  requirements.txt
  alembic.ini
  .env.example
```

## System Architecture

### High-level

```mermaid
flowchart LR
  Browser[Browser / React frontend] -->|Bearer JWT + JSON| API[FastAPI backend]
  Browser -->|Static demo state| UI[Local UI state]
  API --> DB[(SQLite locally / PostgreSQL in Render)]
  API --> R[(Redis)]
  API --> Bzzoiro[Bzzoiro sports API]
  R --> API
  API --> Browser
```

### Request Lifecycle

```mermaid
sequenceDiagram
  participant U as User
  participant F as Frontend
  participant A as FastAPI
  participant D as Database
  participant R as Redis
  participant B as Bzzoiro

  U->>F: Open page or submit form
  F->>A: GET/POST request
  A->>D: Validate / read / write ORM models
  alt sports provider read
    A->>R: Check cache
    R-->>A: cached payload or miss
    A->>B: Fetch provider payload on miss
    B-->>A: JSON payload
    A->>R: Store TTL cache entry
  end
  A-->>F: JSON response or HTTPException
  F-->>U: Update UI state or show error
```

### Authentication Flow

```mermaid
sequenceDiagram
  participant U as User
  participant F as React app
  participant A as FastAPI
  participant D as Database

  U->>F: Enter email and password
  F->>A: POST /api/v1/auth/login
  A->>D: Verify password hash in users table
  A-->>F: JWT access token
  F->>F: Store token in localStorage
  F->>A: GET /api/v1/users/me with Authorization: Bearer
  A->>D: Decode token and load current user
  A-->>F: Current user payload
```

### Database Overview

```mermaid
erDiagram
  users ||--|| wallets : owns
  users ||--o{ wallet_transactions : records
  users ||--o{ orders : places
  users ||--o{ holdings : holds
  users ||--o{ active_squad : selects
  users ||--o{ notifications : receives
  players ||--o{ market_prices : priced_by
  players ||--o{ orders : traded_in
  players ||--o{ holdings : held_as
  players ||--o{ active_squad : selected_in
  orders ||--o{ order_matches : fills
  sports_leagues ||--o{ sports_teams : contains
  sports_leagues ||--o{ sports_fixtures : schedules
  sports_teams ||--o{ sports_players : fields
  sports_sync_runs ||--o{ sports_leagues : sync_scope
```

### Core Workflow

```mermaid
flowchart TD
  A[Login or register] --> B[JWT issued]
  B --> C[Browse dashboard, markets, portfolio, squad, watchlist]
  C --> D[Open asset or trading review]
  D --> E[Frontend state change only]
  C --> F[Open sports notebook]
  F --> G[Fetch leagues and fixtures from backend]
  G --> H[Redis cache or provider fetch]
```

## Application Startup Flow

### Frontend

1. `npm install`
2. `npm run dev` starts Vite on the default `5173` dev port.
3. `src/main.tsx` mounts `ThemeProvider`, `App`, and `SpeedInsights`.
4. `src/app/App.tsx` renders the auth screen until a JWT is found and `/api/v1/users/me` succeeds.
5. `src/styles.css` provides the Retro-Glass theme variables and scoped utility classes.

### Backend

1. `cd backend`
2. Create and activate a virtual environment.
3. `pip install -r requirements.txt`
4. `uvicorn app.main:app --reload` loads `backend/app/main.py`.
5. FastAPI startup calls `Base.metadata.create_all(engine)` and then `seed_players(db)`.
6. CORS is configured from `FRONTEND_URL`.
7. API routes are registered directly in `backend/app/main.py`.
8. Production Docker startup uses `backend/Dockerfile` and respects `${PORT:-8000}`.
9. Persistent deployments should run `alembic upgrade head` manually or during deployment.

## Environment Variables

### Frontend

| Variable | Required | Default | Purpose | Used in | Format | Example | Scope | Sensitivity | Production notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `VITE_API_BASE_URL` | No | `""` | Base URL for backend API requests | `src/lib/api.ts` | URL or empty string | `http://localhost:8000` | Public | Low | Set to the deployed backend origin in production |

### Backend

| Variable | Required | Default | Purpose | Used in | Format | Example | Scope | Sensitivity | Production notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `DATABASE_URL` | Yes in persistent deployments | `sqlite:///./fieldyield.db` | SQLAlchemy database URL | `backend/app/core/config.py`, `backend/app/core/database.py`, Alembic | SQLAlchemy URL | `postgresql+psycopg://user:pass@host:5432/fieldyield` | Server-only | High | Use PostgreSQL in Render / Docker deployments |
| `REDIS_URL` | Yes if Redis-backed provider cache or Celery is used | `redis://localhost:6379/0` | Redis cache / broker URL | `backend/app/core/config.py`, `backend/app/core/redis.py`, `backend/app/core/celery_app.py`, `backend/app/sports_data.py` | Redis URL | `redis://localhost:6379/0` | Server-only | Medium | Optional for local SQLite runs, required for provider cache and Docker blueprint |
| `SECRET_KEY` | Yes in production | `change-me-in-development` | JWT signing secret | `backend/app/core/config.py`, `backend/app/core/security.py` | Long random string | `replace-with-long-random-secret` | Server-only | High | Keep private and rotate if exposed |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | `60` | JWT lifetime | `backend/app/core/config.py`, `backend/app/core/security.py` | Integer minutes | `60` | Server-only | Low | Shorter lifetimes reduce token exposure |
| `FRONTEND_URL` | Yes | None | Allowed CORS origin and production frontend origin check | `backend/app/core/config.py`, `backend/app/main.py`, Render blueprint | HTTPS origin | `https://your-app.vercel.app` | Server-only | Low | Must be HTTPS and not localhost |
| `BZZOIRO_API_KEY` | Required for provider sync/fetch routes | None | Auth token for Bzzoiro sports API | `backend/app/sports_data.py`, `render.yaml` | Token string | `replace-with-bzzoiro-token` | Server-only | High | Without it, sports provider routes return 503 |
| `BZZOIRO_BASE_URL` | No | `https://sports.bzzoiro.com` | Bzzoiro API base URL | `backend/app/core/config.py`, `backend/app/sports_data.py`, `render.yaml` | HTTPS URL | `https://sports.bzzoiro.com` | Server-only | Low | Change only if the provider endpoint moves |
| `BZZOIRO_CACHE_TTL_SECONDS` | No | `300` | Default TTL for cached provider responses | `backend/app/core/config.py`, `backend/app/sports_data.py`, `render.yaml` | Integer seconds | `300` | Server-only | Low | Longer TTLs reduce provider traffic |

The root `.env.example` covers the frontend variable. The backend has its own `.env.example` in `backend/`.

## Installation

### Required software

- Node.js `20.19+` or `22.12+`
- npm
- Python `3.12+` recommended for the backend container/runtime
- SQLite for local default backend runs
- PostgreSQL and Redis for Docker/Render deployment

### Frontend

```bash
npm install
npm run dev
```

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Database setup

Local backend startup creates the schema automatically with `Base.metadata.create_all(engine)`. For persistent databases, apply migrations manually:

```bash
cd backend
alembic upgrade head
```

### Seed data

There is no dedicated seed script. The backend seeds a small set of EPL players on startup, and sports data can be populated with:

```bash
POST /api/v1/sports/ingest
POST /api/v1/sports/sync/top-leagues
```

### Production startup

- Frontend: `npm run build` then deploy the `dist/` output through Vercel.
- Backend: run the Docker image or `uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}` after setting environment variables.

## Development Workflow

- Frontend development: `npm run dev`
- Frontend type check: `npm run typecheck`
- Frontend build: `npm run build`
- Frontend preview: `npm run preview`
- Backend development: `cd backend && uvicorn app.main:app --reload`
- Backend tests: `cd backend && pytest`
- Backend migrations: `cd backend && alembic revision --autogenerate -m "..."` then `alembic upgrade head`
- Backend database reset in local SQLite mode: delete `backend/fieldyield.db` and restart the backend
- Backend sports data refresh: use `POST /api/v1/sports/sync/top-leagues`

There is no frontend lint command configured in `package.json`.

## Production Deployment

### Frontend

- `vercel.json` pins the build command to `npm run build` and publishes `dist/`.
- `src/main.tsx` includes `@vercel/speed-insights/react`.
- No custom CDN, reverse proxy, or edge middleware is defined in this repository.

### Backend

- `render.yaml` defines the production blueprint.
- The API service uses `backend/Dockerfile`.
- PostgreSQL and Redis are provisioned by the Render blueprint.
- `healthCheckPath` is `/health`.
- `FRONTEND_URL` must be set to the deployed Vercel origin.
- `BZZOIRO_API_KEY` must be supplied for sports sync and fixture/league fetches.
- Persistent deployments should run Alembic migrations before serving traffic if schema changes exist.

### Local Docker Compose

`backend/docker-compose.yml` starts API, worker, PostgreSQL, and Redis. The worker container is present, but there are no Celery tasks in the codebase, so it currently has no application workload.

## API Reference

### Health

| Method | Route | Purpose | Auth | Notes |
| --- | --- | --- | --- | --- |
| `GET` | `/health` | Health check | No | Returns `{"status":"ok"}` |

### Authentication

| Method | Route | Purpose | Auth | Request / response |
| --- | --- | --- | --- | --- |
| `POST` | `/api/v1/auth/register` | Create a user | No | Body: `email`, `password`, `date_of_birth`. Returns `id` and `email` |
| `POST` | `/api/v1/auth/login` | Exchange email/password for JWT | No | Body: `email`, `password`. Returns `access_token` and `token_type` |
| `POST` | `/api/v1/auth/token` | OAuth2 password grant token endpoint | No | Form body via `OAuth2PasswordRequestForm`. Returns JWT JSON |

### Users

| Method | Route | Purpose | Auth | Notes |
| --- | --- | --- | --- | --- |
| `GET` | `/api/v1/users/me` | Current user profile | Bearer JWT | Returns `id`, `email`, `age_verified` |
| `POST` | `/api/v1/users/verify-age` | Mark the user as age verified | Bearer JWT | Requires 18+ date of birth |

### Wallet

| Method | Route | Purpose | Auth | Notes |
| --- | --- | --- | --- | --- |
| `GET` | `/api/v1/wallet` | Wallet balance | Bearer JWT | Returns gold and silver balances |
| `GET` | `/api/v1/wallet/ledger` | Wallet transaction history | Bearer JWT | Ordered newest-first |
| `POST` | `/api/v1/wallet/credit` | Add test/demo currency | Bearer JWT + age verified | Uses idempotency key when provided |

### Trading

| Method | Route | Purpose | Auth | Notes |
| --- | --- | --- | --- | --- |
| `POST` | `/api/v1/trading/orders/market-buy` | Execute a market buy | Bearer JWT + age verified | Only active EPL players are allowed |
| `POST` | `/api/v1/trading/orders/market-sell` | Execute a market sell | Bearer JWT + age verified | Rejects oversells and missing holdings |
| `GET` | `/api/v1/trading/orders` | List orders | Bearer JWT | Ordered newest-first |

### Portfolio and Squad

| Method | Route | Purpose | Auth | Notes |
| --- | --- | --- | --- | --- |
| `GET` | `/api/v1/portfolio` | Portfolio summary | Bearer JWT | Calculates market value, cost basis, unrealized and realized P/L |
| `GET` | `/api/v1/portfolio/holdings` | Holdings list | Bearer JWT | Joins holdings to players |
| `GET` | `/api/v1/squad` | Active squad list | Bearer JWT | Ordered by squad position |
| `POST` | `/api/v1/squad/promote` | Add a held player to the active squad | Bearer JWT + age verified | Caps active squad at 25 |
| `POST` | `/api/v1/squad/demote` | Remove an active squad player | Bearer JWT | Returns 404 if the player is not active |

### Sports data

| Method | Route | Purpose | Auth | Notes |
| --- | --- | --- | --- | --- |
| `GET` | `/api/v1/sports/trading-players` | Seeded EPL players | No | Returns players from the local trading seed |
| `GET` | `/api/v1/sports/leagues` | Top UEFA leagues | No | Provider-backed, cached in Redis when available |
| `GET` | `/api/v1/sports/teams` | Teams for a league | No | Query: `league`, `limit`, `offset`, `refresh` |
| `GET` | `/api/v1/sports/fixtures` | Fixtures for a league | No | Query: `league`, `date_from`, `date_to`, `status`, `season_id`, `limit`, `offset`, `refresh` |
| `GET` | `/api/v1/sports/provider-players` | Provider players by team | No | Query: `team_id`, `limit`, `offset`, `refresh` |
| `POST` | `/api/v1/sports/ingest` | Seed local EPL trading rows | No | Re-runs the small local seed set |
| `POST` | `/api/v1/sports/sync/top-leagues` | Sync top-league metadata and short fixture window | No | Creates a `sports_sync_runs` row |
| `POST` | `/api/v1/sports/cleanup` | Delete stale fixtures and stale provider player rows | No | Retention: 540 days for finished fixtures, 90 days for players |

### Market and notifications

| Method | Route | Purpose | Auth | Notes |
| --- | --- | --- | --- | --- |
| `GET` | `/api/v1/market/prices` | Current market price snapshot | No | Returns player symbol/name/bid/ask/timestamp |
| `GET` | `/api/v1/notifications` | List user notifications | Bearer JWT | Ordered newest-first |
| `POST` | `/api/v1/notifications/{notification_id}/read` | Mark a notification read | Bearer JWT | Requires ownership of the notification |

## Authentication and Authorization

- Registration uses email, password, and date of birth.
- Passwords are hashed with `pbkdf2_sha256`.
- Login returns an HS256 JWT containing the user id in `sub`.
- The frontend stores the access token in `localStorage` under `fieldyield.authToken`.
- The frontend sends the token in the `Authorization: Bearer ...` header.
- There is no refresh token flow.
- There are no cookie-based sessions.
- `current_user` reads and validates the bearer token.
- `verified_user` blocks wallet credit and trading endpoints until age verification is complete.
- CORS is restricted to `FRONTEND_URL`.

## Database

### Tables

| Table | Purpose | Key columns / constraints | Read by | Written by |
| --- | --- | --- | --- | --- |
| `users` | User identity and age verification | `id` PK, `email` unique/indexed, `password_hash`, `date_of_birth`, `age_verified`, `created_at` | Auth deps, profile endpoints | Register, age verification |
| `wallets` | Per-user wallet balances | `id` PK, `user_id` unique FK, `gold`, `silver` | Wallet routes, trading service | Register, credit, trading |
| `wallet_transactions` | Immutable wallet ledger | `id` PK, `user_id` FK/index, `currency`, `amount`, `reason`, `idempotency_key` unique, `created_at` | Wallet ledger | Credit, trading |
| `players` | Local trading assets | `id` PK, `symbol` unique/indexed, `name`, `league`, `club`, `active` | Trading, markets, squad | Seed routine |
| `market_prices` | Local bid/ask snapshot | `id` PK, `player_id` unique FK, `bid`, `ask`, `updated_at` | Trading, portfolio pricing | Seed routine |
| `orders` | Order headers | `id` PK, `user_id` FK/index, `player_id` FK/index, `side`, `quantity`, `status`, `idempotency_key` unique, `failure_reason`, `created_at` | Orders list, trading service | Trading service |
| `order_matches` | Executed fills | `id` PK, `order_id` FK/index, `quantity`, `price`, `created_at` | Trading, audit | Trading service |
| `holdings` | User positions | `id` PK, `user_id` FK/index, `player_id` FK/index, `quantity`, `average_cost`, `realized_pnl`, unique `(user_id, player_id)` | Portfolio, trading, squad | Trading service |
| `active_squad` | User active squad selections | `id` PK, `user_id` FK/index, `player_id` FK, `position`, unique `(user_id, player_id)`, unique `(user_id, position)` | Squad endpoints | Squad promote/demote |
| `notifications` | In-app notification records | `id` PK, `user_id` FK/index, `kind`, `message`, `read`, `created_at` | Notifications routes | Wallet, trading service |
| `sports_leagues` | Bzzoiro league metadata | `provider_id` unique/indexed, `slug` unique/indexed, `name`, `country`, `current_season_id`, `active`, `synced_at` | Sports routes | Sports sync |
| `sports_teams` | Bzzoiro team metadata | `provider_id` unique/indexed, `league_id` FK/index, `name`, `short_name`, `country`, `synced_at` | Sports routes | Sports sync |
| `sports_fixtures` | Bzzoiro fixture metadata | `provider_id` unique/indexed, `league_id` FK/index, `season_id` indexed, `event_date` indexed, `status` indexed, score fields, `synced_at` | Sports routes | Sports sync / cleanup |
| `sports_players` | Bzzoiro provider player metadata | `provider_id` unique/indexed, `current_team_id` indexed, `name`, `short_name`, `position`, `nationality`, `market_value_eur`, `synced_at` | Sports routes | Sports sync / cleanup |
| `sports_sync_runs` | Audit rows for sync jobs | `id` PK, `scope` indexed, `status`, `started_at`, `finished_at`, `message` | Sync audit | Sports sync |

### Migration strategy

- `backend/alembic/versions/v1_initial_trading.py` creates the schema from SQLAlchemy metadata.
- `backend/alembic/versions/v2_bzzoiro_sports_data.py` adds the Bzzoiro sports tables when they are absent.
- `backend/app/main.py` also creates tables at startup, so migrations are best treated as explicit release management rather than the only schema creation path.

### Storage and retention

- SQLite is the default local database.
- PostgreSQL is used in the Docker/Render deployment.
- Redis is used for short-lived sports provider caching.
- `cleanup_stale_sports_data()` deletes finished fixtures older than 540 days and provider player rows older than 90 days.
- There is no automated backup job or retention policy committed in the repository.

## Core Business Logic

### Registration and login

1. The user submits email/password/date-of-birth.
2. The backend validates uniqueness, password policy, and age.
3. Passwords are hashed and a wallet row is created.
4. Login verifies the password hash and returns a JWT.
5. The frontend stores the token and calls `/api/v1/users/me`.

### Wallet credit

1. An authenticated and age-verified user submits a credit request.
2. The backend validates currency and positive amount.
3. The wallet row is locked with `SELECT ... FOR UPDATE`.
4. The balance is updated and a ledger row is inserted.
5. A notification row is created.

### Market buy / sell

1. The user submits a market order.
2. The backend accepts only active EPL players.
3. The current bid/ask and wallet/holding rows are locked.
4. Buy flow checks gold balance and squad cap.
5. Sell flow checks available holdings.
6. The order row, order match row, wallet transaction row, and notification row are written in one commit.
7. Rejections are stored on the order record with a failure reason.

### Sports sync

1. `/api/v1/sports/sync/top-leagues` creates a sync run row.
2. Bzzoiro league data is fetched with the configured API key.
3. Matching top UEFA leagues are upserted.
4. Team and fixture windows are refreshed.
5. The sync run is marked success or failed and the message is persisted.

## Frontend Architecture

- Routing is manual and state-driven in `src/app/App.tsx`; there is no React Router dependency.
- `Screen` in `src/data/fieldyield.ts` defines the main pages: dashboard, asset, portfolio, squad, markets, watchlist, settings.
- Layout is composed from a fixed header, a centered content frame, a floating desktop dock, and a fixed mobile navigation bar.
- Shared UI lives in `src/components/ui/`.
- Business-facing widgets live in `src/components/shared/field-components.tsx`.
- `src/features/` contains route-level screens and feature workflows.
- `ThemeProvider` in `src/context/ThemeContext.tsx` owns light/dark state and persists it in localStorage.
- `src/lib/api.ts` is the only browser API client and is used by auth and sports notebook code.
- Forms use native HTML inputs and local React state; there is no third-party form library.
- Loading and empty states are handled inline with local conditional rendering.
- Responsive behavior is implemented with Tailwind utilities and `src/styles.css` breakpoint rules.

### Main pages

- Dashboard: summary cards, market movers, trending assets, closure timers, watchlist preview, feed rows.
- Markets: market filter rail, search, price bands, and player table.
- Portfolio: summary metrics, holdings table, allocation charts, earnings bars.
- Squad: active and reserve squads with hold-to-reserve interactions.
- Watchlist: local watchlist rows and per-player alert inputs.
- Settings: account, subscription, notification, security, and legal sections.
- Asset: price chart, statistics, order book, dividend history, and trading review panel.

## Backend Architecture

- `backend/app/main.py` contains the FastAPI app, lifespan handler, middleware registration, and route handlers.
- `backend/app/api/deps.py` provides `current_user` and `verified_user`.
- `backend/app/services.py` contains registration, authentication, wallet credit, seed, and order execution logic.
- `backend/app/sports_data.py` contains the Bzzoiro client, sync routines, and cleanup functions.
- `backend/app/core/config.py` loads validated settings via `pydantic-settings`.
- `backend/app/core/database.py` creates the SQLAlchemy engine and session factory.
- `backend/app/core/security.py` hashes passwords and creates/decodes JWTs.
- `backend/app/core/redis.py` provides Redis access with a tolerant fallback.
- `backend/app/core/celery_app.py` defines a Celery app, but there are no tasks.
- The dependency flow is route handler -> dependency -> service helper -> ORM/Redis/provider call.

## Caching

- Cache technology: Redis.
- Location: `backend/app/sports_data.py`.
- Cache key format: `bzzoiro:{path}:{json.dumps(params, sort_keys=True)}`.
- Default TTL: `BZZOIRO_CACHE_TTL_SECONDS` (`300`).
- Lock key: `:lock` with a 30 second expiry.
- Behavior on failure: cache misses fall back to direct provider requests; if Redis is unavailable, requests still proceed without cache.
- There is no application-wide cache invalidation system beyond TTL and the explicit cleanup endpoint.

## Notifications

- Notification rows live in the `notifications` table.
- They store `kind`, `message`, `read`, and `created_at`.
- Backend notifications are created by wallet credit and order execution failure/success paths.
- `GET /api/v1/notifications` lists them and `POST /api/v1/notifications/{notification_id}/read` marks them read.
- The frontend notification drawer currently uses local demo notifications for the visible UI, not live backend data.
- There is no push delivery channel, retry queue, or notification preference system implemented.

## Real-time Functionality

There is no WebSocket, SSE, subscription, or polling-based real-time transport implemented.

The only near-real-time behavior is:

- Vite hot reload in development.
- Manual refresh actions in the sports notebook and browser reloads.
- TTL-based Redis caching for provider reads.

## External Services

| Service | Purpose | Configuration | Auth | Used by | Failure behavior |
| --- | --- | --- | --- | --- | --- |
| Bzzoiro sports API | Sports leagues, teams, fixtures, and player metadata | `BZZOIRO_BASE_URL`, `BZZOIRO_API_KEY` | Token header | `backend/app/sports_data.py` | Returns HTTP 502/503/429 mapped from provider failure |
| Redis | Sports provider cache and Celery broker/backend | `REDIS_URL` | None in local dev, service URL in deployment | `backend/app/core/redis.py`, `backend/app/sports_data.py`, `backend/app/core/celery_app.py` | Sports fetches continue without cache if Redis is down |
| PostgreSQL | Persistent backend database in deployment | `DATABASE_URL` | Connection string | SQLAlchemy, Alembic | Startup depends on a reachable database for persistent deployments |
| Vercel Speed Insights | Frontend telemetry | Included through `src/main.tsx` | Vercel runtime integration | Frontend only | Telemetry failure does not block the app |
| Render | Backend deployment platform | `render.yaml` | Blueprint configuration | Deployment only | Blueprint-driven service startup |

## Validation and Error Handling

- Frontend forms perform local validation for email format, password rules, and required fields.
- Backend uses Pydantic request models for type and shape validation.
- Backend domain checks include age verification, duplicate email rejection, active player checks, wallet balance checks, holding checks, and squad cap checks.
- Most backend errors are returned as FastAPI `HTTPException` responses with a JSON body shaped like `{"detail": "message"}`.
- `src/lib/api.ts` reads the `detail` property and surfaces it as an `Error`.
- The frontend auth page, search, dialogs, and tables handle local empty/error states with conditional rendering.

## Security

Implemented:

- Password hashing with `pbkdf2_sha256`.
- JWT bearer authentication with HS256.
- Bearer token validation on protected routes.
- Age verification gate for wallet credit and trading routes.
- CORS restricted to the configured frontend origin.
- Positive-amount validation and idempotency keys for credit/order writes.

Known gaps:

- No refresh tokens.
- No CSRF protection, because auth is bearer-token based rather than cookie-based.
- No rate limiting.
- No explicit security headers in application code.
- No secret rotation or key management layer in the repository.
- No dependency scanning or SAST workflow is committed.

## Logging and Monitoring

- Backend logging uses the default FastAPI / Uvicorn behavior.
- Alembic’s env file comments that logging is optional for the local migration setup.
- There is no structured application logger, request audit log, metrics pipeline, alerting stack, or tracing integration in the repository.
- Frontend telemetry is limited to Vercel Speed Insights.
- Health checks exist via `GET /health` and Render `healthCheckPath`.

## Scripts and Commands

| Command | Defined in | Purpose | Usage | Side effects |
| --- | --- | --- | --- | --- |
| `npm run dev` | `package.json` | Start Vite dev server | Development | Serves the frontend on the default Vite port |
| `npm run build` | `package.json` | Build the frontend bundle | Production | Writes `dist/` |
| `npm run typecheck` | `package.json` | Type-check the frontend | Development / CI | No writes |
| `npm run preview` | `package.json` | Preview the frontend build | Production smoke test | Serves `dist/` locally |
| `python -m venv .venv` | Backend setup | Create a Python virtual environment | Development | Writes `.venv/` |
| `pip install -r requirements.txt` | `backend/requirements.txt` | Install backend dependencies | Development / deployment | Writes site-packages |
| `uvicorn app.main:app --reload` | `backend/app/main.py` entry point | Run the backend locally | Development | Starts API server |
| `uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}` | `backend/Dockerfile` | Run the backend container | Production | Starts API server on container port |
| `alembic upgrade head` | `backend/alembic/` | Apply migrations | Development / deployment | Mutates the database schema |
| `alembic revision --autogenerate -m "..."` | Alembic | Create a migration | Development | Writes migration files |
| `pytest` | `backend/tests/` | Run backend tests | Development / CI | No writes beyond caches |
| `docker compose -f backend/docker-compose.yml up --build` | `backend/docker-compose.yml` | Start API, worker, Postgres, Redis | Local integration | Starts containers |

There is no `lint` script defined in `package.json`.

## CI/CD

- No `.github/workflows/` directory exists in this repository.
- `vercel.json` defines frontend build and output settings.
- `render.yaml` defines the backend blueprint, database, and Redis configuration.
- There is no committed CI pipeline for linting, tests, or deployment gates.

## Testing Status

- Backend tests are present in `backend/tests/` and cover CORS, authentication bootstrap, wallet idempotency, buy/sell flows, oversell rejection, and one seeded player stress path.
- The frontend does not currently have a test directory or test script.
- Validation commands verified in this repository:
  - `npm run typecheck`
  - `npm run build`
  - `python -m pytest backend/tests` is the relevant backend test command
- Automated tests remain in the repository; they were not removed because they are production-relevant verification.

## Known Limitations

- The frontend trading review UI does not submit orders to the backend yet.
- The frontend portfolio, squad, watchlist, and notification screens are still demo-state driven.
- The backend has no refresh token flow.
- The backend has no real-time transport.
- The worker container is configured but has no task workload.
- There is no committed CI workflow.
- There is no frontend lint script.
- The runtime schema is created at startup in addition to migration files.

## Troubleshooting

| Symptom | Likely cause | Resolution | Relevant command / file |
| --- | --- | --- | --- |
| Backend fails to start with `FRONTEND_URL` validation error | `FRONTEND_URL` is missing or not HTTPS | Set a production HTTPS origin | `backend/app/core/config.py` |
| Sports routes return 503 | `BZZOIRO_API_KEY` is missing | Provide the API token | `backend/app/sports_data.py` |
| Login works but protected routes return 401 | JWT missing, expired, or invalid | Re-login and replace the stored token | `backend/app/api/deps.py`, `src/lib/api.ts` |
| Wallet credit or trading returns 403 | User is not age verified | Call `POST /api/v1/users/verify-age` | `backend/app/api/deps.py`, `backend/app/main.py` |
| Local backend points to the wrong DB | `DATABASE_URL` not set or SQLite file reused | Delete `backend/fieldyield.db` and restart | `backend/app/core/config.py` |
| Sports notebook shows no fixtures | No cached/provider data yet | Run `POST /api/v1/sports/sync/top-leagues` | `backend/app/sports_data.py` |

## Contributing and Coding Conventions

- Frontend React code uses TypeScript and `tsx` files.
- Reusable UI lives under `src/components/ui`.
- Feature routes live under `src/features`.
- Shared data and business widgets live under `src/components/shared` and `src/data`.
- Styles are scoped with `fy-*` classes and Tailwind utilities.
- The `@/` path alias maps to `src/` in both Vite and tsconfig.
- Backend code keeps route handlers in `backend/app/main.py`, with supporting helpers in `core/`, `services.py`, and `sports_data.py`.
- No explicit commit or branch policy is encoded in the repository.

## License

No license is specified in this repository.
