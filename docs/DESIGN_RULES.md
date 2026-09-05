# Fura Sentr — Design Rules

The single source of truth for how every screen in this product looks and behaves.
Derived from `docs/Fura-Sentr-Brand-Guidelines.pdf` and applied to a dense back-office UI.

**These are rules, not suggestions.** Consistency across 25+ list screens is worth more than any
individual screen's cleverness. If a screen needs something not described here, add it here first,
then build it — do not solve it locally.

Implementation lives in `src/styles/tokens.css` (colors) and `src/shared/ui` + `src/shared/components`
(the components that encode these rules). Never re-implement a pattern that already has a component.

---

## 1. Color

### 1.1 Brand palette (from the brand book, p.8)

| Color | Hex | Brand meaning | Where it is used in the app |
| --- | --- | --- | --- |
| Yellow | `#FFCB00` | energy & attention | Primary buttons, active nav, focus in dark mode, key highlights |
| Navy | `#0F0F35` | stability & trust | All primary text, the sidebar, dark-mode surfaces |
| Black | `#000000` | strength & precision | **Logo only.** Never a UI background or text color |
| Grey | `#D8D9D9` | metal & technology | Borders, dividers, table rules |

### 1.2 Two hard constraints

1. **Yellow always carries navy text — never white.**
   `#FFCB00` + white is 1.7:1 contrast (fails WCAG badly). `#FFCB00` + `#0F0F35` is ~11:1.
   This is why `--color-primary-fg` is navy. Do not override it.

2. **Yellow can never mean "warning".**
   Yellow is the brand, so it is reserved for *primary action and active state*. A status chip,
   an alert, or a low-stock badge must never be yellow or the user cannot tell the brand from a
   problem. Warning is **orange** `#C2410C`. Nothing yellow in this UI is a status.

### 1.3 Semantic tokens — use these names, never hex

Components use Tailwind classes generated from the tokens: `bg-surface`, `text-fg-muted`,
`border-border`, `bg-primary text-primary-fg`. **A hex value or a stock Tailwind palette class
(`bg-slate-700`, `text-gray-500`) in a component is a bug.**

| Token | Light | Purpose |
| --- | --- | --- |
| `canvas` | `#F2F3F5` | Page background *behind* cards |
| `surface` | `#FFFFFF` | Cards, tables, modals, popovers |
| `surface-muted` | `#F4F5F7` | Table headers, row hover, inactive tabs |
| `surface-inset` | `#EBECEF` | Inputs, wells, avatar placeholders |
| `border` | `#D8D9D9` | Every 1px divider |
| `border-strong` | `#B9BAC0` | Input borders on hover, checkbox outlines |
| `fg` | `#0F0F35` | Primary text |
| `fg-muted` | `#5A5B72` | Labels, secondary text, table headers |
| `fg-subtle` | `#8A8B9C` | Placeholders, disabled text, icon-only affordances |
| `primary` / `primary-fg` | `#FFCB00` / `#0F0F35` | Primary action |
| `primary-soft` | `#FFF3CC` | Selected nav item background, soft brand badge |
| `chrome` | `#0F0F35` | The sidebar, in **both** themes |
| `success` | `#0F7F52` | Paid, active, in stock, completed |
| `warning` | `#C2410C` | Low stock, pending, expiring, needs attention |
| `danger` | `#C0242C` | Destructive actions, errors, overdue, out of stock |
| `info` | `#2C4FC9` | Neutral informational notices, "new" system messages |

### 1.4 Dark mode

Dark mode is not an inverted greyscale — it is the **navy** theme. `--color-surface` becomes
`#0F0F35` (the brand navy itself) on a darker `#08081C` canvas. Yellow stays `#FFCB00` in both
themes because it is the brand.

Every color must be defined in **both** blocks in `tokens.css`. A color defined only in `:root` is
a bug that will surface as an invisible element in dark mode.

### 1.5 Color proportion

The brand book states the color ratio is mandatory. In UI terms:

