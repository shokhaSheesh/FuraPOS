# Fura — Retail management (back office)

React 19 + TypeScript + Vite front end for the Fura retail/POS back office.
Product scope and information architecture: [CLAUDE.md](CLAUDE.md).
Visual and interaction rules: **[docs/DESIGN_RULES.md](docs/DESIGN_RULES.md)** — read before building a screen.

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
```

There is no backend yet. Every request is answered in the browser by
[MSW](https://mswjs.io) using the seeded data in `src/mocks/`. To point at a real API:

```bash
# .env
VITE_USE_MOCKS=false
VITE_API_BASE_URL=https://api.example.com
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with mocks |
| `npm run build` | Typecheck + production build |
| `npm run typecheck` | `tsc -b` only |
| `npm run lint` | oxlint |
| `npm run test` | Vitest — asserts the mock API contract |
| `npm run format` | Prettier |

## Layout

```
src/
├── app/
│   ├── providers/       Query client, theme, session — composed in AppProviders
│   └── router/          Route tree, permission guards, error boundary
├── features/            One folder per module of the IA
│   └── <module>/
│       ├── api/         TanStack Query hooks + query keys
│       ├── components/  Screen-specific components (incl. table column defs)
│       ├── model/       Types + zod schemas + derived helpers
│       └── pages/       Route components (default export, lazy-loaded)
├── shared/
│   ├── components/      DataTable, ListPage, PageHeader, FilterGate, EmptyState
│   ├── config/          paths.ts, navigation.ts, permissions.ts
│   ├── hooks/           useListQuery (URL-backed list state), useUiStore
│   ├── layouts/         AppShell, Sidebar, Topbar, AuthLayout
│   ├── lib/             http client, formatters, cn
│   ├── types/           Cross-cutting domain types (pagination, wallet)
│   └── ui/              Primitives: Button, Input, Badge, Card, Skeleton
├── mocks/               MSW handlers + seed data — the API contract
└── styles/              tokens.css (the only place colors are defined)
```

## Adding a screen

1. Add its path to `src/shared/config/paths.ts`.
2. Add its permission key to `src/shared/config/permissions.ts` (if it needs one).
3. Add a sidebar entry in `src/shared/config/navigation.ts`.
4. Add the route in `src/app/router/index.tsx`, replacing the `todo(...)` placeholder.
5. Build the page. For a list screen, copy `src/features/catalog/pages/ProductsPage.tsx`.
6. Add the endpoint to `src/mocks/handlers/` and cover it in `src/mocks/__tests__/`.
7. Run the checklist at the end of [docs/DESIGN_RULES.md](docs/DESIGN_RULES.md).

## Status

Built: app shell (sidebar, top bar, theme, permission-filtered nav), routing for the **entire**
information architecture, the shared list-page/table stack, mock API + tests, Dashboard KPIs and the
Products list as reference implementations. Every other screen is a routed placeholder.
