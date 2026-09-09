# Client meeting — what we have, what we don't

Every point from the meeting, checked against the build. Nothing here is coded
yet; this is the audit and the plan.

**Score: 8 of 13 covered, 2 partly, 3 missing — and one of the missing three is
a scope decision, not a screen.**

> **Update:** the client chose option 1 below — cash shifts in the back office,
> entered by hand, no till. **Built.** Sales → Cash shifts, plus Settings →
> Cash registers. Gaps 2 and 3 are still open.

---

## Covered already

| # | Asked for | Where it is |
|---|-----------|-------------|
| 1 | Online and offline sales, seen separately | `channel` on every sale — at the counter / by phone / online store. It is a column on the sales ledger, a field on the sale detail, a choice on New sale, and a **dimension in the report generator**, so "online vs offline" is a report anybody can build. |
| 5 | Print template + editing it | Products → Print templates. Built last: three kinds, size in mm, barcode/QR, ordered fields, preview at true scale, and a print sheet. |
| B1a | Приход (goods receipt) | Products → Goods receipt, with landed cost. |
| B1b | Закуп (procurement) | Procurement → Orders, plus Reorder schedules that draft the order for you. |
| B1c | Отчёт генерация | Analytics → Report generator: four sources, group by anything, chart it, save it. |
| B2 | Categories, e-commerce style | Settings → Categories — a group, and the categories inside it. Every product sits in one. |
| B6 | Employees and access roles | Personnel management → Employees, Access & roles (a per-module permission tree with partial states). |
| B7 | Analytics as charts | Dashboard (KPIs + charts) and the report generator's chart view. |
| 4 | Product images when selling | The part picker on New sale already shows a thumbnail with the SKU and OEM code beside it — parts are named alike and that is what tells them apart. **But the client said "POS", and we have no POS** — see gap 1. |

---

## Partly covered

### B1d · Addressed storage (адресное хранение)

**Now:** a variation has one `shelfAddress`. It shows on the product list, the
product card, and prints on a shelf label.

**The hole:** the address is on the *part*, not on the *part at a location*. A
brake pad stocked in both the main warehouse and the city shop has one address
for both, which is wrong the moment there are two warehouses. Picking, put-away
and stocktaking all need "where is it *here*".

**Plan:** move the address onto the stock row — `stockByLocation[]` already
carries `{ locationId, quantity }` and gains `shelfAddress`.