- **Navy and neutrals carry ~90% of the screen.** Text, chrome, borders, surfaces.
- **Yellow is ≤5% of any screen.** Typically: one primary button + one active nav item.
- If a screen has two yellow buttons, one of them is wrong — see §4.1.

---

## 2. Typography

### 2.1 The font problem, and the rule that resolves it

The brand fonts are **Designer** (display) and **Kinetika Light** (secondary). Both are
**Latin-only** in the brand book specimen, and this product's UI must render Cyrillic
(Russian/Uzbek). Neither is a licensed web font today.

**Rule:**

- **UI type is `Inter`** — full Cyrillic, excellent at small sizes, real tabular numerals.
  It is a close geometric-grotesque match to Kinetika's character.
- **`Designer` is reserved for the logo lockup and short Latin display text only.** Never body
  copy, never a table, never a label. It is loaded as `--font-display`.
- Revisit only if someone licenses a Cyrillic web cut of Kinetika. *(Open question — confirm.)*

### 2.2 Type scale

Dense back-office. Base is **15px**, not 16px.

| Role | Class | Size / weight | Used for |
| --- | --- | --- | --- |
| Page title | `text-lg font-semibold tracking-tight` | 18px / 600 | The one `<h1>` per screen, in `PageHeader` |
| Section title | `text-sm font-semibold` | 14px / 600 | `CardTitle`, modal titles, form group headings |
| Body | `text-sm` | 14px / 400 | Table cells, form values, descriptions |
| Label | `text-sm text-fg-muted` | 14px / 400 | Field labels, secondary lines |
| Table header | `text-2xs font-semibold uppercase tracking-wide text-fg-muted` | 11px / 600 | Column headers only |
| Metric | `text-xl font-semibold tabular-nums` | 20px / 600 | KPI card values |
| Micro | `text-2xs` | 11px | Badges, SKU, timestamps, helper text |

Never introduce a size outside this scale. Never use `font-bold` (700) in the UI — 600 is the
heaviest weight; 700 belongs to the logo.

### 2.3 Numbers

All numeric columns and all money use `tabular-nums` (applied globally to `td`/`th`) and are
**right-aligned**. Text columns are left-aligned. Nothing is centered except a single icon or badge
in a fixed-width column.

Money, dates and counts render **only** through `src/shared/lib/format.ts`. A raw `toLocaleString()`
or a hand-built date string in a component is a bug.

---

## 3. Layout & spacing

### 3.1 Spacing scale

Multiples of 4px, via Tailwind's default scale. The only values used are
**1, 1.5, 2, 3, 4, 6, 8** (4px → 32px). Nothing else.

| Context | Value |
| --- | --- |
| Icon ↔ its label | `gap-2` (8px) |
| Between form fields | `gap-4` (16px) |
| Table cell padding | `px-3 py-2.5` |
| Card padding | `p-4` |
| Page padding | `p-4` mobile, `lg:p-6` desktop |
| Between page sections | `space-y-4` |

### 3.2 App frame

Fixed and identical on every screen — `AppShell`:

- **Sidebar**, left, navy (`bg-chrome`) in both themes. 240px expanded / 56px collapsed.
  Collapse state persists per user.
- **Top bar**, 56px, `bg-surface`, bottom border. Contents left→right:
  collapse toggle → quick-create `+` → global search → *(spacer)* → wallet balance → theme toggle →
  notifications bell → avatar menu. This order never changes.
- **Content**, scrolls independently, `max-w-[1600px]`, centered.

### 3.3 Radii and elevation

| Element | Radius | Shadow |
| --- | --- | --- |
| Cards, tables, modals | `rounded-card` (10px) | `shadow-card` |
| Buttons, inputs, badges-on-controls | `rounded-control` (6px) | none |
| Popovers, dropdowns | `rounded-control` | `shadow-popover` |
| Modals | `rounded-card` | `shadow-modal` |
| Avatars, status dots, pills | `rounded-full` | none |

Three shadow levels exist. Do not invent a fourth, and never put a shadow on a button.

