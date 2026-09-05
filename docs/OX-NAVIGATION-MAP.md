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

| # | OX (ru) | Ours (en) | OX route |
| --- | --- | --- | --- |
| 1 | Дашборд | Dashboard | `/app/dashboard` |
| 2 | Продажи | Sales | — |
| 3 | Продукты/Услуги | Products / Services | — |
| 4 | Закупки `New` | Procurement `New` | — |
| 5 | Управление персоналом | Personnel management | — |
| 6 | Финансы `beta` | Finance `beta` | `/app/finance` |
| 7 | Маркетинг | Marketing | — |
| 8 | Аналитика | Analytics | — |
| 9 | Интеграции | *(not in scope)* | `/app/integration` |
| 10 | Мои загрузки | My uploads | `/app/exports` |
| 11 | Партнёрская программа | *(not in scope)* | `/app/partner-program` |
| 12 | Настройки | Settings | `/app/settings` |
| 13 | Поддержка | *(not in scope)* | — |

## 2. Продажи — Sales

| OX (ru) | Ours (en) | OX route |
| --- | --- | --- |
| OX POS Касса | POS terminal | `/app/sells/cashdesk-info` |
| Новая продажа | New sale | *(no route — launches the POS app)* |
| Все продажи | All sales | `/app/sells/orders` |
| Кассовые смены | Cash shifts | `/app/sells/shifts` |
| Закрытые продажи | Closed sales | `/app/sells/closed` |
| Открытые продажи | Open sales | `/app/sells/drafts` |
| Удалённые продажи | Deleted sales | `/app/sells/deleted` |
| Отложки | Postponed sales | `/app/sells/postpones` |

## 3. Продукты/Услуги — Products / Services

Note: **Suppliers lives here in OX, not under Procurement.** We follow OX.

| OX (ru) | Ours (en) | OX route |
| --- | --- | --- |
| Список продуктов | Product list | `/app/products/management` |
| Перемещение продуктов | Transfers | `/app/products/transfers` |
| Коррекции | Corrections | `/app/products/corrections` |
| Инвентаризация | Stocktaking | `/app/products/reviews` |
| Приход | Goods receipt | `/app/products/imports` |
| Переоценка | Repricing | `/app/products/reprices` |
| Шаблоны для печати | Print templates | `/app/products/stickers` |
| Поставщики | Suppliers | `/app/products/suppliers` |

## 4. Закупки — Procurement

| OX (ru) | Ours (en) | OX route |
| --- | --- | --- |
| Подбор товаров | Product selection | `/app/procurement/selection` |
| Заказы | Orders | `/app/procurement/orders` |
| Расписание подбора | Selection schedule | `/app/procurement/schedules` |

## 5. Управление персоналом — Personnel management

| OX (ru) | Ours (en) | OX route |
| --- | --- | --- |
| Сотрудники | Employees | `/app/personal-management/users` |
| Мотивация продавцов | Seller motivation | `/app/personal-management/motivations` |
| Планирование | Planning | `/app/personal-management/list/target` |
| Доступы и роли | Access & roles | `/app/personal-management/roles` |

## 6. Финансы — Finance

In OX this is a single sidebar entry that opens a **second** left-hand menu inside the module. We
surface the same pages directly in the one sidebar, keeping OX's three groups as headings.

| Group | OX (ru) | Ours (en) | OX menu key |
| --- | --- | --- | --- |
| — | Дашборд | Dashboard | `finance-dashboard` |
| — | Транзакции | Transactions | `finance-transactions` |
| — | Договора | Contracts | `finance-contracts` |
| — | Счет-фактуры | Invoices | `finance-invoices` |
| — | Бюджет | Budget | `finance-budget` |
| — | Сценарии | Scenarios | `finance-scenarios` |
| ОТЧЕТЫ / Reports | P&L | P&L | `finance-reports-pl` |
| Reports | Cashflow | Cashflow | `finance-reports-cashflow` |
| Reports | Дебиторка | Receivables | `finance-reports-receivables` |
| Reports | Кредиторка | Payables | `finance-reports-payables` |
| Reports | Прогноз денег | Cash forecast | `finance-reports-forecast` |
| Reports | Расчеты по сотрудникам | Employee settlements | `finance-reports-employee-settlements` |
| НАСТРОЙКИ / Setup | Счета | Accounts | `finance-accounts` |
| Setup | Статьи | Categories | `finance-categories` |
| Setup | Закрытие периода | Period lock | `finance-period-lock` |
| Setup | Налоги | Taxes | `finance-taxes` |

## 7. Маркетинг — Marketing

| OX (ru) | Ours (en) | OX route |
| --- | --- | --- |
| Клиенты | Clients | `/app/marketing/customers` |
| Группы | Groups | `/app/marketing/groups` |
| Кешбэк | Cashback | `/app/marketing/cashbacks` |
| СМС Рассылка | SMS campaigns | `/app/marketing/newsletters` |
| Цифровая рассылка | Digital campaigns | `/app/marketing/digital-mass-messaging` |
| Акции | Promotions | `/app/marketing/promotions` |
| Купоны | Coupons | `/app/marketing/coupon-collections` |

## 8. Аналитика — Analytics

| OX (ru) | Ours (en) | OX route |
| --- | --- | --- |
| Генератор отчета | Report generator | `/app/statistics/reports` |
| Логи продуктов | Product logs | `/app/statistics/stock-count-histories` |
| Отчет онлайн-витрины | Online storefront report | `/app/statistics/utm-reports` |
| Отчет по продажам | Sales report | `/app/statistics/sell-reports` |
| Отчёт по клиентам | Customer report | `/app/statistics/customer-reports` |
| Отчёт по акциям | Promotions report | `/app/statistics/promotion-report` |
| История звонков | Call history | `/app/statistics/call-history` |

## 12. Настройки — Settings

Rendered in OX as tabs inside one page; we keep them as sidebar children.

| OX (ru) | Ours (en) |
| --- | --- |
| Основные | General |
| Бренды | Brands |
| Оборудование | Equipment |
| Локации | Locations |
| Продажи | Sales |
| Продукты | Products |
| Клиенты | Clients |
| Биллинг | Billing |
| Личные данные | Personal data |
| Webhooks | *(not in scope)* |
| ИИ / MCP | *(not in scope)* |

## What OX has that we deliberately do not

Cut from this build. Every one of these exists in OX; leaving them out is a decision, and this is
where it is recorded so nobody "fixes" it by adding them back:

- **Интеграции / Integrations** — the third-party connector marketplace.
- **Партнёрская программа / Partner program** — the affiliate mechanic.
- **Поддержка / Support**.
- **Settings → Webhooks**.
- **Settings → ИИ / MCP** — worth revisiting later as a differentiator, but not now.

## What we had that OX does not

Dropped, because the whole point is that the two navigations match:

- **Categories** and **Stock levels** as separate Products entries — in OX both are reached from
  within the product list rather than the sidebar.
- **Notifications** as a separate Settings entry — in OX it sits inside *Основные*.

## What OX has in the top bar

For reference only — we deliberately keep our top bar to account chrome (DESIGN_RULES § 3.2):
a wallet balance, and a global search bound to `⌘K`.
