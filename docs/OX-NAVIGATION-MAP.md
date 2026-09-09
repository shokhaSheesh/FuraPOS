# OX System — navigation map

Captured from the live reference tenant (`furasentr.ox-sys.com`) on 2026-09-05 by logging in and
expanding every menu. **Read-only reconnaissance — no records were created, edited or deleted.**

This is the authority for our own information architecture: our sidebar mirrors this structure and
naming one-for-one, so that anyone comparing the two products sees the same modules in the same
order. Where OX's Russian label is idiomatic, our English label is a faithful equivalent, not a
reinterpretation.

The `OX route` column exists so a screen can be cross-referenced against the reference product while
it is being built.

## Top level

OX shows badges on two sections: **Закупки** is `New`, **Финансы** is `beta`. We mirror both.

| #   | OX (ru)               | Ours (en)            | OX route               |
| --- | --------------------- | -------------------- | ---------------------- |
| 1   | Дашборд               | Dashboard            | `/app/dashboard`       |
| 2   | Продажи               | Sales                | —                      |
| 3   | Продукты/Услуги       | Products / Services  | —                      |
| 4   | Закупки `New`         | Procurement `New`    | —                      |
| 5   | Управление персоналом | Personnel management | —                      |
| 6   | Финансы `beta`        | Finance `beta`       | `/app/finance`         |
| 7   | Маркетинг             | Marketing            | —                      |
| 8   | Аналитика             | Analytics            | —                      |
| 9   | Интеграции            | _(not in scope)_     | `/app/integration`     |
| 10  | Мои загрузки          | My uploads           | `/app/exports`         |
| 11  | Партнёрская программа | _(not in scope)_     | `/app/partner-program` |
| 12  | Настройки             | Settings             | `/app/settings`        |
| 13  | Поддержка             | _(not in scope)_     | —                      |

## 2. Продажи — Sales

| OX (ru)           | Ours (en)        | OX route                                |
| ----------------- | ---------------- | --------------------------------------- |
| OX POS Касса      | _(not in scope)_ | `/app/sells/cashdesk-info`              |
| Новая продажа     | New sale         | _(no route — navigates to Cash shifts)_ |
| Все продажи       | All sales        | `/app/sells/orders`                     |
| Кассовые смены    | _(not in scope)_ | `/app/sells/shifts`                     |
| Закрытые продажи  | _(not in scope)_ | `/app/sells/closed`                     |
| Открытые продажи  | Open sales       | `/app/sells/drafts`                     |
| Удалённые продажи | Deleted sales    | `/app/sells/deleted`                    |
| Отложки           | Postponed sales  | `/app/sells/postpones`                  |

## 3. Продукты/Услуги — Products / Services

Note: **Suppliers lives here in OX, not under Procurement.** We follow OX.

| OX (ru)               | Ours (en)       | OX route                    |
| --------------------- | --------------- | --------------------------- |
| Список продуктов      | Product list    | `/app/products/management`  |
| Перемещение продуктов | Transfers       | `/app/products/transfers`   |
| Коррекции             | Corrections     | `/app/products/corrections` |
| Инвентаризация        | Stocktaking     | `/app/products/reviews`     |
| Приход                | Goods receipt   | `/app/products/imports`     |
| Переоценка            | Repricing       | `/app/products/reprices`    |
| Шаблоны для печати    | Print templates | `/app/products/stickers`    |
| Поставщики            | Suppliers       | `/app/products/suppliers`   |

### Transfers

Built without opening OX's screen, so the shape is ours and worth stating plainly for comparison
later. Three screens — list, detail, create — and one deliberate model decision:

**A transfer is a document with four states, and stock moves at two of them.** `draft` →
`in_transit` (the source is debited) → `received` (the destination is credited). Between dispatch
and receipt the goods are on a truck and appear in **neither** location's stock. Cancelling a draft
moves nothing; cancelling an in-transit transfer returns the goods to the source; a received
transfer cannot be cancelled at all — that is what Corrections is for.

The alternative — moving both ends at once — would have a shop counting stock it cannot physically
find, and is the thing to check OX for: if it credits the destination on dispatch, that is a real
difference and we should hear which behaviour the business expects.

Stock is validated against the source **at dispatch, not at drafting**, since a sale may have taken
the last one in between.

#### Columns, against OX's

OX's list carries 19 columns. Ours and theirs, with the reasoning for the four we did not take:

| OX (ru)             | Ours           | Note                                                                                                                                                                                                               |
| ------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ID                  | Number         | `TR-00001`                                                                                                                                                                                                         |
| Время начала        | Sent           | We keep three timestamps, not two: created, sent, received                                                                                                                                                         |
| Время завершения    | Received       |                                                                                                                                                                                                                    |
| Статус              | Status         | draft / in transit / received / cancelled                                                                                                                                                                          |
| Место отправления   | Route (from)   | Shown as one `From → To` column; a movement reads as one phrase                                                                                                                                                    |
| Место получения     | Route (to)     |                                                                                                                                                                                                                    |
| Кол-во              | Units          | The most concrete quantity a line has yet                                                                                                                                                                          |
| **Заказано**        | **Ordered**    | What was asked for                                                                                                                                                                                                 |
| **Отправлено**      | **Sent**       | What actually left — the warehouse may not have found it all                                                                                                                                                       |
| **Принято**         | **Received**   | What actually arrived                                                                                                                                                                                              |
| **В пути**          | **In transit** | Sent and not yet counted; zero once the far end has counted                                                                                                                                                        |
| Отправил            | Sent by        |                                                                                                                                                                                                                    |
| Получил             | Received by    |                                                                                                                                                                                                                    |
| Создатель           | Created by     |                                                                                                                                                                                                                    |
| Заказал             | —              | **Not built.** Distinct from the creator only with a request-and-approve flow, where a shop raises the order and someone else writes the transfer. Revisit if shops request stock in-app.                          |
| Сумма поставщика    | —              | **Not built.** Would duplicate "Value at cost": we have one cost concept, the supplier's invoice price plus its currency. It becomes a real second number only once landed costs (freight, duty) exist separately. |
| Сумма себестоимости | Value at cost  | Permission-gated on `products.cost.view`, as in the catalogue                                                                                                                                                      |
| Сумма продажи       | Value at sale  |                                                                                                                                                                                                                    |
| Заметка             | Comment        |                                                                                                                                                                                                                    |

**The four quantity columns are the reason to look at OX's screen at all.** A single "quantity"
silently asserts that what was ordered, what shipped and what arrived are the same number. They
routinely are not, and the two gaps mean opposite things:

- **ordered − sent** stayed on the source shelf. Nothing is lost; the request was under-filled.
- **sent − received** left one shelf and reached no other. That is stock the business paid for and
  no longer has, so it is written off against the transfer, and total stock drops by exactly it.

Both hand-offs therefore _ask_ rather than assume, pre-filled with the optimistic answer so the
ordinary case stays one click.

### Corrections

Stock that changed when nothing was sold, received or moved: breakage, shrinkage, expiry, a
miscount. Built list, detail and create.

**The reason is the document.** "Stock went from 9 to 7" is not information; "two were dropped" is,
and it is the difference between a warehouse that can be improved and one that merely leaks. So the
reason is a required field, an unhideable column and a filter of its own.

Three decisions worth recording:

- **The user types the count, never the difference.** Asking for "−2" invites a sign error that
  silently doubles a loss. A line opens at the current figure, so an untouched row is a no-op rather
  than an accidental write-off to zero, and a correction where every count matches is rejected — a
  document saying nothing happened looks like a decision.
- **`countedBefore` is read live at the moment of saving,** not trusted from the form. Between
  opening the screen and saving, a sale may have taken one off the shelf; measuring the delta
  against a stale figure would silently undo it.
- **Reversing keeps both entries.** That a correction was made and then withdrawn is itself part of
  the record.

**Applies immediately — whoever counts, records.** Pending the client's answer on whether write-offs
need a second signature. A review step would slot in as a third status before `applied` without
changing any arithmetic, because stock moves on the transition into `applied` and nowhere else.

### Stocktaking

A planned count of a shelf, built as a **session** rather than an edit. Built list, counting sheet
and start-a-count. As with Goods receipt, built before OX's Инвентаризация was seen.

**The whole reason it exists rather than being a large correction: _not counted_ is different from
_counted zero_.** A part nobody reached must not be written off; a part someone checked and found
none of must be. A correction cannot express that — a line you do not add is simply absent — so a
stocktake carries every line in scope and a `counted` of `null` until someone enters something. The
sheet draws it blank, and applying skips it entirely; the confirmation says so in as many words.

Three more decisions:

- **`expected` is frozen when the sheet opens**, because it is what the person walking the aisle is
  measured against. Re-reading it at the end would blame them for a sale.
- **The variance is applied as a delta against live stock**, not by setting the shelf to the counted
  figure. If three were sold mid-count, that sale survives; setting to the count would resurrect
  them. Tested.
- **Scope can be one category.** Counting a whole warehouse in one session is a day nobody has, so
  the brakes aisle this morning and filters tomorrow is how it actually happens. The line count is
  shown before starting, because "this is 184 lines" changes the decision.

The headline figure is **accuracy**, not loss: a warehouse finding a small discrepancy every month
is working, while one whose counts agree 80% of the time cannot trust a number on any other screen,
however small the money looks.

#### Columns, against OX's

OX's Инвентаризация list carries 9 columns. Ours was built before it was seen.

