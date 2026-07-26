# Frontend flow

## Entry point and navigation

`src/main.tsx` mounts the React tree into `#root`, wraps it in
`ThemeProvider`, and adds Vercel Speed Insights. `src/app/App.tsx` owns the
authenticated shell, selected `Screen`, selected asset, dialogs, notification
drawer, and the desktop/mobile navigation. `src/app/navigation.tsx` is the
single navigation registry for Dashboard, Markets, Portfolio, Squad,
Watchlist, and Settings. There is no server-side route loader; page changes
are client state changes inside the SPA.

The initial browser path can be loaded directly because Vercel serves the SPA
entry document. The asset page is a selected-player view, not a separate
backend route.

## Authentication restoration

1. `App` reads the local compatibility token key
   `fieldyield.authToken` from `localStorage`.
2. When the public Supabase variables are present, `src/lib/supabase.ts`
   creates a client with persisted sessions, token refresh, URL detection, and
   the implicit OAuth flow.
3. `App` calls `supabase.auth.getSession()` and subscribes to
   `onAuthStateChange`. A Supabase access token is copied to the compatibility
   key so the existing API client can use one bearer-token path.
4. `fetchCurrentUser` calls `GET /api/v1/users/me`. A valid Supabase token must
   already be linked to `users.auth_provider_id`.
5. For a new Supabase identity, `App` calls `supabase.auth.getUser()` and the
   authenticated `POST /api/v1/auth/supabase-sync` endpoint. A missing date of
   birth is treated as profile completion rather than as a silent logout.
6. On logout, Supabase signs out when configured, the compatibility token is
   removed, local user data is cleared, and the shell returns to `AuthPage`.

Supabase persists its own session in browser storage. The FieldYield token key
is a convenience for the existing API client; it is not an authority and is
never accepted without server-side verification.

## Email/password and Google OAuth

`AuthPage` preserves both flows:

- In production (`AUTH_PROVIDER=supabase` on the API), email/password signup
  and login use `supabase.auth.signUp` and `supabase.auth.signInWithPassword`.
  A successful session is immediately checked against `/users/me` and synced
  when necessary.
- The Google button calls
  `supabase.auth.signInWithOAuth({ provider: 'google' })` with
  `openid email profile` and an environment-aware redirect from
  `getOAuthRedirectUrl()`.

The browser redirect target is `VITE_SITE_URL` without a trailing slash, or
the current browser origin when it is absent. In a production build a
configured non-HTTPS value is rejected in favor of the current HTTPS origin.
OAuth error query/hash values are displayed as safe user messages and removed
from the visible URL by `clearOAuthUrl`. The exact Supabase provider callback
is documented in [deployment operations](./deployment-and-operations.md).

New Google identities must supply date of birth and may supply a username
before synchronization. The backend refuses an email-only merge with an
existing local account; account linking must happen through Supabase's
supported identity-linking process. Provider metadata cannot create an admin
role or bypass suspension.

## API client conventions

`src/lib/api.ts` derives the origin from `VITE_API_BASE_URL` and removes a
trailing slash. `apiGet`, `apiGetWithToken`, `apiPost`, and `apiPatch` send
JSON and `Accept` headers, attach `Authorization: Bearer <token>` for private
calls, parse `{ detail }` errors, and throw a user-presentable `Error` for
non-2xx responses. There is no automatic retry or global query cache.

The current UI uses bounded requests:

- `/api/v1/market/prices` loads at most 500 active catalog rows.
- Wallet ledger, orders, notifications, and watchlists request at most 50
  rows in the default client calls.
- Holdings are bounded by the API at 500 rows.

Components show inline error or empty states. A failed secondary dashboard
request is isolated with a fallback empty list; a failed authenticated profile
request causes session recovery/sync or logout. Trading dialogs disable submit
while a request is pending and send a client-generated idempotency key. The
backend, not the browser animation or local state, decides whether a trade
succeeded.

## Data flow by feature

| UI area | Backend source | Presentation-only values |
| --- | --- | --- |
| Dashboard | `users/me/summary`, wallet, notifications, market prices, watchlist | Card grouping, labels, initials, empty-state copy, filtered views |
| Markets | `GET /api/v1/market/prices` | Search/filter/sort state and responsive card layout |
| Portfolio | `GET /api/v1/portfolio/holdings` and profile summary | Market-value formatting, holding cards, local filter state |
| Squad | `GET /api/v1/squad`, promote/demote endpoints | Active/reserve grouping and position presentation |
| Watchlist | `GET/POST/DELETE /api/v1/watchlists` | Delete confirmation and status presentation |
| Notifications | `GET /api/v1/notifications`, read endpoint | Notification icon/status mapping and unread count |
| Settings | `GET/PATCH /api/v1/users/me`, admin list/status endpoints for admins | Form state, validation copy, section tabs |
| Trading | `POST /api/v1/trading/orders/market-buy` or `market-sell` | Quantity input, confirmation dialog, decorative coin particles |
| Search | Current market catalog plus registered navigation/actions | Fuzzy matching, filter pills, keyboard active index |

The frontend does not ship production player fixtures, balances, order history,
or notification records. When the API returns no catalog or holdings, the UI
renders an empty state. It does not synthesize historical portfolio charts;
there is no historical chart API in the current backend.

## Environment variables

| Variable | Browser-visible? | Used by | Purpose |
| --- | --- | --- |
| `VITE_API_BASE_URL` | Yes | `src/lib/api.ts` | FieldYield API origin |
| `VITE_SUPABASE_URL` | Yes | `src/lib/supabase.ts` | Supabase Auth project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | `src/lib/supabase.ts` | Public Supabase anon key; scope it with Supabase policies |
| `VITE_SITE_URL` | Yes | `src/lib/supabase.ts` | OAuth redirect origin per environment |

Only public values may use the `VITE_` prefix. Supabase service-role keys,
Market Engine credentials, database URLs, and signing secrets belong only in
Render server variables.

## Failure modes and inspection points

- Login returns to the form: inspect `src/features/auth/AuthPage.tsx`,
  `src/app/App.tsx`, Supabase provider settings, and the API health payload.
- OAuth redirect is rejected: compare Google Cloud authorized origins,
  Supabase Site/redirect URLs, and `VITE_SITE_URL` exactly.
- Profile sync says date of birth is required: complete the profile form; do
  not bypass the backend validation.
- API shows `401`: inspect the Supabase session, token expiry, and
  `backend/app/api/deps.py`; a token is not accepted by email alone.
- API shows `403`: the local account is suspended or the request requires age
  verification/admin authorization.
- Markets are empty: inspect `/api/v1/market/prices` and the admin catalog
  import path; startup does not seed data.
- Trading fails: inspect the order response and backend logs. The external
  Market Engine is not a success fallback and must not be simulated in the UI.
