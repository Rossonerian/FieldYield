# FieldYield

FieldYield is a React and FastAPI football-fintech prototype for football asset trading. It presents dashboards, markets, portfolios, squads, watchlists, trading panels, notifications, and responsive navigation, with Bzzoiro sports data flowing through a backend service layer.

## Current Status

The frontend remains prototype-led for trading UX, while the backend now supports authentication, wallets, trading seed data, normalized sports data, Redis caching, and Render deployment. Production rollout still needs paid infrastructure, monitoring, backups, and scheduled jobs before real users.

## Features

- Dashboard summaries and three independent Portfolio, Market, and Activity carousels
- Bzzoiro-powered top-seven UEFA league notebook in Markets
- Market filters, sorting, price ranges, and local asset search
- Portfolio holdings, allocation views, earnings filters, squad management, and watchlist removal
- Frontend trading panels with click-only Buy/Sell token effects and local review states
- Hold-to-Reserve interaction with pointer, touch, keyboard, cancellation, and reduced-motion support
- Action Search with fuzzy matching, category filters, recent results, Ctrl/Cmd+K, Escape, arrows, and Enter actions
- Notification drawer with unread counts, alert states, keyboard focus, and real asset actions
- Profile avatar fallback with accessible online status
- Floating desktop dock with pointer-distance magnification and preserved mobile navigation
- Native light/dark themes with system preference detection, persistence, and an animated theme switch
- Shared `BlurFade`, `BadgeDelta`, premium Button variants, Dialog, Tooltip, Avatar, AlertBadge, and CardCarousel primitives
- Selective animated Lucide-compatible icons sourced from the pqoqubbw/icons registry

Frontend-only trading reviews deliberately do not change balances or holdings.

## Tech Stack

- React 19 and React DOM
- Vercel Speed Insights
- Vite 7 with the React plugin
- TypeScript
- Tailwind CSS 4 with the Vite plugin
- Motion 12 (`motion/react`)
- `lucide-react` and locally installed animated Lucide-compatible registry components
- FastAPI, SQLAlchemy, Alembic, PostgreSQL, Redis, and Bzzoiro Sports Data
- `class-variance-authority`, `clsx`, and `tailwind-merge`
- Radix UI Slot for `Button` composition

## Project Structure

```text
src/
  app/                 application state and navigation
  components/
    layout/            header, dock, mobile navigation
    shared/            FieldYield business-facing widgets
    ui/                reusable UI, dialogs, icons, and primitives
  context/             theme provider
  data/                frontend-only data
  features/            asset, dashboard, market, search, trading, and page features
  lib/                 shared utilities
  main.tsx             Vite entry point
  styles.css           Retro-Glass tokens and scoped styles
```

## Getting Started

Vite 7 requires Node.js `20.19+` or `22.12+`. The project does not pin an `engines` field.

```bash
npm install
npm run dev
```

## Available Scripts

- `npm run dev` starts the Vite development server.
- `npm run build` creates the production bundle in `dist/`.
- `npm run preview` serves the production bundle locally.
- `npm run typecheck` runs strict TypeScript validation.

There are currently no lint or test scripts configured in this frontend repository.

## UI Architecture

Reusable primitives live under `src/components/ui`. Feature-specific composition lives under `src/features`, while `src/components/shared` contains data-aware widgets reused across screens. `ThemeProvider` owns native light/dark state, and `src/lib/utils.ts` provides the shared `cn` helper.

The styling system uses Tailwind utilities alongside scoped `fy-*` CSS classes and semantic theme variables. Motion is used for BlurFade, carousel settling, dock magnification, button feedback, trade particles, and animated icon behavior. Animated icon sources are installed individually from the [pqoqubbw/icons shadcn registry](https://pqoqubbw-icons.mintlify.app/installation) so the complete icon catalog is not bundled.

## Design System

FieldYield uses a restrained Retro-Glass visual language: translucent teal surfaces, soft borders, subtle highlights, tactile controls, pink active accents, and intentional light/dark tokens. The desktop dock floats above the page while mobile retains bottom navigation. Interactive controls expose focus states and pressed/checked semantics. Decorative animation is selective and respects `prefers-reduced-motion`.

## Data Layer

The current trading demo player, dividend, and activity data still lives in `src/data/fieldyield.ts`. Bzzoiro sports data is loaded through the FastAPI backend, not directly from the browser. PostgreSQL stores only normalized essentials for leagues, teams, fixtures, limited match summaries, and on-demand player profiles. Redis is used for short TTL API response caching and request deduplication protection, not permanent storage.

## Backend Notes

- Supported Bzzoiro coverage is scoped to Premier League, La Liga, Serie A, Bundesliga, Ligue 1, Eredivisie, and Primeira Liga.
- Fetches are paginated and scoped by league, season, team, and date window where possible.
- Run `POST /api/v1/sports/sync/top-leagues` for a minimal fixture/team sync.
- Run `POST /api/v1/sports/cleanup` to prune old finished fixtures and stale player profile rows.

## Deployment

- `render.yaml` defines the backend web service, PostgreSQL database, and Redis-compatible Key Value instance for Render.
- `vercel.json` pins the frontend build settings for Vercel.
- Set the backend `FRONTEND_URL` to the Vercel domain so CORS allows browser API calls.
- Set the backend `BZZOIRO_API_KEY` to your Bzzoiro Sports Data token.
- Set the frontend `VITE_API_BASE_URL` to the Render API URL once you connect the two.
- Vercel Speed Insights is installed in the frontend entry point and will report on Vercel deployments.
- For a demo-only setup, Render's free tiers are fine. For real usage, move the backend resources to paid plans.

## Development Guidelines

- Reuse the shared UI primitives before creating new components.
- Keep icons Lucide-compatible and animate them only when feedback is useful.
- Preserve keyboard, touch, focus, and reduced-motion behavior.
- Use scoped `fy-*` styles or component utilities; do not add generic global selectors.
- Keep frontend-only behavior explicit and do not fabricate backend responses.
- Preserve the existing Retro-Glass tokens and avoid duplicating widgets, handlers, or animations.

## Browser Support

The project follows Vite 7's modern browser target and uses standard React, CSS, Pointer Events, ResizeObserver, and `prefers-reduced-motion` APIs. Older browsers outside that target are not specifically supported.

## Contributing

Keep changes focused, run `npm run typecheck` and `npm run build`, and update this document when the real frontend scope changes. Backend work should be introduced separately from this frontend-only baseline.

No license has been specified for this repository.