| OX (ru)                | Ours                           | Note                                                                  |
| ---------------------- | ------------------------------ | --------------------------------------------------------------------- |
| ID                     | Number                         |                                                                       |
| Время начала           | Started                        |                                                                       |
| Время завершения       | Finished                       | Added after seeing OX                                                 |
| Статус                 | Status                         |                                                                       |
| **Тип инвентаризации** | **Counted by**                 | Added after seeing OX — see below                                     |
| Локация                | Location                       |                                                                       |
| Фильтр                 | (the value under "Counted by") | OX splits type and value across two columns; we keep them in one cell |
| Создатель              | Started by                     |                                                                       |
| Заметка                | Comment                        |                                                                       |

**`Тип инвентаризации` was the thing worth taking.** OX names the _dimension_ a count was scoped
by — "Локация" — as its own column, rather than leaving an empty cell where a category might have
been. That is right: "Whole location" says a decision was made, where a blank only says a field was
left alone. Ours now reads Whole location / Category / Brand / Category and brand, with the value
beneath it. **Brand was added as a scope at the same time**, since OX's having a _type_ field
implies more scopes than one.

**Six columns we have that OX does not**, and the reason is the same for all of them: OX's list
tells you a count _happened_ but nothing about what it _found_ — no progress, no accuracy, no
variance, no value. Ours carries Counted (a progress bar), Agreed, Differs, Missing, Found and
Value at cost, because a stocktake list where you cannot see whether anything was wrong is a log of
events rather than information.

**Worth telling the client, from their own data:** the live tenant has **one** stocktake, ever, and
it ran from 07:11:38 to 07:12:35 — fifty-seven seconds. Whatever that was, it was not someone
walking an aisle. Either the feature does not fit how Fura works, or they know they should count and
do not. Either answer changes how much this screen is worth building out.

#### Corrections and Stocktaking are the same operation

A correction is ad-hoc and small ("this box arrived crushed"); a stocktake is a planned count of a
whole location whose differences become adjustments in bulk. OX ships them as separate nav items and
so do we, but **they should share one adjustment ledger underneath** — otherwise there are two
parallel histories and no single answer to "why is this number what it is".

**That is how it was built.** Applying a stocktake does not move stock itself — it creates a
`Correction` with reason _Recount_, `source: 'stocktake'` and a reference back to the count. So the
Corrections list remains the single ledger of every adjustment, the stocktake links forward to its
correction, and reversing that correction undoes the count.

Not attempted: a unified **stock movement ledger** across sales, transfers, receipts and
corrections. That is the real answer to "what happened to this unit", and it is a reporting concern
rather than something any one of these screens should own.

### Goods receipt

Stock arriving from a supplier — **the only way stock legitimately enters**. Everything else in the
module takes it away. Built list, detail and create.

#### Landed cost

The reason this screen is worth more than a list of deliveries. A part costs the supplier's price
_plus its share of freight, duty and broker fees_; a cost price that ignores those makes every
margin on every screen optimistic. So a receipt carries **additional costs** as their own lines, and
posting it writes the landed cost onto the variation.

This also answers the question left open in the Transfers section: we now have two genuinely
different money figures, so `Сумма поставщика` (supplier total) and `Сумма себестоимости` (cost
total) are both real and both shown, rather than one number under two names.

**Two business decisions to confirm with the client:**

1. **Allocation basis.** Extras are spread in proportion to each line's _value_. That is the
   ordinary method, but freight is really a function of weight or volume — and the catalogue does
   carry `cargoWeightKg`. By weight would be more accurate **if those weights can be relied on**; a
   rule that silently skips every part without a weight is worse than one that approximates all of
   them, which is why value is the default.
2. **Which cost wins.** Posting sets the variation's cost to _this receipt's_ landed cost — last
   landed cost wins. The alternative is a weighted average across what is already on the shelf,
   which is more correct for valuation and less predictable for a buyer reading a screen. Simple and
   predictable was chosen; it is one line to change.

#### Columns, against OX's

Read off OX's Приход list (13 columns). Ours was built before this screen was seen, so the
divergence below is the honest record of building from a model rather than from the reference.

| OX (ru)         | Ours             | Note                                                                          |
| --------------- | ---------------- | ----------------------------------------------------------------------------- |
| ID              | Number           |                                                                               |
| Дата            | Created          |                                                                               |
| Кол-во          | Invoiced         |                                                                               |
| **Реализовано** | **Sold through** | Added after seeing OX. See below.                                             |
| Локация         | Landed at        |                                                                               |
| Пользователь    | Created by       |                                                                               |
| Статус          | Status           |                                                                               |
| Поставщики      | Supplier         |                                                                               |
| Заметка         | Comment          | OX uses it as the delivery's _name_ — "Export N7", "N 11 Pump clutch Starter" |
| Себестоимость   | Landed total     |                                                                               |
| Цена поставки   | Supplier total   |                                                                               |
| Цена продажи    | Value at sale    | Added after seeing OX                                                         |
| Скачать         | Download as CSV  | Added after seeing OX, as a row action                                        |

**`Реализовано` was the real find.** A progress bar per delivery: how much of it has sold. It says
whether a container was a _good buy_, not merely that it arrived — nothing else in either product
answers that. Ours is an **estimate**, and labelled as such: exact sell-through needs lot tracking,
where every sale line remembers which delivery it drew from, and this build has none. Instead,
whatever is still on the shelf the goods landed on is assumed to be from this delivery. That is
right in the ordinary case and **understates** sell-through when a later delivery has restocked in
between. Worth revisiting if lot tracking ever lands.

**`Себестоимость` and `Цена поставки` are identical in every row of the live tenant** — 59 814 900
against 59 814 900, 308 668 500 against 308 668 500, and so on down the list. So OX has the two
fields but Fura is not using them differently: no freight or duty is being folded into cost there.
Our landed cost is therefore an **addition to OX, not a match**, and the question for the client is
whether it is wanted — it is the difference between a margin that is real and one that is optimistic.

Three things we have that OX's screen does not, all deliberate and all worth confirming:

- **Draft → posted.** OX's statuses here are only `Завершено` / `Удалено`. Ours holds a receipt open
  until someone counts it in.
- **Invoiced vs received per line.** OX shows a single `Кол-во`. Ours splits them, as OX itself does
  on transfers — a short delivery is a claim against the supplier and needs to be visible.
- **Freight and duty as their own lines**, and the uplift percentage that follows from them.

Also noted from the screen: OX's Локация reads "Furasentr Erkin" on every row, so the live tenant
appears to run a single location. Our multi-location model may be richer than the business actually
needs — worth asking before more is built on it.

#### Shortfalls mean something different here

Short on a transfer is stock that left one shelf and reached no other: a loss, written off. Short on
a receipt is stock that was invoiced and never arrived: **a claim against the supplier**, and it was
never ours to lose. Nothing is written off, and the landed cost is spread over what actually turned
up — so the units that did arrive carry the freight paid for the ones that did not.

Cancelling a posted receipt takes its stock back, and is **refused** if any of it has already been
sold or moved on, because that would push a shelf below zero. The message says to correct it
instead.

### Repricing

Changing what many products sell for at once, as a document. Built list, price sheet and set-up. As
with the last three, built before OX's Переоценка was seen.

**Why it is not the price field on a product.** A price change has to be answerable later — when did
this go up, and who decided — and it is almost never one price. For an importer buying in USD and
selling in UZS, every time the som slides _every_ price is wrong at once. That is the case this
screen exists for.

- **It never touches cost.** Cost is discovered at goods receipt — what was actually paid, freight
  included. Price is decided. A screen that could edit both would let someone invent a margin by
  moving the wrong number.
- **Prepare, review, apply.** Nothing changes until the third step. A bulk rule is easy to get wrong
  by a decimal place, and the gap is where someone notices. Prices stay editable in the sheet,
  because a rule gets ninety per cent of a repricing right and the rest is judgement.
- **Margin is shown per line, and "below cost" is a filter.** A blanket percentage looks harmless
  until it puts something under what it cost; applying says so before it lets that through.
- **Reverting replays the snapshot, not the rule in reverse.** +7% then −7% does not return to the
  original number, and rounding pushes it further every time.

Four rules: by percentage, by fixed amount, **to a target margin** (works the price back from what
each part actually cost — the only one that can _lower_ a price it was told to raise, which is how a
catalogue of drifted margins gets fixed), and by hand. All with a rounding step, because bulk
arithmetic produces prices like 2 340 671 that nobody would print on a label.

#### Columns, against OX's

Read off OX's Переоценка list. More columns exist off-screen to the right and have not been seen.

| OX (ru)     | Ours                   | Note                                                        |
| ----------- | ---------------------- | ----------------------------------------------------------- |
| ID          | Number                 |                                                             |
| Дата        | Created                |                                                             |
| Статус      | Status                 | OX shows only `Завершено`; ours also has Draft and Reverted |
| Кол-во      | Products               |                                                             |
| **Локация** | **Location**           | Added after seeing OX — see below                           |
| Создатель   | Created by             |                                                             |
| Бренды      | (part of "Applied to") |                                                             |

**`Локация` raises a real question we should not answer by guessing.** OX scopes a repricing by
location. Two readings, and they are very different:

1. **Location narrows _which products_ are repriced** — "everything the Chilonzor shop carries".
   Cheap, and what we now do.
2. **Prices are per location** — the same part costs more in a shop than at the warehouse. That is a
   model change: `salePrice` would move from the variation to a variation-location pair, and every
   screen that shows a price would need to say _which_ price.

We built (1) and wrote the assumption into the code. **Ask the client: does the same part ever sell
for a different price at a different shop?** If yes, that is a bigger change than this screen, and
it should be settled before Sales and the catalogue are built on further.

Four columns we have that OX does not: the **rule** in words, **up / down**, **average move** and
**below cost**. Same reasoning as everywhere else — OX's list says a repricing happened but not what
it did, and "+8%, rounded to 1 000" is the only thing that makes a row worth reading.

