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
2. **The till** («Касса», `/pos`) — **back in scope at the client's request** (it had been cut).
   A full-screen cash desk opened from the sidebar and from every "New sale" button (same tab —
   the demo data lives in one tab's memory, so a sale rung up elsewhere would never reach the ledger); it **replaces the New sale form**. Same catalogue as every document (categories, make →
   model, cards; a single-variation product goes straight into the cart on a tap), a cart with the
   customer, the promotion that applies, payment method and change, and Pay or Park. It writes
   exactly the sale the form did — see `src/features/pos/`. Still part of this web app, not a
   separate domain or an iframed panel as OX does it; no hardware (printer, drawer, scanner) yet.
   **The till has its own sign-in** (`TillLogin`, client request): a login and a password, nothing
   else — it is not the back-office session, and it is what «Касса» in the sidebar opens. The role
   must hold **`sales.till.view`**, which the Owner, **Продавец** and the new **Кассир** role have;
   anything else is turned away. Their name goes on every sale (`sellerId` on `createSale`), the
   till stands in *their* shop, the header shows them with «Выйти» and **hands the till over**
   (`TillSwitchUser`: the other staff of this shop who may sell, each asked for their own password), the sections follow their role,
   and leaving the till or «Выйти» locks it again. **«Бэк-офис» asks for the business's own code**
   (`BACK_OFFICE_PIN` in the seed, typed on an on-screen keypad — a till may have no keyboard),
   so somebody signed in to sell cannot walk into stock, costs and wages.
   **Layout** (`PosLayout`): one top bar with the till's three sections as **tabs — «Продажа»,
   «Отложки» and «Касса»** — then the cashier's shop (from their login, not a selector — client request) and whether its
   drawer is open. Tabs, not a rail, because «Продажа»'s
   left edge belongs to its **«Каталог запчастей»** sidebar: «По товарам» (categories →
   sub-categories) or «По автомобилям» (truck makes → models), with a search that narrows the tree;
   only what this shop stocks, with counts. Each way in filters by the other (client request),
   with the selects beside the view switcher (`TillFilters`, via `tools` on `<ProductCatalogue>`):
   «По товарам» has make and model, «По автомобилям» a category. **Cards** are every document's standard cards; the
   **list** is the client's **wide rows**: photo, name, Артикул, OEM, brand and make tags | in
   stock here, location, shelf cell | price in UZS with USD beneath (Settings' rate, on the cards too; written «USD», never «$») | cart button
   — `renderRow` and `browse` on `<ProductCatalogue>`. Photos swipe left and right when a product
   has several (`<PhotoStrip>`, the variation's `imageUrl` then its `gallery`), and open full
   size with the rest beside them. A card's stock box reads «Остаток». The cart panel is **two steps** (client request): **1. Продажа** — driver and truck, cart,
   promotion, totals with a **discount typed at the counter** (`DiscountControl`, % or a sum off,
   spread across the lines as one percentage), a comment (no source picker — client request), Park
   or «К оплате»; **2. Оплата** — the sale read back,
   payment method and «Получено» — grouped as it is typed («200 000»), with «Без сдачи» to fill the
   total exactly, and the remaining debt or the change said beneath it. The Pay button always shows
   what the **sale** costs, which is not what was handed over. Paying opens a dialog with **«Печать чека»**
   (80 mm receipt), **«Накладная»** (A4 waybill) — printed in place by `PrintSale` — or «Без чека».
   Two switches in Settings → General (client request) govern it: **a sale for 0 UZS** (off by
   default) and **a sale without a client** (on by default; off, the driver is required). The customer is two steps:
   **1. find the driver** — one search field over owner-drivers and autopark drivers, with an
   add-driver button beside it, which goes away once he is chosen; **2. choose the truck** — a card-styled
   select when he has several, a card when he has one. No keyboard shortcuts (client request). The truck decides whose purchase it
   is: his own truck is his own, his autopark's truck puts the sale on the autopark's account; a
   single truck is chosen for him. See `src/features/pos/model/buyer.ts`. Payment is cash,
   «Перевод» (the `card` method, renamed) or «В долг» (`credit`) — credit needs an account; no bank transfer,
   no delivery. **Several sales at once** (client request): numbered tabs above the cart, `+` opens
   another, each with its own cart, driver and payment. **«Отложки»** (`/pos/parked`, client
   request): «Отложить» saves the sale as `postponed` and frees the tab; «Продолжить» reopens it
   in a tab where it stopped, and paying finishes that same sale (`rewriteSale` keeps its id and
   number) rather than creating a second one. **«Касса»** (`/pos/cash`): cash in every shop's drawer now, and for
   this shop how it was reached — float + cash sales + paid in − taken out — with the shift opened
   or closed there. **Expenses** (client request) are recorded there as cash-outs on the open shift
   with a category (meals, transport, household…), never more than the drawer holds. The open
   sales and catalogue choice live in `tillStore`, so switching sections keeps a half-rung sale.

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
2. **Sales** — one **Sales** screen (sidebar: «Все продажи») with three tabs, each at its own
   address: **Offline sales** (the ledger; **New sale** opens the till), **Online
   sales** (the e-commerce feed, read-only) and **Partner orders** — client request; the tabs are
   `SALES_TABS` in `navigation.ts`, drawn by `<RouteTabs>`. **Cash shifts** stays its own entry.

   **Partner orders** are orders another business has placed _with us_ — the mirror of
   Procurement → Orders. They place it, we accept it and ship it in as many loads as it takes, and
   they tell us what arrived. It is a module rather than a sale status because a sale is an event
   and this has a life; see `src/features/partnerOrders/model/partnerOrder.ts`.

   The ledger: The lifecycle views are
   counted filter chips on the ledger (`/sales/orders?status=open`), not separate nav entries. The status
   set is OX's **without its two delivery states**: open / new / processed / completed / postponed /
   deleted. Delivery on offline sales (the states «Доставляется» / «Доставлено», the address, cost
   and courier, the columns and the detail tab) was **removed at the client's request** — an offline
   sale leaves with the customer. Online sales keep their own delivery. Deleted sales are excluded
   from All sales and its totals, so a cancelled sale never counts toward revenue.
   Field-by-field correspondence with OX is in docs/OX-NAVIGATION-MAP.md.

3. **Products / Services** — product list, transfers, corrections, stocktaking, goods receipt,
   repricing, print templates, and **suppliers** (which OX keeps here, not under Procurement).
   **The sellable unit is a variation, not a product.** A product says what a part is; a variation
   carries the SKU, barcode, cost, price, stock and shelf. The catalogue lists variations, with a
   by-product view that aggregates. Sale lines point at a variation. Attributes that matter
   (vehicle make, models, part side) are real, typed fields; on top of those the business can add
   **its own product columns** in Settings → Product columns (client request, like OX's
   «Настройка полей») — text, number, list or yes/no, per product or per variation. They show on
   the product list and the product form, and nowhere else.
4. **Procurement** `New` — orders. The AI-driven reorder pass lives on the order itself, as the
   Suggest button on its product step. OX's «Расписание подбора» (reorder schedules) was built and
   then **cut at the client's request** — see docs/OX-NAVIGATION-MAP.md.
5. **Users** (OX: «Управление персоналом», renamed at the client's request) — employees,
   **autoparks** and **drivers** (moved here from Marketing; OX keeps its clients there), and access &
   roles (granular per-module tree, supports partial/indeterminate access, not just on/off).
6. **Finance** `beta` — dashboard, transactions, contracts, invoices, budget, scenarios; then a
   **Reports** group (P&L, cashflow, receivables, payables, cash forecast, employee settlements)
   and a **Setup** group (accounts, categories, period lock, taxes). OX nests these behind a second
   in-module menu; we surface them directly in the sidebar under those two headings.
7. **Marketing** — promotions. Autoparks (the CRM, with the wallet + AI-insights component) and
   drivers live under Users; OX's groups, cashback, SMS and digital campaigns and coupons were cut.
8. **Analytics** — report generator and product logs. The customer report was built and then
   **cut at the client's request**.
9. **My uploads** — an async job log for bulk imports (not a file manager) — filename, user, job
   type, status.
10. **Settings** — general, brands, equipment, locations, categories, personal data. Billing and
    urgency levels were built and then **cut at the client's request**.

OX also has Integrations, Partner program, Support, and Settings entries for Webhooks and AI / MCP.
**Those five are deliberately out of scope** — see non-goals below. The map records them so the
omission reads as a decision rather than an oversight.

Persistent top bar on every screen: sidebar collapse toggle, then — right-aligned — theme toggle,
and a user avatar menu with Sign out. (The wallet/credit balance and the notifications bell OX
shows there were removed at the client's request.)
It carries **account and app-level chrome only**: no create action and no search field, because both
belong to the screen (DESIGN_RULES § 3.2). OX does put a global `⌘K` search there; we deliberately
do not.

## Cross-cutting patterns to bake in from day one

These are the structural ideas worth carrying into a fresh build, not just cosmetic choices:

- **Wallet-as-a-shared-component.** Clients, Employees, and Suppliers are different entity types but
  should all get the _same_ reusable "wallet" sub-view: balance, cashback, debt — plus an
  AI-insights tab. Build this once as a shared component, not three bespoke screens.
  Types live in `src/shared/types/wallet.ts`.
- **One list-page skeleton, reused everywhere.** Title → search/filter bar → one primary "+Add"
  action top-right → data table with a column-visibility control → standard pagination footer. Every
  list screen shares this shell; don't let individual pages drift.
- **Filter-gated heavy reports.** Any report expensive to compute should not auto-load on
  navigation — show an explicit "set your filters, then Apply" state with a one-line explanation,
  not a silent spinner. Use `<FilterGate>`.
- ~~Notification preferences~~ — built as (event × channel) under Personal data, then **cut at the
  client's request**. If they come back, keep that shape rather than a single on/off.
- **Badges communicate lifecycle, used sparingly.** "New" for recently shipped modules, "Beta" for
  modules still stabilizing — never decorative.
- **AI/MCP connector as a first-class settings page.** A standout feature worth prioritizing: let
  the business connect Claude/ChatGPT/etc. directly and _read-only_ to their own data (sales, stock,
  clients) via a copyable server URL + regenerable token, scoped to the connecting user's own
  permissions, with per-provider setup instructions. Treat it as a real feature, not an afterthought.
- **Primary action buttons are always the same shape.** Blue, top-right, "+ [Verb]" — consistent
  across all 25+ list-type screens. Consistency here matters more than any individual screen's
  cleverness.

## Explicit non-goals for this build (yet)

- No real payment processing — a sale records _how_ it was paid, it does not charge anything.
- **No till hardware.** The till is a screen; receipt printers, cash drawers and card terminals
  are not connected, and a barcode scanner works only as the keyboard it pretends to be.
- **No Integrations, Partner program, Support, Webhooks or AI / MCP screens.** All five exist in
  OX and are cut from this build. The AI/MCP connector in particular is worth revisiting later —
  letting a business point Claude read-only at its own sales/stock/client data via a copyable
  server URL and a scoped token would be a genuine differentiator — but it is not in scope now.
- **No backend, and no API layer at all.** This build is a design deliverable: the real product is
  not this codebase. All data lives in `src/data/` and is held in memory by a Zustand store, read
  synchronously. There is no HTTP client, no fetch, no service worker and no request caching.

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
- **Search is a filter by field (OX-style, client request).** Every list's search bar is
  `<ColumnFilterSearch>` (URL-backed) or `<FilterSearch>` (local state): clicking it opens a panel
  with **one field per table column**, named as the column is headed — text, pick-list, from–to,
  date range or yes/no, inferred from the data by `filterFieldsFromColumns`
  (`src/shared/lib/columnFilterFields.ts`). Applied filters live in the URL as `f`; the page's data
  hook applies them with `applyQueryFilters`. A column whose value is worked out, or whose raw value
  is a code, gets an entry in the feature's `model/*FilterFields.ts` overrides — shared by the panel
  and the hook, so both read a field from the same place. A new list page does the same; the
  product list keeps its hand-written `productFilterFields`.
- **Wherever products are put on a document — transfers, purchase orders, goods receipt — the table
  shows the same fields as the product list.** Client rule. Use
  `buildProductFieldColumns` (`src/features/products/components/productFieldColumns.tsx`), never a
  hand-picked subset: somebody receiving parts off a lorry reads the same catalogue as somebody
  managing it, and having half the fields in one screen and half in the other is how the wrong
  variation gets received. The document's own editable columns (counted quantity, line price) go
  straight after the identity block, not appended at the end. A test compares the two column sets,
  so a field added to the catalogue cannot quietly go missing from the documents.
- **Products are picked from cards (client mockup).** A document's product step — transfers,
  purchase orders, goods receipts — is `<ProductCatalogue>` (`src/shared/components/catalogue/`):
  category tiles with sub-categories beneath, make → model filters, cards or a list with Fields /
  Columns beside the switcher, and a `+` that opens `<VariationsDialog>` to set quantities (and, on
  purchases, prices) per variation. Orders and receipts use `<PurchaseCatalogue>` over
  `buildPurchaseRows`. Unfinished documents have a Save button and say so when you leave, and step
  through with **Назад / Далее** as well as by the step circles (client request). Creating a product
  from a document comes back to it (`state.from` on the product form, client request), and on a
  supplier document a card the supplier has listed in the last 45 days is marked **«Новинка»** on
  its photo (`newFromSupplier` on the purchase row, `renderPhotoBadge` on `<ProductCatalogue>`).
- **The interface is Russian; English is the source.** Every user-facing string goes through
  `t()` from `@/shared/i18n`, keyed by the English text itself — `t('Add products')` — so an
  untranslated string renders as readable English rather than `orders.list.empty.title`, and
  nothing has to be invented to add one. Placeholders are named: `t('Only {count} here', { count })`.
  A noun that agrees with a number takes `tn(n, 'product', 'products')`, which the Russian
  dictionary answers with all three forms. `t()` is a plain function, not a hook, so column
  builders and model helpers translate the same way a component does; changing language rebuilds
  the app (`AppProviders`) so every one of them is re-read. **Never call `t()` at module scope** —
  a status table or a column list is read once at import and would freeze the language it was
  imported in; leave those tables English and translate where they are rendered (`DataTable`
  translates a heading written as plain text, `Steps` a step, `StatusChips` a chip). Russian lives
  in `src/shared/i18n/ru.ts`; adding Uzbek is one more dictionary. The language switch is in the
  top bar, and numbers and dates follow it while the currency stays UZS. Tests run in English.
- **Overlays are ours.** Dropdowns, date pickers and menus all build on `shared/ui/Popover`;
  `Select`, `Calendar` (three-step days → months → years) and `DateRangePicker` are the components.
  Never a native `<select>`, never a stock library theme — see DESIGN_RULES § 11.
- **Data comes from `src/data/`.** `store.ts` holds it and owns every write; `query.ts` has the
  list helpers. Feature `api/` folders are thin synchronous hooks over that store — they keep the
  `{ data, isLoading }` and `{ mutate, isPending }` shapes so screens read the same either way.
  All money/date/number rendering goes through `src/shared/lib/format.ts`.
- **Charts do not use the brand palette.** Series colours come from the validated categorical
  palette in `src/shared/lib/chart.ts` — the UI blue is for actions, not data series.
  Never re-order it, and never eyeball a change: run the dataviz palette validator.
- **Colors, radii and shadows live only in `src/styles/tokens.css`.** No hex values and no raw
  Tailwind palette classes (`slate-700`) in components — use the semantic tokens (`bg-surface`,
  `text-fg-muted`, `border-border`). The palette is light blue and white (client request): sky blue `#0A7BC4` with white
  text for primary actions, light blue `#E6F3FC` for soft fills, a white sidebar. Nothing blue means
  "warning" — warning is orange.
- **A number field carries no spinners, and a scrolling table no scrollbar** (client request):
  `input[type=number]` is `appearance: textfield` in `global.css`, and anything scrolling sideways
  takes `.scroll-x-quiet`. Where stepping is the job — a cart line, an opening stock count, a
  document's quantities — the screen draws `<QuantityStepper>` instead.
- **A product's SKU and barcode are generated when left empty** (client request) —
  `features/products/model/codes.ts`: `SKU-00042` carrying on from the catalogue, and a valid
  EAN-13 in the 200–299 range shops are given for their own use. Both fields are marked required
  and say they will be filled in.
- **`src/data/seed.ts` is the dataset.** Changing a screen's data shape means changing the seed and
  its test.

## Known open questions (ask the user, don't guess)

- **Body typeface**: the brand's faces (Designer, Kinetika) are Latin-only and unlicensed for web,
  so the UI is set in Inter, which carries Cyrillic. Confirm, or license a Cyrillic cut of Kinetika.
  See docs/DESIGN_RULES.md § 2.1.
- **Target vertical**: the reference tenant sells auto parts, but this product should stay generic
  across retail verticals unless told otherwise. Seed data is auto-parts flavoured — swap it when
  the vertical is confirmed.
- **Which module ships first (MVP scope)** — Dashboard + Sales + Products is the likely starting
  slice, but confirm before deep-building Finance/Analytics/Marketing.

## Source material

A full page-by-page UX/IA audit of the reference product (OX System) exists separately with exact
table columns, filters, modal behavior, and screenshots-in-spirit — pull from it for screen-level
detail once a module is greenlit for building, rather than re-deriving structure from scratch.