---

## 4. Buttons

### 4.1 The one-primary rule

**Exactly one yellow button per screen**, and it lives **top-right in `PageHeader`**. Everything
else is `secondary`, `ghost`, or `danger`. Two yellow buttons on a screen means the second one is
mislabelled as primary.

Inside a modal the primary is bottom-right; inside a form card it is bottom-right of the card.
There is still only one.

### 4.2 Variants

| Variant | Look | Use for |
| --- | --- | --- |
| `primary` | Yellow bg, navy text | The single main action: `+ Add product`, `Save`, `Confirm` |
| `secondary` | Surface bg, grey border, navy text | Cancel, Export, Filter, secondary actions in a row |
| `ghost` | Transparent, muted text, hover fill | Icon buttons, toolbar controls, table row actions |
| `danger` | Danger bg, white text | Confirmed destructive action **inside a modal only** |
| `link` | Yellow-free, primary-colored text, underline on hover | Inline navigation inside prose or a card header |

A destructive action is **never** a red button on a list page. It is a ghost icon in the row, which
opens a confirmation modal whose primary action is the red one.

### 4.3 Sizes and anatomy

`sm` = 32px, `md` = 36px (default), `lg` = 40px, `icon` = 36×36. Icons are always **16px**
(`size-4`), always on the **left** of the label, `gap-2`.

Labels are `+ Verb Noun` for creation (`+ Add product`, `+ New purchase order`) and a bare verb
otherwise (`Save`, `Cancel`, `Export`). Sentence case. Never ALL CAPS, never a trailing ellipsis.

### 4.4 States

Every button must handle: default, hover, `:focus-visible` (2px ring, 2px offset), disabled
(`opacity-50`, no pointer events), and loading (spinner replaces the leading icon, label stays,
button disabled). Loading state is mandatory on anything that writes.

---

## 5. List pages

Every list screen in the app is the same three components stacked. Copy
`src/features/catalog/pages/ProductsPage.tsx`; do not build a bespoke one.

```
<PageHeader>   title + description + ONE primary action (top-right)
<ListPage>     search box (left) then filters, in one row
  <DataTable>  column-visibility control → table → pagination footer
```

### 5.1 Table anatomy

- Header row: `bg-surface-muted`, 11px uppercase muted labels, sortable columns show a chevron.
- Rows: 1px `border-border` top border, `hover:bg-surface-muted` **only if the row is clickable**.
- Row click opens the detail page. It never opens a modal and never toggles selection.
- First column is the identifier (SKU / number / name). It and the name column cannot be hidden.
- Last column is the actions column — right-aligned, ghost icon buttons, no header label.
- Empty cells render `—` (em dash, `text-fg-subtle`). Never blank, never "N/A", never `null`.

### 5.2 Column order — same everywhere

`identifier → name (+ secondary line) → categorisation → quantities → money → status → actions`

Money right-aligned, quantities right-aligned, everything else left.

### 5.3 Row actions

Ghost icon buttons, 16px icons, in this order, always: **view/edit → duplicate → …overflow →
delete**. Delete is always last and always `text-danger` on hover. More than three actions collapse
into a `⋯` overflow menu, with delete separated at the bottom of that menu.

### 5.4 States

| State | What renders |
| --- | --- |
| Loading | 8 skeleton rows inside the table chrome — **never** a spinner that replaces the table |
| Empty (no data at all) | `EmptyState` with icon, one line of explanation, and the primary action repeated |
| Empty (filters excluded everything) | `EmptyState` with "clear filters" wording, **not** the add action |
| Error | `EmptyState` with the error and a Retry button |
| Heavy report, not yet run | `FilterGate` — "choose your filters, then Apply". Never auto-run |

### 5.5 List state lives in the URL

Page, page size, search, sort and every filter are query params, via `useListQuery()`. A filtered
table must be shareable and survive a refresh. Any filter change resets to page 1.

---

## 6. Detail pages

One layout for every entity (product, sale, client, employee, supplier, purchase order):