**And the same signal as Инвентаризация, more strongly:** twenty Переоценка records, all created
between 07:05:16 and 07:06:09 — twenty documents in fifty-three seconds — most with a quantity of
`0.00`. That is somebody clicking Add repeatedly, not a business repricing its catalogue. Combined
with the single 57-second stocktake, it suggests Fura is not using either screen in OX. Worth asking
whether that is because the screens are unhelpful or because the need is not there; the answer says
how much either is worth in the new product.

### Suppliers

**The first screen built with OX's version in front of us rather than after the fact**, and the
richest one in their product: six KPI cards, an analytics block, counted lenses and a table where
every column is money or movement. That is the insight worth keeping — **a supplier list is not a
contact book.** The name is how you find the row; the debt is why you opened it.

| OX (ru)                | Ours                        | Note                                                                                                                                                                                  |
| ---------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Название               | Supplier                    | Contact name beneath it                                                                                                                                                               |
| Долг                   | We owe                      | Plus days past terms, which OX does not show                                                                                                                                          |
| Последняя дата платежа | Last paid                   |                                                                                                                                                                                       |
| Продано                | Sold on                     | A bar, as OX draws it                                                                                                                                                                 |
| Остаток продуктов      | Still on the shelf          | Units and value                                                                                                                                                                       |
| Закупки                | Products / Bought from them | OX's cell carries "товары не привязаны" and "Автозаказ не запланирован", both of which belong to Procurement — not built                                                              |
| Бренд                  | —                           | **Not built.** In our model the product's brand _is_ who we buy from, so a supplier-to-brand link would be the same fact twice. Revisit if a supplier ever sells more than one brand. |
| Зона                   | Zone                        |                                                                                                                                                                                       |

Their KPI cards map to ours as: Текущий долг → We owe, Остаток на складе → Still on the shelf,
Закуплено → Bought, Без движения → Gone quiet. **Продано** becomes a column rather than a card, and
**Возвраты** is not built — there is no returns concept anywhere in this app yet, and a card reading
zero because a feature does not exist is worse than no card.

We add **days past terms**, which OX does not have. A debt is not late until someone agreed when it
was due, so `paymentTermDays` is nullable and nothing without it can be overdue.

**"Без поставщика".** OX shows unattributed stock as a synthetic supplier row. We show it as a note
above the table instead: it is a data-quality problem rather than a company, and a row you cannot
click or pay reads like a bug.

#### The wallet, finally built

CLAUDE.md has said since the start that clients, employees and suppliers get the **same** wallet
sub-view rather than three bespoke screens. Suppliers is the first of the three to have a detail
page, so `shared/components/WalletPanel.tsx` exists now and is owner-agnostic: balances, movements
and insights, with the labels supplied by the caller because "we owe them" and "they owe us" are
opposite sentences about the same number. Clients and employees drop into it unchanged.

`walletTransactions` is one ledger in the store for every owner type, filtered on read — the shape
the shared component needs, and the reason a supplier payment and a client top-up will never be two
different tables.

## 4. Закупки — Procurement

| OX (ru)            | Ours (en)         | OX route                     |
| ------------------ | ----------------- | ---------------------------- |
| Подбор товаров     | — (removed)       | `/app/procurement/selection` |
| Заказы             | Orders            | `/app/procurement/orders`    |
| Расписание подбора | Reorder schedules | `/app/procurement/schedules` |

### Product selection — removed

Built twice and then **removed at the client's request**, after being rebuilt to match OX's
saved-run shape. Recorded rather than quietly dropped, because the reasoning is worth keeping:

- It was the only screen in the app that **forecast** rather than recorded. Sales gave the rate,
  stock the level, receipts the supplier, MOQ the realistic order size.
- Its arithmetic is in git history at `fb34280` — daily rate, days of cover, a lead-time-relative
  urgency, and a shortfall rounded up to a whole MOQ, with sixteen tests.
- **Fura had never used OX's version either.** Their Подбор товаров read "Подборов пока нет —
  начните первый". That is the same signal as their single 57-second stocktake and their twenty
  test repricings, and it is the strongest argument for the removal.

Removed from the sidebar, the routes, the permission tree and the dashboard at the client's request.
The dashboard's "below their reorder point" row now links to the product list filtered to low stock,
which is where the answer actually is.

**Knock-on, now resolved: «Расписание подбора» had nothing left to schedule.** The answer was not to
delete it but to give the run somewhere to land — see below.

### Orders — built without an OX reference

Built like Transfers, Corrections, Goods receipt, Stocktaking and Repricing: **no OX screenshot was
supplied**, so this is our shape rather than a comparison. Flagged so a later screenshot is read as
new information, not a contradiction.

**Why it exists.** Until now goods receipts appeared from nowhere — stock turned up and someone
typed what was in the box, with nothing to check it against. An order is the other half: the
commitment made weeks earlier. It is what makes _where is it_ and _is it late_ answerable, and what
turns a receipt from a recording into a check.

**The decisions worth keeping:**

- **Receiving is not a status.** `draft → sent → confirmed` are steps a person takes; a delivery is
  an event that can happen as many times as the supplier ships. So the detail page offers exactly
  one "next step" button, and "Book a delivery" sits beside it rather than in the sequence.
  `partial` and `received` are then _derived_ from what has arrived, never picked from a menu.
- **A delivery is a real goods receipt.** `receiveAgainstOrder` builds one and posts it through the
  same path as any other, so stock, landed cost and the adjustment ledger behave identically
  whether or not an order was involved. The order stores the receipt ids; the receipt links back.
- **`receivedQuantity` is never typed on an order.** It is written by the receipts, so an order can
  never claim more arrived than a document recorded.
- **Over-shipping is clamped to what is outstanding.** A supplier who sends more than was ordered
  has sent something nobody asked for; that belongs on its own receipt rather than silently
  inflating this one and the order's completion.
- **Cancelling is refused once anything has arrived** — it would leave stock on a shelf with no
  order behind it.
- **Nothing is late without a promised date.** `expectedAt` is optional, and `daysLate` returns
  null without it, when nothing is outstanding, and once the order is closed.
- **The list sorts late first, then still-open, then by date**, and leads with _Still coming_ rather
  than what was ordered — nobody opens an orders screen to admire the completed ones.
- **The agreed price is editable per line**, defaulting to the last known cost. An order is where a
  price is agreed; taking it from the catalogue with no way to change it would make the check
  against the delivery meaningless.

### Reorder schedules — «Расписание подбора»

OX's columns, from the live tenant: Поставщик · Дни месяца · Время · Период продаж · Страховой
запас · Срок доставки · Следующий запуск · Последний запуск · Статус. Its own description reads:
_"В указанные дни месяца система считает по товарам поставщика, что и сколько дозаказать (остаток,
скорость продаж, срок доставки, MOQ), и уведомляет ответственных."_

We keep every one of those columns. The change is what a run **does**.

**OX notifies. We leave a draft order.** OX's run ends in a notification: the buyer still has to
open the selection, read it, and retype the whole thing as an order. Ours creates a real draft
order in Orders — priced, addressed to the supplier, with an expected date one lead time out — for
a person to check and send. The schedule does the arithmetic and the typing; committing money to a
supplier stays a human decision, and **nothing is ever sent automatically**.

That is also the answer to the knock-on from removing Product selection. The reorder arithmetic was
never worth a screen of its own — it is worth exactly what it produces — so it survives here, with
its sixteen tests, as the engine behind a schedule rather than a page someone has to visit.

**Corrections to an earlier note in this document.** Product selection's entry said OX has no
lead-time field at all. It does, on this screen: «Срок доставки». It is missing from the _manual_
run, not from the product.

**What we changed, and why:**

- **A day the month does not have is clamped to its last day, not skipped.** Someone who asks for
  the 31st wants a run at the end of every month; silently missing February would be the one month
  they never find out about. The rule is stated under the day picker rather than left to be
  discovered.
- **The dialog shows what a run would order right now**, recalculated as the numbers change — count,
  units and rough value. A schedule is a promise about the future made out of four abstract knobs,
  and nobody can tell from the knobs whether they have asked for eleven products or eleven hundred.
  OX asks for the same four numbers and shows nothing until a fortnight later.
- **"Last run" says what it produced**, linking to the order, and distinguishes _never run_ from
  _ran and found nothing_. A run that finds nothing is a real, useful outcome — the shelves are
  fine — and is recorded rather than silently skipped, so nobody wonders whether it happened.
- **Run now**, for the buyer who is not waiting until the 15th. It records `trigger: 'manual'`, so
  a hand-run and a due run stay distinguishable.
- **The cadence reads as a sentence** — "the 1st and 15th of the month" — not a row of bare numbers
  to decode.
- **The horizon is spelled out**: "each delivery has to last 51 days — 30 to arrive + 14 until the
  next order + 7 spare". Three knobs that are really one number should say so.

**Not built, deliberately:** OX's «уведомляет ответственных» — who gets told. That belongs in the
notification preferences (event type × channel), not on this screen, and the events system is not
built yet.

## 5. Управление персоналом — Personnel management

| OX (ru)             | Ours (en)      | OX route                               |
| ------------------- | -------------- | -------------------------------------- |
| Сотрудники          | Employees      | `/app/personal-management/users`       |
| Мотивация продавцов | — (removed)    | `/app/personal-management/motivations` |
| Планирование        | — (removed)    | `/app/personal-management/list/target` |
| Доступы и роли      | Access & roles | `/app/personal-management/roles`       |

### Employees — «Сотрудники»

Built **without an OX reference screenshot**, like Transfers, Corrections, Goods receipt,
Stocktaking, Repricing, Orders and Reorder schedules. Flagged so a later screenshot reads as new
information rather than a contradiction.

