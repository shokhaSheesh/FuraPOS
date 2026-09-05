# Project: [Product Name TBD] — Retail/POS Management System

## What this is

A retail/POS back-office web app (frontend build, starting fresh) for small-to-mid retail
businesses — inventory, sales, staff, finance, marketing, and analytics in one system. This is a
**new product being designed from scratch**, using a live competitor, **OX System** (`ox-sys.com`),
as the primary UX/IA reference — not to be cloned pixel-for-pixel, but to understand what a mature
product in this space needs to cover, and where it can be improved.

Read this file fully before writing any code or component. It defines the product surface area, the
information architecture, and the UX conventions to follow (or deliberately improve on). Ask before
inventing new modules that aren't listed here — the scope below is deliberately comprehensive; don't
add speculative features, but do flag gaps you notice.

## Product shape

Two very different surfaces, and this build is the first one:

1. **Back-office web app** (this project) — the admin/manager dashboard: inventory, sales history,
   staff, finance, marketing, settings. Desktop-first, dense data tables, sidebar navigation.
2. ~~POS terminal app~~ — **cut.** There is no cashier POS in this product. Sales are entered
   manually in the back office on the New sale screen. OX does ship a separate POS (a different
   domain, iframed into the back office as a floating panel) and its sidebar "Новая продажа" merely
   navigates to the Cash shifts list; we do neither.

## Information architecture

**The sidebar mirrors OX System one-for-one** — same modules, same order, same names, same badges.
[docs/OX-NAVIGATION-MAP.md](docs/OX-NAVIGATION-MAP.md) is the authority: it maps every OX label
(Russian) to ours (English) and to the reference product's own route, captured from the live tenant.
Do not rename a nav item or invent a screen without updating that map first.

1. **Dashboard** — KPI cards + charts, read-only overview, drill-down links only. Built: mirrors
   OX's widgets with three deliberate changes — one period filter drives every widget, three retail
   KPIs are added (sales, average check, gross margin), and OX's welcome banner is replaced by a
   "Needs attention" list. Widget-by-widget correspondence is in the Dashboard section of
   docs/OX-NAVIGATION-MAP.md.
2. **Sales** — all sales, open / postponed / deleted sales, and **New sale**,
   the manual sale-entry screen. "+ New sale" is the primary action on every sales list. The status
   set is OX's, verbatim: open / new / processed / delivering / delivered / completed / postponed /
   deleted — a fulfilment lifecycle, not POS leftovers. Deleted sales are excluded from All sales
   and its totals, so a cancelled sale never counts toward revenue.
   Field-by-field correspondence with OX is in docs/OX-NAVIGATION-MAP.md.
3. **Products / Services** — product list, transfers, corrections, stocktaking, goods receipt,
   repricing, print templates, and **suppliers** (which OX keeps here, not under Procurement).
4. **Procurement** `New` — product selection (AI-driven reorder), orders, selection schedule.
5. **Personnel management** — employees, seller motivation, planning, access & roles (granular
   per-module tree, supports partial/indeterminate access, not just on/off).
6. **Finance** `beta` — dashboard, transactions, contracts, invoices, budget, scenarios; then a
   **Reports** group (P&L, cashflow, receivables, payables, cash forecast, employee settlements)
   and a **Setup** group (accounts, categories, period lock, taxes). OX nests these behind a second
   in-module menu; we surface them directly in the sidebar under those two headings.
7. **Marketing** — clients (CRM, gets the wallet + AI-insights component), groups, cashback, SMS
   campaigns, digital campaigns, promotions, coupons.
8. **Analytics** — report generator, product logs, online storefront report, sales report, customer
   report, promotions report, call history.
9. **My uploads** — an async job log for bulk imports (not a file manager) — filename, user, job
   type, status.
10. **Settings** — general, brands, equipment, locations, sales, products, clients, billing,
    personal data.

OX also has Integrations, Partner program, Support, and Settings entries for Webhooks and AI / MCP.
**Those five are deliberately out of scope** — see non-goals below. The map records them so the
omission reads as a decision rather than an oversight.

Persistent top bar on every screen: sidebar collapse toggle, then — right-aligned — a wallet/credit
balance indicator, theme toggle, notifications bell (dropdown, not a page), and a user avatar menu.
It carries **account and app-level chrome only**: no create action and no search field, because both
belong to the screen (DESIGN_RULES § 3.2). OX does put a global `⌘K` search there; we deliberately
do not.

## Cross-cutting patterns to bake in from day one

These are the structural ideas worth carrying into a fresh build, not just cosmetic choices:

- **Wallet-as-a-shared-component.** Clients, Employees, and Suppliers are different entity types but
  should all get the *same* reusable "wallet" sub-view: balance, cashback, debt — plus an
  AI-insights tab. Build this once as a shared component, not three bespoke screens.
  Types live in `src/shared/types/wallet.ts`.
- **One list-page skeleton, reused everywhere.** Title → search/filter bar → one primary "+Add"
  action top-right → data table with a column-visibility control → standard pagination footer. Every
  list screen shares this shell; don't let individual pages drift.
- **Filter-gated heavy reports.** Any report expensive to compute should not auto-load on
  navigation — show an explicit "set your filters, then Apply" state with a one-line explanation,
  not a silent spinner. Use `<FilterGate>`.
