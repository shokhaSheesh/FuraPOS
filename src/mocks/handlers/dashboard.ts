import { http, HttpResponse } from 'msw'
import { api } from './api'
import { locations, products } from '../seed'

/**
 * Mirrors the OX dashboard (docs/OX-NAVIGATION-MAP.md), plus the metrics we
 * added — see the Dashboard section of CLAUDE.md. Every figure responds to the
 * period filter, which is the main behavioural difference from OX, where the
 * KPI cards have periods baked into their titles.
 */
export type DashboardPeriod = 'today' | 'yesterday' | 'week' | 'month'

export interface Metric {
  value: number
  /** Change vs the comparison period, as a ratio. Null when there is no basis. */
  change: number | null
}

export interface DashboardSummary {
  period: DashboardPeriod
  /** What the change is measured against, e.g. "yesterday". */
  comparedTo: string
  revenue: Metric
  salesCount: Metric
  averageCheck: Metric
  grossMargin: Metric
  visitors: Metric
  newClients: Metric
  /** One entry per day, with a value per location id. */
  revenueByLocation: { date: string; [locationId: string]: number | string }[]
  locations: { id: string; name: string }[]
  cashShifts: {
    id: string
    terminal: string
    locationName: string
    total: number
    openedAt: string
    status: 'open' | 'closed'
  }[]
  currencyRates: { code: string; base: string; rate: number; changedAt: string }[]
  topProducts: { id: string; name: string; quantity: number; revenue: number }[]
  attention: {
    outOfStock: number
    lowStock: number
    overduePayables: number
    draftSales: number
  }
}

const DAYS: Record<DashboardPeriod, number> = { today: 1, yesterday: 1, week: 7, month: 30 }
const COMPARED: Record<DashboardPeriod, string> = {
  today: 'yesterday',
  yesterday: 'the day before',
  week: 'the previous week',
  month: 'the previous month',
}

/** Seeded so the dashboard does not reshuffle on every render. */
function pseudo(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

export const dashboardHandlers = [
  http.get(api('/dashboard/summary'), ({ request }) => {
    const url = new URL(request.url)
    const period = (url.searchParams.get('period') ?? 'today') as DashboardPeriod
    const days = DAYS[period] ?? 1
    const random = pseudo(days * 7919)

    const revenueByLocation = Array.from({ length: days === 1 ? 7 : days }, (_, index) => {
      const date = new Date(Date.now() - (days === 1 ? 6 - index : days - 1 - index) * 86_400_000)
      const row: { date: string; [k: string]: number | string } = {
        date: date.toISOString().slice(0, 10),
      }
      for (const location of locations) {
        row[location.id] = Math.round(2_000_000 + random() * 6_000_000)
      }
      return row
    })

    const revenue = revenueByLocation.reduce(
      (sum, row) =>
        sum + locations.reduce((inner, location) => inner + (row[location.id] as number), 0),
      0,
    )
    const salesCount = Math.round(revenue / 78_400)

    const lowStock = products.filter(
      (p) => p.lowStockThreshold !== null && p.stock > 0 && p.stock <= p.lowStockThreshold,
    ).length

    const summary: DashboardSummary = {
      period,
      comparedTo: COMPARED[period] ?? 'the previous period',
      revenue: { value: revenue, change: 0.084 },
      salesCount: { value: salesCount, change: -0.021 },
      averageCheck: { value: Math.round(revenue / Math.max(salesCount, 1)), change: 0.106 },
      grossMargin: { value: 0.317, change: 0.012 },
      visitors: { value: Math.round(salesCount * 3.4), change: 0.045 },
      newClients: { value: Math.round(salesCount * 0.12), change: 0.19 },
      revenueByLocation,
      locations: locations.map((l) => ({ id: l.id, name: l.name })),
      cashShifts: [
        {
          id: 'shift-1',
          terminal: 'Kassa 1',
          locationName: 'Shop — Chilonzor',
          total: 4_180_000,
          openedAt: new Date(Date.now() - 5 * 3_600_000).toISOString(),
          status: 'open',
        },
        {
          id: 'shift-2',
          terminal: 'Kassa 2',
          locationName: 'Shop — Yunusobod',
          total: 2_640_000,
          openedAt: new Date(Date.now() - 3 * 3_600_000).toISOString(),
          status: 'open',
        },
        {
          id: 'shift-3',
          terminal: 'Kassa 1',
          locationName: 'Central warehouse',
          total: 0,
          openedAt: new Date(Date.now() - 26 * 3_600_000).toISOString(),
          status: 'closed',
        },
      ],
      currencyRates: [
        { code: 'USD', base: 'UZS', rate: 12_225, changedAt: new Date().toISOString() },
        { code: 'EUR', base: 'UZS', rate: 13_410, changedAt: new Date().toISOString() },
        { code: 'RUB', base: 'UZS', rate: 134.2, changedAt: new Date().toISOString() },
      ],
      topProducts: products.slice(0, 6).map((product, index) => {
        const quantity = 60 - index * 7
        return {
          id: product.id,
          name: product.name,
          quantity,
          revenue: product.salePrice * quantity,
        }
      }),
      attention: {
        outOfStock: products.filter((p) => p.stock === 0).length,
        lowStock,
        overduePayables: 3,
        draftSales: 5,
      },
    }

    return HttpResponse.json(summary)
  }),
]