**The framing.** A staff list that is names and phone numbers is an address book, and nobody opens
an address book to make a decision. An employee record is two things at once and the screen serves
both: **a key** (who signs in, as what role, at which location) and **a performance record** (every
sale already carries who made it). So the columns are the ones that change something — what they
sell, whether they are still signing in, what the company owes them.

**The decisions worth keeping:**

- **The signed-in user _is_ an employee record.** `SessionProvider` now holds `emp-1` rather than a
  parallel `usr-1`. Two identities for one person is how a staff list and an access list drift
  apart.
- **Sales gained `sellerId`,** with `sellerName` kept beside it. Performance is counted on the id;
  the name is snapshotted so archiving someone does not blank the history of every sale they made.
- **Ranked by what they sold this month, not alphabetically** — and on _the same figure the table
  shows_. An early version sorted on all-time revenue while displaying this month, so the summary
  tile named a leader who sat fifth. A list sorted on a number that is not on screen reads as
  broken.
- **"Last active" is a real column.** It finds the account nobody remembered to close: an active
  "seller" who has not signed in for a month is either gone or is a login somebody else is using.
  Suspended and archived people are excluded — they are _meant_ to be inactive, and flagging them
  is noise, not a finding.
- **Three statuses, and none of them is deletion.** Active, Suspended (leave, or something being
  looked into — reversible, history untouched), Archived (left). Deleting a person would take their
  sales with them.
- **Margin per seller, labelled as an estimate.** A sale line records what it sold for but not what
  it cost, so cost comes from the product's cost _today_. It is right enough to compare two sellers
  over the same period and wrong for anything an accountant would sign — which is what the caption
  says. It is the number that separates someone who sells a lot from someone who discounts a lot.
- **The wallet is the shared component**, third owner type after clients and suppliers, exactly as
  CLAUDE.md intends. Building it here surfaced two bugs in shared code, both fixed at source: the
  panel hardcoded "a positive balance is alarming" (a supplier's meaning — salary owed to staff is
  routine), and `Tabs` rendered a bare-number badge as `Movements1`, because a text label and a
  text badge merge into one anonymous flex item and `gap` does not apply.

**Open question for the client, alongside the supplier-debt one:** payroll is seeded, not generated.
Nothing in the app pays anyone or records an advance. Before wiring it we need to know how Fura
actually pays — monthly in arrears, advances against the month, and whether Seller motivation's
bonus lands in the same wallet.

### Seller motivation and Planning — removed

Both cut at the client's request, out of the sidebar, the routes, the paths and the permission
tree. Neither had been built; the entries were placeholders. Recorded here so the omission reads as
a decision.

The one knock-on is small and already handled: Employees' base-pay field used to be captioned
"before anything Seller motivation adds", which now refers to a screen that does not exist.

### Access & roles — «Доступы и роли»

Built **without an OX reference screenshot**, like every other screen since Products.

**What it is.** A role is a named set of permission keys. Access is granted to the role, never to a
person, because granting person by person does not survive staff turnover: the fifth seller you
hire should inherit what the other four have, and a rule change should happen once.

**The permission tree already existed** — `src/shared/config/permissions.ts`, 184 grantable keys —
and already drove the route guards and sidebar visibility. This screen is the third consumer, which
is the point: a permission a role cannot be granted is a permission nothing can check, so there is
exactly one list.

**The decisions worth keeping:**

- **A grid, not a nested checkbox list.** Rows are screens, columns are the five actions. 184
  checkboxes down a single column is a list with no shape, where "can this person delete a sale"
  takes ten seconds to answer; across a grid it takes a glance.
- **Partial is a first-class state.** CLAUDE.md asks for it and it is the normal case: a manager who
  views every finance report and edits none. A yes/no parent checkbox forces whoever configures it
  to choose between over-granting and clicking twenty boxes.
- **A dash, not a disabled box,** where an action does not apply. "Not applicable" and "you may not
  change this" are different statements and should not look the same.
- **Actions imply view, and removing view removes the rest.** Someone who can edit a product but not
  see the product list holds a permission they can never use — a configuration mistake, not a
  choice.
- **Changes are held until Save.** A grid that writes on every click means someone half way through
  re-scoping a role has, for a few seconds, granted access they were about to take away. On a screen
  about access, "for a few seconds" is the wrong amount of time. The header counts the unsaved
  additions and removals, and Discard puts it back.
- **The Owner role cannot be edited or deleted, and holds `*`.** It is the way back in when
  something else is mis-configured — a product where every administrator can be locked out is one
  that eventually locks everyone out — and `*` means a module added next month is included without
  anyone remembering to tick it.
- **A role people still hold cannot be deleted.** They would be left holding a role that does not
  exist, reaching nothing, with no obvious reason why.
- **A new role starts with nothing**, rather than copying an existing one. Copying is a convenience
  that quietly hands out access nobody chose.
- **"Who holds it" sits beside the grid**, naming the people a save will affect. A permission change
  is abstract until it has faces attached.
- **No description field.** Roles carried a one-line description; it was removed at the client's
  request, from the row, the header and the model. The "Can reach" column says what a role is for
  in terms of what it actually holds, which cannot go stale the way a sentence can.
- **The seeded roles are different _shapes_ of access, not different amounts.** The accountant sees
  every figure and touches no stock; the storekeeper moves stock all day and cannot see a price; the
  seller has no `products.cost.view` at all, because someone who knows the cost price can work out
  how far they may discount. A single "level" slider could express none of that.

## 6. Финансы — Finance — removed

The whole module is cut at the client's request: sixteen screens out of the sidebar, the routes, the
paths and the permission tree. **Nothing had been built** — every route was a `todo()` stub and the
feature folders were empty — so removal cost nothing already made.

The OX rows are kept here so the omission reads as a decision:

| OX (ru)              | Ours (en)   | OX route                     |
| -------------------- | ----------- | ---------------------------- |
| Дашборд              | — (removed) | `/app/finance/dashboard`     |
| Транзакции           | — (removed) | `/app/finance/transactions`  |
| Договоры             | — (removed) | `/app/finance/contracts`     |
| Счета                | — (removed) | `/app/finance/invoices`      |
| Бюджет               | — (removed) | `/app/finance/budget`        |
| Сценарии             | — (removed) | `/app/finance/scenarios`     |
| Отчёты (P&L, ДДС, …) | — (removed) | `/app/finance/reports/*`     |
| Настройки (счета, …) | — (removed) | `/app/finance/accounts` etc. |

**What it was coupled to, and what happened to each:**

- **The dashboard's "overdue supplier payments" row** linked to the Payables report. It now links to
  the supplier list filtered to what we owe (`/products/suppliers?lens=owed`), which is where that
  answer actually lives. The count was **hardcoded to `3`**; removing the destination was the push
  to compute it properly, from supplier debt against agreed payment terms.
- **The Accountant role** granted four `finance.*` keys. Stripped. The role-model test that asserts
  no role grants a key outside the tree caught them immediately, which is what it was written for.
- **The `personnel.salary` permission** was labelled "See salary & settlements". Settlements was a
  Finance screen; it is now just "See salary". The permission itself stays — it lives in Personnel
  and gates base pay and the wallet on the employee page.
- **Nothing else.** Supplier debt, the employee wallet, sale payments and payment methods all live
  in their own modules and never imported anything from Finance.

**The one thing to be aware of, which blocks nothing:** «Расчёты с сотрудниками» (Employee
settlements) was the only planned home for a payroll ledger. The employee wallet still shows salary
and advances on the employee page, and nothing generates them either way — so this does not break
anything, but it does mean the open payroll question has no destination screen if the client later
wants one.

## 7. Маркетинг — Marketing

Cut to two screens at the client's request. The OX rows are kept so the omissions read as decisions.

| OX (ru)           | Ours (en)   | OX route                                |
| ----------------- | ----------- | --------------------------------------- |
| Клиенты           | Clients     | `/app/marketing/customers`              |
| Группы            | — (removed) | `/app/marketing/groups`                 |
| Кэшбэк            | — (removed) | `/app/marketing/cashbacks`              |
| Рассылки          | — (removed) | `/app/marketing/newsletters`            |
| Цифровые рассылки | — (removed) | `/app/marketing/digital-mass-messaging` |
| Акции             | Promotions  | `/app/marketing/promotions`             |
| Купоны            | — (removed) | `/app/marketing/coupon-collections`     |

Nothing had been built in the five that went, and nothing referenced them. Cashback survives as a
_field_ on a client and in the shared wallet; what was cut is the screen for configuring earn rules.

### Clients — «Клиенты»

**The framing.** For a parts business the customer list is not a mailing list, it is **a credit
ledger with names on it**. Half the trade is repeat garages buying on account, and the questions
worth a screen are: what do they owe, are they past what we allowed, and have they stopped coming.
Sorted by debt, not alphabetically — an alphabetical customer list answers a question nobody asked.

- **`creditLimit` is the field that does something.** Null means no account — they pay up front —
  and that is deliberately different from a limit of zero. Both stop a credit sale; only one is a
  problem, and the list says which ("Pays up front" vs "over limit").
- **Over-limit is derived, not a flag.** Somebody who was inside their limit yesterday and is over
  it today should show as over it without anyone re-saving the record.
- **Blocked, not deleted.** Someone who stopped paying must stay findable, and their history is the
  reason they were blocked in the first place.
- **"Gone quiet" ignores clients who never bought.** They are a lead, not a lapsed customer, and
  mixing the two makes the number useless.
- **The wallet is the shared component**, fourth owner type after suppliers and employees, with the
  credit limit shown and an insight when they are past it.
- **The seed gained a shape:** businesses have accounts and individuals do not, and one business is
  deliberately over its limit — that is the row this screen is opened to find.

