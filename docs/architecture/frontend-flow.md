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

## Authentication state machine

`App` now treats authentication as explicit states:
`unauthenticated`, `authenticating`, `authenticated_syncing`,
`profile_incomplete`, `ready`, `suspended`, and `sync_error`.
Protected dashboard content and private data loaders run only in `ready`.
`profile_incomplete`, `suspended`, and `sync_error` are visible user states,
not implicit returns to the login form.

## Authentication restoration

1. Only when Supabase is not configured, `App` reads the explicit local-mode
   token key `fieldyield.localAuthToken` from `localStorage`.
2. When the public Supabase variables are present, `src/lib/supabase.ts`
   creates a client with persisted sessions, token refresh, URL detection, and
   the implicit OAuth flow.
3. `App` calls `supabase.auth.getSession()` and subscribes to
   `onAuthStateChange`. Supabase owns persistence; FieldYield keeps the access
   token only in React state and never duplicates it into its local token key.
4. `fetchCurrentUser` calls `GET /api/v1/users/me`. A valid Supabase token must
   already be linked to `users.auth_provider_id`.
5. For a new Supabase identity, `App` calls `supabase.auth.getUser()` and the
   authenticated `POST /api/v1/auth/supabase-sync` endpoint. A missing date of
   birth is treated as profile completion rather than as a silent logout.
   Duplicate session events are guarded by a single-flight sync keyed to the
   active token; stale sync results are ignored after logout or token changes.
6. On logout, Supabase signs out when configured, local-only state is removed,
   account resources are cleared, and the shell returns to `AuthPage`.

Supabase persists its own session. Pending date-of-birth/username data is kept
in `sessionStorage` for at most 30 minutes and removed on completion, expiry,
or logout. It is not copied into durable `localStorage`.

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
trailing slash. The centralized typed request function sends
JSON and `Accept` headers, attach `Authorization: Bearer <token>` for private
calls, parse `{ detail, request_id }` errors, and throw `ApiError` with the
HTTP status for non-2xx responses. 401 signs out safely; 403 shows suspended,
age-verification, or authorization state; profile-sync failures are retryable
without destroying a valid Supabase session. Abort signals and a 10-second
timeout prevent stale requests from updating state.

The current UI uses bounded requests:

- `/api/v1/market/prices` loads at most 500 active catalog rows.
- Wallet ledger, orders, notifications, and watchlists request at most 50
  rows in the default client calls.
- Holdings are bounded by the API at 500 rows.

`useAccountData` refreshes wallet, summary, holdings, orders, squad, watchlist,
and notifications with `Promise.allSettled`. Successful resources are retained
when another fails, and failed resources expose retryable errors instead of
becoming fake zero/empty values. Mutations invalidate only the relevant set.
Trading dialogs disable double submission and create one UUID per intent; it
survives transport retries, changes with player/side/quantity, and clears on
authoritative success or cancellation. The backend decides success and returns
the execution price/total shown by the dialog.

## Data flow by feature

| UI area | Backend source | Presentation-only values |
| --- | --- | --- |
| Dashboard | `users/me/summary`, wallet, notifications, market prices, watchlist | Card grouping, labels, initials, empty-state copy, filtered views |
| Markets | `GET /api/v1/market/prices` | Search/filter/sort state and responsive card layout |
| Portfolio | `GET /api/v1/portfolio/holdings` and profile summary | Market-value formatting, holding cards, local filter state |
| Squad | `GET /api/v1/squad/state`, promote/demote endpoints | Active/reserve grouping and position presentation |
| Watchlist | `GET/POST/DELETE /api/v1/watchlists` | Delete confirmation and status presentation |
| Notifications | `GET /api/v1/notifications`, read endpoint | Notification icon/status mapping and unread count |
| Settings | `GET/PATCH /api/v1/users/me`, admin list/status endpoints for admins | Form state, validation copy, section tabs |
| Trading | `POST /api/v1/trading/orders/market-buy` or `market-sell` | Quantity input, confirmation dialog, decorative coin particles |
| Search | Current market catalog plus registered navigation/actions | Fuzzy matching, filter pills, keyboard active index |

The frontend does not ship production player fixtures, balances, order history,
or notification records. When the API returns no catalog or holdings, the UI
renders an empty state. It does not synthesize historical portfolio charts;
there is no historical chart API in the current backend.

Screen-level views and nonessential dialogs are lazy-loaded behind the existing
empty-state loading treatment. `ErrorBoundary` provides a safe reload path for
render failures. Dialogs trap focus, inert the application root, close on Escape
or backdrop, and restore their trigger. The notification drawer remains a
non-modal complementary region. Reduced-motion preferences continue to disable
nonessential transitions.

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
