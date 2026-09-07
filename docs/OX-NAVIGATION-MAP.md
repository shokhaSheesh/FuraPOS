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

## 4. Закупки — Procurement

| OX (ru)            | Ours (en)          | OX route                     |
| ------------------ | ------------------ | ---------------------------- |
| Подбор товаров     | Product selection  | `/app/procurement/selection` |
| Заказы             | Orders             | `/app/procurement/orders`    |
| Расписание подбора | Selection schedule | `/app/procurement/schedules` |

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