### Promotions — «Акции»

**The framing.** Without this screen a discount is a number somebody typed into a sale, and six
weeks later nobody can say whether the campaign made money — only that margin fell. A promotion is
the same discount **recorded as a decision**, which makes it two things: a rule the New sale screen
applies, and a label on the sales it produced.

- **It actually fires.** New sale matches the basket against every running promotion and offers the
  best one with the amount worked out; "Apply it" writes it onto the lines. A promotions screen that
  does not reach the sale screen is a list of intentions.
- **Only one applies — whichever gives the customer most.** Stacking overlapping offers is how a
  shop sells below cost by accident, and "the better of the two" is a rule a seller can explain at
  the counter.
- **Status is derived from the dates**, never stored. A stored status goes stale exactly when a
  finished promotion would otherwise keep discounting.
- **Paused is separate from the dates**, so pausing does not destroy the schedule someone set.
- **A fixed amount is capped at the value it covers.** A promotion must never turn a sale into a
  payment to the customer.
- **A percentage applies only to the lines it covers**, not to the whole basket — otherwise "15% off
  brakes" quietly discounts the oil filters too.
- **Scope is everything / categories / products, and takes several of each.** Brand was the third
  option first and was replaced at the client's request, then made multi-select: an offer is nearly
  always on a handful of related things, and making someone create four identical promotions to
  cover four categories is how a screen gets worked around instead of used.
  - Scoped to a **product, not a variation** — an offer on "Brake pad set X30" means the whole part,
    and nobody sets one up that covers the left side and not the right.
  - **An empty scope covers nothing**, not everything. An unfinished promotion must not silently
    discount the whole catalogue.
  - The control is a new shared `MultiSelect` (`shared/ui/MultiSelect.tsx`, built on our Popover per
    DESIGN_RULES § 11): a dropdown with a search box inside it. **Search is a way through the list,
    not a filter on the selection** — picks survive a changed search term, which is the classic way
    this control goes wrong. Chosen options pin to the top of the panel, so "what have I chosen"
    never needs a scroll.
  - **Each product row carries its picture, SKU and OEM number, and the search matches all three.**
    Parts are named alike — three "Timing belt" rows tell nobody anything — so a bare label list is
    unusable at this catalogue's size. A product with several variations says how many rather than
    picking one SKU arbitrarily. (`product.description` is where this codebase keeps the OEM
    number, as the reference tenant does.)
  - The rule reads as **names while there are one or two, then a count** — "4 products" beats four
    truncated labels.
- **The form works the rule through on an example sale.** Kind, value and scope are three abstract
  fields that cannot tell anyone whether they just wrote "15% off brakes" or "15 000 off
  everything", and the difference is a lot of money.

**Noticed while verifying, not fixed:** the seed assigns categories at random, so a product called
"Brake pad set" can sit in "Engine parts". The scope filter behaved correctly — it refused to apply
the Brakes promotion — but the seed reads as nonsense. Worth tidying when the vertical is confirmed.

## 8. Аналитика — Analytics

| OX (ru)              | Ours (en)        | OX route                                |
| -------------------- | ---------------- | --------------------------------------- |
| Генератор отчета     | Report generator | `/app/statistics/reports`               |
| Логи продуктов       | Product logs     | `/app/statistics/stock-count-histories` |
| Отчет онлайн-витрины | — (removed)      | `/app/statistics/utm-reports`           |
| Отчет по продажам    | — (removed)      | `/app/statistics/sell-reports`          |
| Отчёт по клиентам    | Customer report  | `/app/statistics/customer-reports`      |
| Отчёт по акциям      | — (removed)      | `/app/statistics/promotion-report`      |
| История звонков      | — (removed)      | `/app/statistics/call-history`          |

Three of the seven are cut, leaving four:

- **Online storefront report** reports on UTM tags — which advert a visitor arrived from — and that
  needs a customer-facing web shop to land on. We do not build one and sales are typed in by hand,
  so there is nothing to tag. OX's own version never finishes loading on the tenant.
- **Sales report** is the report generator with `source = sales`, and building it would be a second
  place for the same numbers to be wrong. What it had that the generator lacked was charts — so
  charts were added to the generator instead, and "Sales by month" is a saved report with a line
  chart pinned to the sidebar.
- **Call history** needs a phone system wired in. Integrations are out of scope, so it would show
  zero rows forever.
- **Promotions report** was built and then cut — see below.

### Report generator — «Генератор отчета», read from the live tenant

Route `/app/statistics/reports`. Read on 2026-09-08 with a read-only pass; nothing was created,
edited or deleted (the list still shows 1 of 1 afterwards).

**The list.** Columns: Название · Создатель · Кому доступно · «Добавить в меню». A ▶ run button on
each row, a filter/search box inline beside the title, and a primary «Добавить». So a report is a
**saved definition that is shared with people and can be pinned into the sidebar** — not a one-off
query.

**Opening a saved report is filter-gated.** The body reads «Выберите период и нажмите
"Отфильтровать"» with the sub-line «Отчёт не загружается автоматически — это нормально», beside a
period Select, a primary «Отфильтровать» and a pencil to edit the definition. This is the same
pattern CLAUDE.md already asks of us (`<FilterGate>`), independently arrived at — worth noting as
convergence rather than something to copy.

**The result is a pivot-style data grid** (AG Grid — its `ag-*` input ids are in the DOM), with a
Фильтры side panel, a page-size control and «Всего строк».

**«Добавить» offers two routes: «Из шаблонов» and «Произвольный отчет».**

_From templates_ — a drawer with the same five domain tabs (Все / Продукты / Продажа / Маркетинг /
Сотрудники) over **17 canned reports**: sales by receipt, average-check dynamics, marketing and
client-base growth, payment methods, repricing operations, stock corrections, seller performance,
transfers, postponed items, goods receipt, sales by supplier, stock by supplier, current stock,
product margin, stock movement, debt for goods, sales volume. Then default period, currency, and a
filter that stays disabled until a template is chosen («Сначала выберите шаблон»).

_Custom report_ — a **five-step wizard**: 1 Общая информация · 2 Колонки · 3 Сортировка и
группировка · 4 Диаграммы · 5 Завершение.

- **Step 1** picks the report type from the same five domains, a name (pre-filled with the last
  report's name plus a timestamp), a default period, and a **Тема** — four visual skins for the
  result grid. A help carousel about ABC analysis sits on the right.
- **Step 2** is the substance: **Функциональные колонки** (measures, grouped by the document that
  produces them — Вхд. перемещения, Коррекции, Исх. перемещения, Приход, Остаток, Переоценка, plus
  «+ Пользовательскую колонку») and **Информационные колонки** (attributes), each with its own
  search, and a live preview grid on the right.

**Two things did not work on the live tenant**, and both are usage signals of the kind already
recorded for stocktakes and selections:

- The one saved report, "Sales and stock", **fails with a 500** — «Возможно, колонки настроены
  неправильно».
- The custom wizard **crashes into an error boundary** moving from step 2 to step 3 with no columns
  chosen («Попробуйте: CTRL + SHIFT + R»).

So Fura has exactly one saved report and it does not run. That is the strongest argument for
building a smaller, sturdier version rather than reproducing the wizard.

#### What we built instead

**Four data sources, not seventeen templates.** Read closely, OX's seventeen are seventeen preset
column-combinations over a handful of datasets — so the datasets are the product and a template is
a starting point. Ours: **Sales** (every sale line), **Stock** (what is on the shelf now),
**Stock movement** (receipts, transfers, corrections and sales in one ledger) and **Money owed**
(clients and suppliers together). Six starter reports ship with them.

**Five of OX's seventeen are deliberately not repeated**, because they duplicate screens we already
have: seller performance is on Employees, current stock on Products, stock by supplier on Suppliers.
A report that restates a screen is a second place for the same number to be wrong.

**One builder screen, not five wizard steps.** OX's steps are name → columns → sort and group →
charts → finish. Sorting is a property of the table, charts are a separate question, and "finish"
is a button; what is left is one real choice — what to measure and what to split it by. So the
choice and a **live preview** sit on the same screen, because the only thing anybody wants to know
while building is what the answer looks like.

**The decisions worth keeping:**

- **Measures and dimensions are named in plain words** — "Measure" (what gets added up) and "Break
  down by" (what a row stands for). OX's «функциональные» and «информационные колонки» name the
  implementation, not the idea.
- **No dimensions is a valid report**, not an empty one: "what did we take last month" is a single
  grand-total row.
- **Ratios are never summed.** Margin % and average check are recomputed from each group's own
  totals — adding two 50% margins to make 100% is the classic way a report screen lies. The totals
  row recomputes them too.
- **The totals row says what it is the total of.** The builder previews five rows but totals all of
  them, so the footer reads "Total across all 166 rows" rather than an ambiguous "Total".
- **Changing the period un-runs the report.** Showing last month's numbers under this month's label
  is worse than showing nothing.
- **Changing the data source clears the columns**, since a column belongs to a source and keeping
  it would quietly produce a report full of blanks.
- **Pin to the sidebar** is kept from OX's «Добавить в меню» — a report someone runs every Monday
  should not need finding first.
- **Filter-gated**, as OX gates theirs and CLAUDE.md requires. `FilterGate` gained an optional
  title, because a gate that says "press Apply" beside a button marked "Run" is worse than no gate.

**Charts, added afterwards — and instead of a Sales report page.** OX's dropped wizard step earns
its place as one field on the builder, not five screens. The chart is picked in the builder (with
the live preview drawing it) and appears **above the table** on the report view: the shape first,
the numbers under it. A saved report called "Sales by month" with a line chart, pinned to the
sidebar, is then indistinguishable from a dedicated Sales report page — without a second place for
the same numbers to be wrong.

- **Only offered when the report has exactly one break-down column.** A chart needs one axis; with
  two dimensions there is no sensible simple chart, and with none there is a single number.
- **One series, never several.** A report's measures sit on different scales — money beside a unit
  count — and one axis through both draws a comparison that does not exist. The chart draws the
  chosen measure; the table carries the rest.
- **Top 12, and the tail is handled per chart type.** A donut must total the whole, so its tail
  becomes an "Other" slice. A bar chart is a comparison, and an "Other" bar summing 120 products
  towers over every real bar and destroys the comparison — so bars drop the tail and the caption
  says "top 12 of 132". A time axis is exempt from both: folding March into "Other" for being quiet
  would be nonsense.
- **Single-series charts use the gold slot**, which is what `chart.ts` reserves it for. An earlier
  draft used the blue categorical hue, against the palette file's own instruction.
- **Animation is off.** It delays a number somebody asked for by pressing Run, and it makes the
  chart unverifiable in a screenshot — which is how the first version's invisible line was found.

### Product logs — «Логи по продуктам», read from the live tenant

Route `/app/statistics/stock-count-histories` — the Russian label says "logs", the route says stock
count histories, and the route is the honest one.

**OX's columns:** Продукт (image + name + code) · Локация · Изменение (a coloured `−1` / `+3` with
the resulting balance beneath as `→ 1`) · Ресурс (a grey document icon) · Причина · Пользователь ·
Время. Filters: date from/to, barcode search, locations, resource type. An Excel export top-right.