1. **Back link** to the list, top-left, `← {List name}`.
2. **`PageHeader`** — entity name as the title, key identifier + status badge as the description,
   primary action top-right (`Edit`, or the entity's main verb).
3. **Summary strip** — a row of `StatCard`s for the 3–5 numbers that matter for that entity.
4. **Tabs** for sections. Tab one is always **Overview**. The tab set for entities that have a
   wallet is: `Overview · Wallet · History · [entity-specific] · Activity`.
5. **Two-column body** on `lg+`: main content 2/3 left, metadata card 1/3 right. Single column below.
6. **Activity/audit is always the last tab**, never a separate page.

Entities with money attached (Client, Employee, Supplier) share the *same* wallet tab component —
balance, cashback, debt, transactions, AI insights. Build it once. See `src/shared/types/wallet.ts`.

---

## 7. Forms & modals

### 7.1 Modal vs. page

- **Modal** — a single-purpose action with ≤6 fields: create a category, adjust stock, confirm a
  delete, add a payment.
- **Full page** — anything with tabs, a line-item table, or >6 fields: product, purchase order,
  campaign, report builder.
- **Never a modal inside a modal.** If a flow needs a second step, it is a page.

### 7.2 Modal anatomy — identical every time

```
┌──────────────────────────────────────────┐
│ Title                                  ✕ │  header: p-4, border-b
├──────────────────────────────────────────┤
│ body: p-4, scrolls if tall               │
├──────────────────────────────────────────┤
│                    [Cancel]  [Primary]   │  footer: p-4, border-t
└──────────────────────────────────────────┘
```

- Widths: `sm` 400px (confirm), `md` 560px (default form), `lg` 760px (form with a table).
- Actions bottom-**right**, secondary first, primary last. Never centered, never full-width.
- Closes on `Esc` and on backdrop click — **except** when the form is dirty, which prompts first.
- Destructive confirmations name the thing being deleted in the body text and use a `danger` primary.

### 7.3 Field anatomy

Label above the input, always. Never a placeholder acting as the label.

```
Label *                          ← 14px, text-fg-muted; * only when required
[ input                       ]  ← 36px tall, rounded-control, border-border
Helper text or error             ← 11px; text-fg-subtle, or text-danger when invalid
```

- Required fields are marked; optional fields are not labelled "(optional)".
- Validation runs on **blur**, then on every change once a field has errored. Never on every
  keystroke of an untouched field.
- On submit failure, focus the first invalid field and scroll it into view.
- Errors are specific: "SKU already exists", not "Invalid input".
- Schemas are `zod`, colocated in the feature's `model/` folder, shared between form and API type.

### 7.4 Save behaviour

Primary button shows a spinner and disables while in flight. On success: close the modal (or stay on
the page), show a toast, and invalidate the affected query keys. On failure: keep the form open with
its values intact and surface the server message near the failing field, or at the top of the form.

---

## 8. Status, badges & feedback

### 8.1 Badges

Rounded-full, 11px, medium weight, soft background + solid text of the same hue. **Text only — no
dot, no icon inside a badge.** Sentence case.

| Meaning | Tone | Examples |
| --- | --- | --- |
| Positive / settled | `success` | Active, Paid, Completed, In stock |
| Needs attention | `warning` | Low stock, Pending, Expiring |
| Failed / negative | `danger` | Overdue, Out of stock, Cancelled, Failed |
| Informational | `info` | Scheduled, Draft sent |
| Inert | `neutral` | Archived, Draft, Closed |
| Product lifecycle | `primary` | `New`, `Beta` — **only** these two, only on nav items |

Lifecycle badges (`New`, `Beta`) are the *only* yellow badges, they only appear in the sidebar, and
they are removed once a module is mature. Badges are never decorative.

### 8.2 Toasts

Bottom-right, auto-dismiss after 4s, one line, with an Undo action where the operation is reversible.
Success toasts confirm writes. Errors that block the user belong **in the form**, not in a toast.

### 8.3 Loading

- Page/section load → **skeletons** shaped like the content that is coming.
- In-place action → spinner **inside the button** that started it.
- Background refetch → nothing. Never flash a skeleton over data the user is already reading.

---

## 9. Charts

Charts follow the same colour discipline as the rest of the UI: the brand carries the *main* series,
everything else is a supporting neutral or a distinct hue.

### 9.1 Series colours, in this order

| # | Hex | Use |
| --- | --- | --- |
| 1 | `#FFCB00` | The primary measure — revenue, the thing the chart is about |
| 2 | `#0F0F35` | Its comparison — cost, previous period, target (light mode) |
| 3 | `#2C4FC9` | Third series |
| 4 | `#0F7F52` | Fourth series |
| 5 | `#C2410C` | Fifth series |
| 6 | `#7A3FBF` | Sixth series |

Never more than six categorical series in one chart — beyond that, group the tail into "Other".
In dark mode series 2 becomes `#9A9ABF` (navy is the background there).

### 9.2 Rules

- Money-over-time is a **line or area**, never a 3D or stacked-percentage chart.
- Composition is a **stacked bar**, never a pie or donut with more than three slices.
- Gridlines: horizontal only, `border` colour, 1px. No vertical gridlines, no chart borders.
- Axis labels are `text-2xs text-fg-muted`. Y-axis money is compact (`formatMoneyCompact`).
- Every chart has a tooltip giving exact values through `format.ts`.
- Positive/negative deltas use `success`/`danger` — never yellow, and always with an arrow so the
  meaning does not rest on colour alone.
- A chart that is still loading shows a skeleton the size of the plot area, never a spinner.

---

## 10. Icons

- **Lucide only**, 16px (`size-4`) in controls and tables, 20px (`size-5`) in empty states.
- `1.5` stroke width, inherit `currentColor`. Never a filled icon, never a second icon library.
- An icon-only button **must** have an `aria-label` and a tooltip.
- Fixed meanings — do not reassign: `Plus` create · `Pencil` edit · `Trash2` delete · `Eye` view ·
  `Copy` duplicate · `Download` export · `Search` search · `SlidersHorizontal` filters ·
  `Settings2` column visibility · `MoreHorizontal` overflow.

---

## 11. Navigation

- Sidebar is navy in both themes. Section rows are icons + label; the active item is
  `bg-primary-soft text-primary`, and in the navy sidebar the active item is yellow text on a
  translucent yellow fill.
- Sections expand in place. Only the section containing the current route auto-expands.
- **Nav items the user has no permission for are not rendered.** Never a disabled or greyed item —
  see `useSession().can()`.
- Collapsed sidebar shows icons with a tooltip on hover.
- Adding a screen = one entry in `navigation.ts` + one route. Never a hardcoded `<Link to="/...">`;
  all paths come from `paths.ts`.

---

## 12. Accessibility floor

Non-negotiable, because this is a tool people use eight hours a day:

- Text contrast ≥ 4.5:1, UI borders ≥ 3:1. **Yellow only ever carries navy text.**
- Every interactive element is keyboard-reachable, in visual order, with a visible focus ring.
- Modals trap focus and restore it to the trigger on close.
- Status is never communicated by color alone — a badge always has a word.
- Tables use real `<table>`/`<th>` markup with `scope`, not div grids.
- Every icon-only control has an accessible name.

---

## 13. Checklist before a screen is "done"

- [ ] Exactly one yellow button, top-right.
- [ ] No hex value and no stock Tailwind palette class anywhere in the file.
- [ ] Renders correctly in light **and** dark.
- [ ] Loading, empty, filtered-empty and error states all exist.
- [ ] Money/dates/numbers go through `format.ts`; numeric columns are right-aligned.
- [ ] List state is in the URL.
- [ ] Permission-gated at the route and on every action button.
- [ ] Keyboard-navigable; icon-only buttons have labels.
- [ ] Uses `PageHeader` / `ListPage` / `DataTable` rather than a bespoke layout.