- **Notification preferences are (event type) × (channel), not (page) × (channel).** Users toggle
  notifications per business event (e.g. "low stock", "new purchase order", "price change")
  independently across channels (in-app, Telegram, SMS, email), grouped and counted by module.
  Don't collapse this into a single global on/off.
- **Badges communicate lifecycle, used sparingly.** "New" for recently shipped modules, "Beta" for
  modules still stabilizing — never decorative.
- **AI/MCP connector as a first-class settings page.** A standout feature worth prioritizing: let
  the business connect Claude/ChatGPT/etc. directly and *read-only* to their own data (sales, stock,
  clients) via a copyable server URL + regenerable token, scoped to the connecting user's own
  permissions, with per-provider setup instructions. Treat it as a real feature, not an afterthought.
- **Primary action buttons are always the same shape.** Blue, top-right, "+ [Verb]" — consistent
  across all 25+ list-type screens. Consistency here matters more than any individual screen's
  cleverness.

## Explicit non-goals for this build (yet)

- No real payment processing — a sale records *how* it was paid, it does not charge anything.
- **No cashier POS, at all.** Not a separate app, not an embedded one. Sales are typed in by hand.
- **No Integrations, Partner program, Support, Webhooks or AI / MCP screens.** All five exist in
  OX and are cut from this build. The AI/MCP connector in particular is worth revisiting later —
  letting a business point Claude read-only at its own sales/stock/client data via a copyable
  server URL and a scoped token would be a genuine differentiator — but it is not in scope now.
- No live backend — build against mocked/seeded data structured to match the entities above (Sale,
  Product, Category, Location, Employee, Supplier, Client, Campaign, Report, Integration, Webhook)
  so a real API can be swapped in later without restructuring the UI.

## Working in this codebase

Stack: **React 19 + TypeScript + Vite**, React Router 7, TanStack Query 5, TanStack Table 9,
Tailwind v4, Radix primitives, react-hook-form + zod, Zustand for UI state, MSW for the fake API.

**[docs/DESIGN_RULES.md](docs/DESIGN_RULES.md) is mandatory reading before touching any screen.** It
defines the brand palette and exactly what each color means, the type scale, and the fixed anatomy of
buttons, tables, row actions, detail pages, modals, forms, badges, charts and navigation. Consistency
across 25+ screens is the point — do not solve a layout problem locally.

Conventions that are load-bearing — follow them rather than inventing per-screen alternatives:

- **Feature folders.** `src/features/<module>/{pages,components,api,model}`. A feature never imports
  from another feature's internals; anything shared moves to `src/shared`.
- **Routes come from `src/shared/config/paths.ts`.** Never hardcode a URL string.
- **The sidebar comes from `src/shared/config/navigation.ts`.** Adding a screen = one entry there +
  one route. Nav items are filtered by permission automatically.
- **Permissions come from `src/shared/config/permissions.ts`** and are checked with
  `useSession().can('module.section.action')` or `<RequirePermission>`.
- **List screens** compose `<PageHeader>` + `<ListPage>` + `<DataTable>`, with list state in the URL
  via `useListQuery()`. `src/features/catalog/pages/ProductsPage.tsx` is the reference to copy.
- **Overlays are ours.** Dropdowns, date pickers and menus all build on `shared/ui/Popover`;
  `Select`, `Calendar` (three-step days → months → years) and `DateRangePicker` are the components.
  Never a native `<select>`, never a stock library theme — see DESIGN_RULES § 11.
- **All HTTP goes through `src/shared/lib/http.ts`.** All money/date/number rendering goes through
  `src/shared/lib/format.ts`.
- **Charts do not use the brand palette.** Series colours come from the validated categorical
  palette in `src/shared/lib/chart.ts` — brand yellow fails contrast as a mark (1.48:1 on white).
  Never re-order it, and never eyeball a change: run the dataviz palette validator.
- **Colors, radii and shadows live only in `src/styles/tokens.css`.** No hex values and no raw
  Tailwind palette classes (`slate-700`) in components — use the semantic tokens (`bg-surface`,
  `text-fg-muted`, `border-border`). Brand yellow `#FFCB00` always carries near-black text, and never
  means "warning". Chrome and text are true neutrals; navy is the `info` tone only.
- **Mock handlers in `src/mocks/` are the API contract.** Changing a screen's data shape means
  updating the handler and its test — that file is what the backend team gets handed.

## Known open questions (ask the user, don't guess)

- **Body typeface**: the brand's faces (Designer, Kinetika) are Latin-only and unlicensed for web,
  so the UI is set in Inter, which carries Cyrillic. Confirm, or license a Cyrillic cut of Kinetika.
  See docs/DESIGN_RULES.md § 2.1.
- **Target vertical**: the reference tenant sells auto parts, but this product should stay generic
  across retail verticals unless told otherwise. Seed data is auto-parts flavoured — swap it when
  the vertical is confirmed.
- **Locale & currency**: `format.ts` currently assumes `ru-RU` / `UZS`. Confirm, and decide whether
  the app needs runtime i18n (nothing is wired for it yet).
- **Which module ships first (MVP scope)** — Dashboard + Sales + Products is the likely starting
  slice, but confirm before deep-building Finance/Analytics/Marketing.

## Source material

A full page-by-page UX/IA audit of the reference product (OX System) exists separately with exact
table columns, filters, modal behavior, and screenshots-in-spirit — pull from it for screen-level
detail once a module is greenlit for building, rather than re-deriving structure from scratch.