Unlike most of this tenant, **it is densely used** — hundreds of rows of real movement. Two details
are worth stealing and two are worth fixing.

**Kept:** one row per stock change, newest first, and the **running balance under the delta** —
`−1 → 2` says more in six characters than a separate column would.

**Changed:**

- **The document is a link, not an icon.** OX renders a grey square you cannot read. The next
  question after "why did this number move" is always "show me", so ours prints the document number
  and clicks through to the receipt, transfer, correction or sale.
- **The Reason column carries a real reason.** Every row on OX says «Автоматическое обновление»,
  which is not a reason. Ours fills it only from documents that record one — corrections and
  stocktakes carry damaged / expired / theft / lost / found / miscount — and leaves it blank
  elsewhere, because for a sale or a receipt the document type _is_ the reason.

**Not a duplicate of the Stock movement report.** That one answers "how much moved"; this answers
"what happened to this part, in what order, and who did it". One is arithmetic over events, the
other is the events — collapsing them into one screen serves neither.

**The running balance is derived, not stored.** Nothing records what a shelf held on a past day,
so the opening balance is `stock today − everything that has happened since`, and the column is
filled by walking forward. It is exact, and it means the log and the product page can never
disagree — there is a test asserting the newest entry for every shelf equals that shelf's current
stock.

**Two bugs this surfaced, both fixed:**

- Entries sharing a timestamp to the millisecond (several lines of one document) were ordered
  differently for display than for the balance calculation, so the top row showed the wrong balance.
  Both orderings now break ties on id.
- The seed sold parts from shelves they had never been on, which left the balance unknowable. Sales
  now draw only from what that location stocks — and the log was right to refuse.

### Customer report — «Отчёт по клиентам», read from the live tenant

OX's is an **RFM screen** — recency, frequency, money — and it is one of the better things in that
product. Subtitle: «Кто ваши клиенты, сколько стоят, куда уходят и что с ними делать». Filter-gated
(«Отчёт большой и грузится не сразу»), then eight KPI tiles (client base, active in period, repeat
rate, average check, average LTV, at risk, cashback liability, receivables), a panel of ten named
RFM segments, an acquisition-channels panel, and a table: Клиент · Сегмент · R·F·M · LTV · Покупок ·
Ср. чек · Последняя покупка · Канал · Группы · Бонусы · Долг. It reads zero on the tenant, because
Fura does not attach clients to sales.

**Kept:** the RFM idea, the filter gate, the tiles, the segment panel, and the R·F·M column.

**Changed:**

- **Every segment carries what to do about it.** OX promises «что с ними делать» in its own subtitle
  and then shows a coloured label. A diagnosis with no prescription is half a screen, so each of the
  eight segments states the action — "ring them now, a competitor is the usual explanation".
- **Eight segments, not ten.** «Многообещающие» and «Засыпают» blur into their neighbours; a segment
  that does not imply a different action is a colour.
- **Acquisition channels dropped.** That is UTM again, and it needs a web shop. Our `channel` field
  says how a sale was _taken_, not how the customer was _found_, and labelling one as the other
  would be a lie.
- **Groups dropped** — that screen was cut from Marketing.

**The decisions worth keeping:**

- **Scores are quintiles against your own base**, never fixed thresholds. "Spends a lot" only means
  something relative to everyone else, and a threshold tuned for a wholesaler is nonsense for a
  corner shop.
- **Ties take the lowest rank of the group**, so two customers who spent exactly the same always
  score the same. Landing them in different segments cannot be explained to anybody.
- **The lapsing segments need an absolute recency guard, not just a rank.** The first version put
  four of eight customers in "Cannot lose" — every one of whom had bought that week. In a base where
  everybody bought recently, somebody still scores R=1. Ranking says who is _relatively_ quiet; only
  the calendar says who has actually gone away.
- **The default window is a year, not a quarter.** It has to be longer than the 90-day "gone quiet"
  threshold, or the people this report exists to find fall outside it: someone who stopped a hundred
  days ago has no purchases in the last ninety and arrives as "lost" with no history.

**Seed changes this forced**, all in the same class as the earlier ones:

- **8 clients became 40.** Eight clients sharing 420 sales made every score degenerate — everyone
  bought today, everyone tied on recency, and the segments collapsed into one.
- **Clients gained a buying profile**: a few regulars, a long tail of occasionals, and roughly a
  fifth who stopped buying at some point. Two of the regulars are deliberately among them, so the
  segments that matter most are not empty.
- **Sales history went from four months to ten**, biased hard towards recent days. A client who goes
  quiet has to have _established_ a pattern before stopping, and a 120-day ledger against a 90-day
  threshold left no room to build one.

**Known and accepted:** "At risk" reads zero, because every lapsed frequent buyer in this seed is
also a top-40% spender and so lands in "Cannot lose" first. The logic is right; forcing the segment
to fill would be seeding for the screenshot rather than for truth.

### Promotions report — «Отчёт по акциям» — removed

Built and then removed at the client's request: too much machinery for one
screen. What OX has is thirteen KPI tiles of which two — «Эффект» and Uplift % — are the answer,
plus a daily chart, three tabs and a twelve-column table. Ours reduced that to a verdict column
("paid for itself" / "cost more than it earned" / "nobody used it") over a before-and-after margin
comparison, and it worked — but the arithmetic behind an honest verdict is a lot to carry for a page
nobody had asked for. Its reasoning is in git at `53eac07`.

**What survives, and earns its keep:** sales carry `promotionId`, set when a seller applies an offer
on New sale. The sale detail page shows it as one line — "Promotion · Summer clearance" — which
answers "why is this discounted" without anybody working backwards from a percentage. That is the
cheap half of the idea; measuring campaign effectiveness was the expensive half.

## 12. Настройки — Settings, read from the live tenant

OX keeps Settings as **one page with nine tabs** at `/app/settings`; we surface them in the sidebar
instead, as this document has always said.

| OX (ru)       | OX route                  | Ours             |
| ------------- | ------------------------- | ---------------- |
| Основные      | `/app/settings/main`      | General          |
| Бренды        | `/app/settings/brands`    | Brands           |
| Оборудование  | `/app/settings/equipment` | — (removed)      |
| Локации       | `/app/settings/location`  | Locations        |
| Продажи       | `/app/settings/sells`     | — (removed)      |
| Продукты      | `/app/settings/products`  | Categories       |
| Клиенты       | `/app/settings/customers` | — (removed)      |
| Биллинг       | `/app/settings/billing`   | Billing          |
| Личные данные | `/app/settings/profile`   | Personal data    |
| Webhooks      | `/app/settings/webhooks`  | — (out of scope) |
| ИИ / MCP      | —                         | — (out of scope) |

**Three cut, and why:**

- **Оборудование** is a device list — ID, name, location, type, key — plus a visitor counter. It
  needs a POS and hardware, neither of which exists here. Empty on the tenant too.
- **Продажи** is four tabs: cash terminals (no POS), payment methods, a sales funnel and instalment
  plans. Our sale statuses _are_ the funnel and they live in code; the one real part — which payment
  methods a sale may use — folds into General rather than earning a page.
- **Клиенты** is a custom-field builder for the client card («дата рождения, размер, любимый
  аромат»). CLAUDE.md rules that out explicitly: attributes that matter are real typed fields.
  Same reasoning removes most of OX's Продукты tab — variation properties, product properties,
  receipt properties, a translation dictionary — leaving the one useful part, categories.

**What each of ours does:**