**What it touches:** the variation editor, the product list column, transfers
(pick from a bin, put into a bin), goods receipt (put-away address), stocktaking
(count by bin rather than by list), and the shelf field on a print template
(which must then ask *which location's* address to print). Seed and its tests
change with the shape.

**Size:** medium. One data-shape change, six screens follow it.

### B8 · Price list generation by filters

**Now:** Products → Export dumps the filtered catalogue to CSV — and it
**includes cost price**, so it is an internal export, not something to send a
customer.

**Plan:** a "Price list" action beside it: filter as usual, then choose the
audience (retail, or a specific client with their discount applied), choose the
columns, and get a printable sheet plus a CSV. Reuses the print-sheet work from
Print templates.

**What it touches:** Products list only, unless fleet pricing lands (gap 2) —
then a price list can be generated *for a fleet*, at their agreed discount.
Cost price must be off by default; that is the whole risk of this feature.

**Size:** small.

---

## Missing

### Gap 1 · Касса and Кассовые смены — BUILT (option 1)

Points 4 and 5 of the OX POS list. **This is the big one, and it is not a
screen — it contradicts a decision already recorded in the project brief:**
*"No cashier POS, at all. Not a separate app, not an embedded one. Sales are
typed in by hand."* Everything built so far assumes that.

If the client wants a till, that is a second product surface — a touch UI, on
different hardware, used by a different person all day. It is not a page in the
back office.

**Three honest options, cheapest first:**

1. **Cash shifts only, in the back office.** Open a shift, record cash in and
   out, close it with a counted amount, and the system shows the variance
   against what it expected. This gives the client the *accountability* they are
   actually asking for — who had the drawer, and did it balance — without
   building a till.
   - New entity `CashShift`: location, employee, opened/closed, opening float,
     expected, counted, variance, movements.
   - `Sale` gains `shiftId`.
   - **The rule that makes it real:** a cash sale is refused when no shift is
     open. Without that, the variance means nothing.
   - New nav entry under Sales. Touches New sale, the ledger, the dashboard.
   - Size: medium.

2. **Cash shifts plus a simple counter screen** — a stripped New sale tuned for
   speed at a counter: big search, images, keypad, one payment step. Still our
   web app, still no hardware.
   - Size: large.

3. **A real POS app.** Separate build, offline-first, receipt printer, barcode
   scanner, drawer. Months, not weeks, and out of this project's frame.

**Ask the client which of the three they mean.** "Касса" in OX means (3); they
may only need (1).

### Gap 2 · Fleet discounts, tied to a specific truck

Points 2 and 3, and they are one feature: *the fleet's drivers get a bigger
discount, but only for a truck registered to that fleet.*

**Nothing in the build supports this.** A client is a flat record — name, debt,
credit limit, cashback. There are no vehicles, no drivers, and a promotion can
only be scoped to categories or products, never to who is buying.

**Plan:**

- **Vehicles** on a client: plate, make, model, year, VIN. A tab on the client
  card.
- **Drivers** on a client: name, phone, and which vehicles they may buy for.
- **New sale gains a vehicle field.** Choosing the client filters the vehicle
  list to that fleet's trucks. The fleet discount applies *only* once a vehicle
  is chosen — which is exactly point 3.
- **Promotions gain a "who" scope** beside the existing "what": everyone, or a
  chosen client / fleet. The fleet's own agreed discount is a field on the
  client; the promotion engine has to decide which wins when both apply.

**What it touches:** the client model and its screens, the sale model
(`vehicleId`, `driverId`), New sale, the sales ledger (a "Vehicle" column), the
promotions form and its matcher, and the report generator (fleet and vehicle
become dimensions).

**The question that must be settled before coding:** when a fleet discount and
a running promotion both apply, does the customer get the better one, or both
stacked? Getting this wrong is money out the door, and it is a business rule,
not a technical choice.

**A bonus worth mentioning to the client:** once sales carry a vehicle, you can
show *the parts history of a truck* — what was fitted, when, and what is due.
For a parts business selling to fleets that is a genuinely valuable screen, and
it falls out of this data for free.

**Size:** large. It is the biggest of the three, and the most valuable.

### Gap 3 · "Sold in the last 3 / 6 months" while transferring

Point 3 of the OX POS list.

**Why it matters:** moving stock between locations without knowing what sells
where is guesswork. This one number turns a transfer from a hunch into a
decision.

**Plan:** two columns on the transfer line picker — units sold at the *source*
and at the *destination* over 3 and 6 months.

**Good news on the data:** nothing new is stored. The reorder schedules already
compute a sales rate per part per location; this is the same selector shown in a
different place. It should be extracted once and shared, not written twice.

**Where else it belongs:** the same figure earns its place on the product card
and on the reorder draft.

**Size:** small — if the existing selector is reused.

---

## Suggested order

1. **Ask about Касса first** (gap 1). It is the only item that can change the
   shape of the product, and the answer decides whether options 2 and 3 below
   are still the right next things.
2. **Sold in 3 / 6 months** (gap 3) — small, immediately useful, no data change.
3. **Price list by filters** (B8) — small, and the client asked for it plainly.
4. **Fleet discounts and vehicles** (gap 2) — largest, highest value, needs the
   stacking rule answered first.
5. **Addressed storage per location** (B1d) — do it before the warehouse grows,
   because retrofitting bin addresses onto live stock is worse than doing it now.
