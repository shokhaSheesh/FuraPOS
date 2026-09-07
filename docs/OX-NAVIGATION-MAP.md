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

| OX (ru)            | Ours (en)          | OX route                     |
| ------------------ | ------------------ | ---------------------------- |
| Подбор товаров     | Product selection  | `/app/procurement/selection` |
| Заказы             | Orders             | `/app/procurement/orders`    |
| Расписание подбора | Selection schedule | `/app/procurement/schedules` |

### Product selection

**The only screen in the app that forecasts rather than records**, and the payoff for the whole
inventory module: sales say how fast a part leaves, stock says what is left, receipts say who sells
it, and the supplier's MOQ says what a realistic order looks like. None of those alone answers
"what should I buy on Monday".

Built before OX's Подбор товаров was seen.

**Urgency is measured in time, not quantity.** Ten units is comfortable for something that sells one
a month and an emergency for something that sells one a day, so every state is relative to the lead
time: `out` → `critical` (runs out before a delivery could land) → `soon` → `ok`. `idle` is its own
state, because an empty shelf of something nobody buys is not an emergency and flagging it would
bury the parts that matter.

**The three assumptions are on the screen, not in a settings page.** Lead time, cover and the history
window are what every suggestion rests on — change the lead time and the whole list changes — and a
buyer who cannot see them cannot trust the answer.

**The suggested quantity is rounded up to a whole MOQ**, and says so when it has been: "5 needed ·
MOQ 2 → 6". A suggestion nobody can place is not a suggestion.

Nothing is stored. A suggestion is only true for as long as the stock and sales behind it are, so it
is recomputed on read and exported when someone wants to act on it. **Creating a purchase order from
a selection is deliberately not wired yet** — Orders is the next screen, and the hand-off should be
built once that document exists rather than guessed at.

**Seed note:** this screen exposed that 18 sales across 185 variations gave almost nothing a sales
rate, so it reported "nothing needs ordering" about a catalogue that plainly did. The sales seed is
now 420 orders over four months with a long tail, because seed data has to exercise the features it
is seeding for.

## 5. Управление персоналом — Personnel management

| OX (ru)             | Ours (en)         | OX route                               |
| ------------------- | ----------------- | -------------------------------------- |
| Сотрудники          | Employees         | `/app/personal-management/users`       |
| Мотивация продавцов | Seller motivation | `/app/personal-management/motivations` |
| Планирование        | Planning          | `/app/personal-management/list/target` |
| Доступы и роли      | Access & roles    | `/app/personal-management/roles`       |

## 6. Финансы — Finance

In OX this is a single sidebar entry that opens a **second** left-hand menu inside the module. We
surface the same pages directly in the one sidebar, keeping OX's three groups as headings.

| Group             | OX (ru)                | Ours (en)            | OX menu key                            |
| ----------------- | ---------------------- | -------------------- | -------------------------------------- |
| —                 | Дашборд                | Dashboard            | `finance-dashboard`                    |
| —                 | Транзакции             | Transactions         | `finance-transactions`                 |
| —                 | Договора               | Contracts            | `finance-contracts`                    |
| —                 | Счет-фактуры           | Invoices             | `finance-invoices`                     |
| —                 | Бюджет                 | Budget               | `finance-budget`                       |
| —                 | Сценарии               | Scenarios            | `finance-scenarios`                    |
| ОТЧЕТЫ / Reports  | P&L                    | P&L                  | `finance-reports-pl`                   |
| Reports           | Cashflow               | Cashflow             | `finance-reports-cashflow`             |
| Reports           | Дебиторка              | Receivables          | `finance-reports-receivables`          |
| Reports           | Кредиторка             | Payables             | `finance-reports-payables`             |
| Reports           | Прогноз денег          | Cash forecast        | `finance-reports-forecast`             |
| Reports           | Расчеты по сотрудникам | Employee settlements | `finance-reports-employee-settlements` |
| НАСТРОЙКИ / Setup | Счета                  | Accounts             | `finance-accounts`                     |
| Setup             | Статьи                 | Categories           | `finance-categories`                   |
| Setup             | Закрытие периода       | Period lock          | `finance-period-lock`                  |
| Setup             | Налоги                 | Taxes                | `finance-taxes`                        |

## 7. Маркетинг — Marketing

| OX (ru)           | Ours (en)         | OX route                                |
| ----------------- | ----------------- | --------------------------------------- |
| Клиенты           | Clients           | `/app/marketing/customers`              |
| Группы            | Groups            | `/app/marketing/groups`                 |
| Кешбэк            | Cashback          | `/app/marketing/cashbacks`              |
| СМС Рассылка      | SMS campaigns     | `/app/marketing/newsletters`            |
| Цифровая рассылка | Digital campaigns | `/app/marketing/digital-mass-messaging` |
| Акции             | Promotions        | `/app/marketing/promotions`             |
| Купоны            | Coupons           | `/app/marketing/coupon-collections`     |

## 8. Аналитика — Analytics

| OX (ru)              | Ours (en)                | OX route                                |
| -------------------- | ------------------------ | --------------------------------------- |
| Генератор отчета     | Report generator         | `/app/statistics/reports`               |
| Логи продуктов       | Product logs             | `/app/statistics/stock-count-histories` |
| Отчет онлайн-витрины | Online storefront report | `/app/statistics/utm-reports`           |
| Отчет по продажам    | Sales report             | `/app/statistics/sell-reports`          |
| Отчёт по клиентам    | Customer report          | `/app/statistics/customer-reports`      |
| Отчёт по акциям      | Promotions report        | `/app/statistics/promotion-report`      |
| История звонков      | Call history             | `/app/statistics/call-history`          |

## 12. Настройки — Settings

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