- **General** — company, then the exchange rate, then two rules with teeth. `usdRate` sits behind
  every landed cost in the product; **which statuses count as revenue** is OX's «Настройки расчёта
  выручки» and is the setting most likely to have two people quoting different revenue at each
  other, so the screen says so in as many words. Deleted sales never count whatever is ticked.
  **Currency, locale and time zone were built and then removed.** A currency picker that changes
  the symbol without converting anything already recorded is a trap rather than a setting, and
  `format.ts` reads its own constants regardless — so the control promised something it could not
  do. The right version of it is a decision about the target market (CLAUDE.md's open question),
  not a dropdown.
- **Brands** — with a product count per brand, and a refusal to delete one that is in use.
- **Locations** — the most load-bearing list here: stock is held per location and every document
  points at one. It shows what each location **holds**, in units and at cost, and the store refuses
  to delete a location with stock on it. Parts nowhere is worse than a spare row.
- **Categories** — two levels as an indented table rather than a collapsing tree: with six
  categories a tree is ceremony, and a table can still be sorted and counted.
- **Billing** — the only screen about the software rather than the business, kept because the
  balance already sits in the top bar and a number with no page behind it is a dead end. "Top up"
  is honest about being a hand-off; there is no payment processing anywhere in this build.
- **Personal data** — profile, and **notification preferences as (event × channel)**, which is the
  cross-cutting pattern CLAUDE.md asks for: ten business events down the side, four channels
  across, counted per module. Somebody wants low stock by Telegram and an overdue payment by email,
  and one master switch cannot express that.

**Worth recording about the tooling, not the product:** Radix tab triggers activate on `mousedown`,
not `click`, so a headless `.click()` silently does nothing. That cost a wrong diagnosis — the
shared `Tabs` component looked broken and was not.

Rendered in OX as tabs inside one page; we keep them as sidebar children.

| OX (ru)       | Ours (en)        |
| ------------- | ---------------- |
| Основные      | General          |
| Бренды        | Brands           |
| Оборудование  | Equipment        |
| Локации       | Locations        |
| Продажи       | Sales            |
| Продукты      | Products         |
| Клиенты       | Clients          |
| Биллинг       | Billing          |
| Личные данные | Personal data    |
| Webhooks      | _(not in scope)_ |
| ИИ / MCP      | _(not in scope)_ |

## What OX has that we deliberately do not

Cut from this build. Every one of these exists in OX; leaving them out is a decision, and this is
where it is recorded so nobody "fixes" it by adding them back:

- **Интеграции / Integrations** — the third-party connector marketplace.
- **Партнёрская программа / Partner program** — the affiliate mechanic.
- **Поддержка / Support**.
- **Settings → Webhooks**.
- **Settings → ИИ / MCP** — worth revisiting later as a differentiator, but not now.
- **Кассовые смены / Cash shifts.** A shift exists to reconcile a physical cash drawer against a
  register: a cashier opens one, rings sales into it, collects the cash and closes it. We have no
  POS and no drawer, so there is nothing to open or reconcile. The real question underneath —
  _how much cash do we hold_ — belongs to Finance (Accounts, Cashflow), not to a POS-shaped screen
  in Sales.
- **Закрытые продажи / Closed sales.** It is All sales with the Completed chip selected. A nav
  entry that duplicates a filter over the same rows earns its place only if it answers a different
  question, and this one does not — completed sales are most of the ledger.
- **The POS itself.** OX runs it as a separate app on another domain
  (`furasentr--ox-sys--com.oxpos.oxapp.io`, passed `userId`, `language`, `theme`, `subdomain`),
  embedded in the back office as a 375×700 draggable panel with minimise / maximise / close.
  Their sidebar "Новая продажа" does not open it — it navigates to `/app/sells/shifts`, because a
  sale needs an open shift. We build neither: sales are entered by hand on our New sale screen.

## What we had that OX does not

Dropped, because the whole point is that the two navigations match:

- **Categories** and **Stock levels** as separate Products entries — in OX both are reached from
  within the product list rather than the sidebar.
- **Notifications** as a separate Settings entry — in OX it sits inside _Основные_.

## What OX has in the top bar

For reference only — we deliberately keep our top bar to account chrome (DESIGN_RULES § 3.2):
a wallet balance, and a global search bound to `⌘K`.

---

## Dashboard — widget inventory

Captured from the live tenant. The tenant has no sales data, so every figure read zero; the widget
set and layout is what was copied, not the numbers.

### Main tab (Дашборд)

| OX widget                                                                    | Ours                            | Note                                                               |
| ---------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------ |
| Period chips: По умолчанию / Вчера / Сегодня / За неделю / За месяц / Другое | Period filter                   | Ours drives **every** widget; OX bakes the period into card titles |
| Оборот за сегодня                                                            | Revenue                         |                                                                    |
| Посетители за эту неделю                                                     | Visitors                        |                                                                    |
| Новые клиенты за неделю                                                      | New clients                     |                                                                    |
| Оборот по локациям (line chart)                                              | Revenue by location             |                                                                    |
| Кассовые смены                                                               | Cash shifts                     |                                                                    |
| Курс валют (paged, one at a time)                                            | Exchange rates                  | All rates shown at once; nothing to page through                   |
| История действий / Добро пожаловать                                          | **replaced** by Needs attention | See below                                                          |
| Per-widget `⋮` menus, `+` to add a dashboard tab                             | _(not built)_                   | OX dashboards are user-configurable                                |

### Seller tab (Дашборд продавца)

Not built as a separate tab. Its contents: turnover today, turnover this month, motivation total and
count, a motivation-by-day table, top sellers, and **top products** — which we promoted onto the
main dashboard.

### What we changed, and why

- **One period filter drives everything.** OX shows "Оборот за сегодня" beside "Посетители за эту
  неделю" — two periods in one row — while a global period control sits above them. The row cannot
  be read as a set. Ours restates the comparison basis on each card ("vs yesterday").
- **Added Sales, Average check, Gross margin.** OX's dashboard has no profitability figure at all.
  For a retail business margin is the second most important number after revenue.
- **Replaced the welcome banner with "Needs attention."** OX spends its best real estate — top
  right — on a gradient, the viewer's own name and a clock. Ours answers "what needs me today?":
  out of stock, below reorder point, overdue payables, sales left open. Every row links to the
  screen that clears it.
- **Promoted Top products** from the seller tab.

### Not built yet, deliberately

- **Configurable dashboards** — OX lets a user add tabs and remove widgets via the `⋮` menus. Worth
  revisiting once the widget set is settled; building it before then would freeze the wrong set.
- **The seller dashboard tab**, including the motivation widgets, which depend on Personnel →
  Seller motivation existing first.

---

## Sale record — field comparison

Captured from OX's All sales screen: its column-visibility panel, its filter panel and the summary
strip above the table. The tenant has no sales, so no populated row could be read; the _fields_ are
what was compared. OX creates sales in its POS, which we do not have, so the field set below is what
our New sale screen must carry instead.

| OX field                                           | Ours                       | Decision                                                                                                                                                                                                          |
| -------------------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ID Продажа                                         | `number`                   | kept                                                                                                                                                                                                              |
| Статус                                             | `status`                   | kept — **and we adopted OX's full status set**, see below                                                                                                                                                         |
| Клиент                                             | `clientId` / `clientName`  | kept                                                                                                                                                                                                              |
| Продавец                                           | `sellerName`               | kept                                                                                                                                                                                                              |
| Зоны                                               | `locationId`               | kept — "zone" is OX's word for what we call a location                                                                                                                                                            |
| Позиция продажи                                    | `lines`                    | kept                                                                                                                                                                                                              |
| Способ оплаты                                      | `paymentMethod`            | kept                                                                                                                                                                                                              |
| Сумма продаж                                       | `total`                    | kept                                                                                                                                                                                                              |
| Долг / Сумма долга                                 | `debt`                     | kept                                                                                                                                                                                                              |
| Продано шт.                                        | derived from `lines`       | kept, derived rather than stored                                                                                                                                                                                  |
| Интернет-магазин                                   | `channel`                  | **adapted.** OX has a boolean web-shop flag because its only origins are the POS and the web shop. With manual entry the useful distinction is who was in front of you: at the counter / by phone / online store. |
| Доставки, Сумма доставки                           | `delivery`, `deliveryCost` | **added.** A sale can require delivery, with an address, cost, planned date and courier. Delivery is charged on top of goods and is never discounted.                                                             |
| Время истечения                                    | `expiresAt`                | **added**, and only meaningful on a postponed sale — a reservation that never lapses is not a reservation.                                                                                                        |
| Обновлено в / Закончено в                          | `updatedAt` / `finishedAt` | **added.** `finishedAt` is null while the sale is still moving.                                                                                                                                                   |
| ID заказа (separate from sale id)                  | —                          | **dropped.** OX splits an _order_ (web/POS) from a _sale_. With one manual record there is nothing to split, and two ids for one thing is a reliable source of confusion.                                         |
| ID Возврат/Обмен, Возвраты, Обмены, Разница обмена | —                          | **dropped from the sale.** A return or an exchange is its own document that references a sale, not a field on it. Worth its own screen later; it is not part of creating a sale.                                  |
| Доп. статус                                        | —                          | **dropped.** A second, unexplained status alongside the first. If a real meaning turns up we will add a named field for it rather than a generic slot.                                                            |

### Status set — adopted from OX verbatim

`Открыто / Новые / Обработано / Доставляется / Доставлено / Завершён / Отложки / Удалено`
→ `open / new / processed / delivering / delivered / completed / postponed / deleted`

These are **not** POS leftovers, which is what we assumed before looking: they are an order-fulfilment
lifecycle, exactly what a counter that also takes phone orders needs. This also settles the earlier
open question about the Sales sub-pages — Open, Closed, Postponed and Deleted sales each map onto a
real status, so all four screens earn their place.

Completing a sale that requires delivery moves it to **processed**, not completed: goods that still
have to reach the customer are not a finished sale.

### Also worth taking, not yet built

OX shows a **summary strip** above the sales table for the filtered range — sales count, sales total,
units sold, returns, debts, deliveries, clients, sellers. That is a genuinely good idea and we should
add the subset that applies to us when the Sales lifecycle screens are built.

---

## All sales screen — what OX puts on it

Read off the live grid (AG Grid, scrolled horizontally to collect every virtualised column) and the
summary carousel. This is the screen's full surface, not just its table.

### Columns — all 26

Captured by scrolling AG Grid's centre viewport (its columns are virtualised, so only rendered ones
are in the DOM). Our session showed 23; three more — `Создано в`, `ID Кассовой смены`, `Подитог` —
appear in the tenant's own saved column config. The union below is the real set.

**Have it (16).**

| OX              | Ours          |
| --------------- | ------------- |
| ID Продажа      | Number        |
| Создано в       | Created       |
| Обновлено в     | Updated       |
| Закончено в     | Finished      |
| Время истечения | Expires       |
| Позиция продажи | Items         |
| Клиент          | Client        |
| Канал продаж    | Channel       |
| Метод платежа   | Payment       |
| Статус          | Status        |
| Сумма доставки  | Delivery      |
| Цена            | Total         |
| Время доставки  | Delivery date |
| Подитог         | Subtotal      |
| Скидка          | Discount      |
| Комментарий     | Comment       |

Plus two OX does not carry as columns: **Location** and **Debt**.

**Folded (2).**

| OX               | Where it went                                                                                               |
| ---------------- | ----------------------------------------------------------------------------------------------------------- |
| Интернет-магазин | A value of **Channel**. A web-shop boolean _is_ a channel; two fields for one fact drift apart.             |
| Продавцы         | **Seller**, singular. OX's plural implies several sellers splitting one sale — see the open question below. |

**Not built (8), and why.**

| OX                | Reason                                                                                                                                                                                       |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ID заказа         | OX splits a web/POS _order_ from the _sale_ it becomes. We have one manual record, so this column would repeat the sale number or sit empty on every row.                                    |
| ID Возврат/Обмен  | We have no returns or exchanges. A return is its own document referencing a sale — a feature to plan, not a column to add.                                                                   |
| ID Кассовой смены | No cash shifts, because no POS: nothing opens or closes a drawer to belong to.                                                                                                               |
| Кассовый терминал | Same — no POS terminals exist to record.                                                                                                                                                     |
| Доп. статус       | A second, unexplained status beside the first. If a real meaning turns up it earns a named field, not a generic slot.                                                                        |
| Менеджеры         | A manager overseeing a sale, distinct from the seller who rang it. We model one person per sale. Real for wholesale — see open questions.                                                    |
| Тариф доставки    | **Decided: not building it.** Delivery is a flat price entered on the sale. A rate plan by zone or weight would need a tariff catalogue behind it, and the business does not price that way. |
| Фискализованный   | Whether the receipt was registered with the tax authority. **This is the one that matters** — see open questions.                                                                            |

The four we already stored but never showed — Subtotal, Discount, Comment, Delivery date — are now
columns, hidden by default like the other rarely-needed ones.

### Why Open, Postponed and Deleted stayed

They are not "All sales plus a chip":

- **Open sales** is a work queue — sales someone began and abandoned, waiting to be finished.
- **Postponed sales** is a queue with a deadline: reservations lapse, and somebody has to chase
  them before they do.
- **Deleted sales** shows rows that are **excluded from All sales and from its totals**. That
  exclusion is the point: a cancelled sale must not keep counting toward revenue. Without a screen
  of its own, deleted sales would be unreachable.

### Open questions this raised

1. **Фискализация.** In Uzbekistan a retail sale must be registered with the tax authority (ОФД).
   OX tracks it per sale. That is not a column we can bolt on — it is an integration and a legal
   requirement, and if Fura sells retail we need to know whether it applies.
2. **Managers vs sellers.** OX carries both, separately. Does a sale need an owning manager as well
   as the person who entered it?
3. **Several sellers on one sale.** OX's column is plural, and Personnel has "Мотивация продавцов"
   (seller motivation) — commission split across sellers is the obvious reason. Does that apply?
4. ~~Delivery tariffs~~ — **settled: a flat price per sale, no tariffs.**

### Summary strip

| OX card                              | Ours                                                    |
| ------------------------------------ | ------------------------------------------------------- |
| Продажи / Сумма продаж / Продано шт. | **Sales** — total, with count and items beneath         |
| Долги / Сумма долга                  | **Debt** — total outstanding, with unpaid count         |
| Доставки / Сумма доставки            | **Delivery** — total, with count still to deliver       |
| Клиенты / Продавцы                   | **People** — distinct clients / sellers                 |
| Возвраты / Сумма возврата            | _(not built — we have no returns concept)_              |
| Обмены / Разница обмена              | _(not built — we have no exchanges concept)_            |
| Дата и время от / до                 | replaced by our own date-range picker in the filter row |

The strip answers **the same filters as the table**, so the figures always describe exactly the
rows on screen. A summary describing a different set than the table under it is worse than none.

### Filters

- **Status chips** — All plus the eight statuses, single-select, written to the URL.
- **Date range** — OX embeds from/to date-time fields in a card; we use our own range picker.
- **Search** — in the table toolbar, over number, client, location and seller.
- **Export** — OX has a download icon top-right; ours exports the current filtered rows to CSV
  (RFC 4180 quoting, UTF-8 BOM so Excel opens Cyrillic correctly).

Not built: OX's row-selection checkboxes. A checkbox column with no bulk action behind it is
decoration; it should arrive with the actions that need it.

---

## Product list — all 31 columns

Captured from `/app/products/management`, which redirects to a **variations** view. Read with real
data (4,989 active products), which mattered: several columns only make sense once you see a row.

**Have it (20).**

| OX                         | Ours                                                               |
| -------------------------- | ------------------------------------------------------------------ |
| Рисунок                    | Image (inside the name cell, not its own column)                   |
| Артикул                    | SKU                                                                |
| Названия вариации          | Name                                                               |
| Штрих-код                  | Barcode                                                            |
| Описание                   | OEM / description — the reference tenant keeps the OEM number here |
| Категории                  | Category, with the full path in a tooltip                          |
| Бренд                      | Brand                                                              |
| Теги                       | Tags                                                               |
| MOQ                        | MOQ                                                                |
| Локация                    | Locations — count, with the per-location split in a tooltip        |
| Кол-во                     | Stock                                                              |
| Цена продажи за ед.        | Price                                                              |
| Общая сумма продажи        | Stock at sale                                                      |
| Со скидкой                 | Discounted                                                         |
| Цена поставщика за ед.     | Cost — **with its currency**                                       |
| Общая сумма поставщ.       | Stock at cost                                                      |
| Марка                      | Make                                                               |
| Модель                     | Model                                                              |
| Часть                      | Side (left / right / universal)                                    |
| Вес карго, Размер карго    | Weight, Size                                                       |
| Отгружаемый                | Shippable                                                          |
| Показать в онлайн-магазине | Online                                                             |
| Адрес товара               | Shelf                                                              |

Plus **Margin**, which OX does not show, and **Status**.

**Not built (5), and why.**

| OX                                 | Reason                                                                                                                                                                                                                                            |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ID Вариации                        | We have no variations — see below. Our identifier is the SKU.                                                                                                                                                                                     |
| С этим вместе покупают             | "Frequently bought together" — a recommendation engine, not a field.                                                                                                                                                                              |
| Категория конечное, Бренд товара   | A second category and a second brand alongside the first. In the data one row reads _Бренд = AKCHAEV INC_ (the importer) and _Бренд товара = Space_ (the manufacturer) — two real but different ideas that need naming properly, not duplicating. |
| Артикул моб, Название продукта моб | A separate SKU and name "for mobile". A record should not carry two names; if the mobile app needs a shorter one, that is a display rule.                                                                                                         |
| Скидка                             | A discount _amount_ beside the discounted price. We store the discounted price and derive the rest.                                                                                                                                               |

### What reading the real data changed

- **Cost is quoted in USD, sale price in UZS.** One row: supplier price **85 USD**, sale price
  **1 476 000 UZS**. That is how an importer works, so `costPrice` now carries `costCurrency`, and
  margin converts before comparing. Assuming a single currency would have been silently wrong on
  every margin in the product.
- **Vehicle fitment is the catalogue's spine.** _Марка = DAF_, _Модель = XF 105, XF 95_,
  _Часть = L (Левый)_. For truck parts this is how anything is found. OX carries it as
  tenant-defined columns; we model it properly as `vehicleMake`, `vehicleModels`, `partSide`.
- **Categories are hierarchical** — "Подножки и части > Подножки и части DAF 105-95".
- **Stock is per location**, not one number.

### Summary strip

OX: Активные · Архивированные · Итого кол-во · Сумма продажной цены · Сумма цены поставщика ·
С нулевым остатком · Артикулы с изображением.

Ours condenses those into four tiles: **In stock** (quantity, active/archived), **Stock value**
(at sale, at cost, and the margin between them), **Out of stock**, **With a photo**.

### Two architectural questions — both now settled

1. **Variations: yes, built.** The sellable unit is a _variation_, not a product. A product says
   what a part is — name, OEM, category, brand, which vehicle it fits, cargo dimensions. A variation
   carries everything that can differ between variants of that part: its own SKU, barcode, cost and
   currency, price, stock per location, shelf address, MOQ, image, status. The reference data shows
   exactly why: one row reads _Названия вариации = "DAF XF 105 Подножка основа крыло L"_ against
   _Название продукта = "DAF XF 105 Подножка основа крыло"_ — the same part, left and right.

   The catalogue lists variations by default and offers a **by-product** view, mirroring OX's
   "Вид по вариаций" toggle. The parent view aggregates rather than pretending a product has one
   price: a variation count, total stock, and a price **range**.

   Sale lines point at a `variationId`, keeping `productId` for reporting.

2. **Custom fields: no, and not planned.** The attributes that matter for truck parts — vehicle
   make, models, part side — are modelled as real, typed fields. A generic field builder is not
   being built; if a new attribute is needed it gets a real column.
