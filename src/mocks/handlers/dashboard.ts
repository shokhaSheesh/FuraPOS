import { http, HttpResponse } from 'msw'
import { api } from './api'
import { locations, variations } from '../seed'

/**
 * Mirrors the OX dashboard (docs/OX-NAVIGATION-MAP.md), plus the metrics we
 * added — see the Dashboard section of CLAUDE.md. Every figure responds to the
 * period filter, which is the main behavioural difference from OX, where the
 * KPI cards have periods baked into their titles.
 */
export type DashboardPeriod = 'today' | 'yesterday' | 'week' | 'month' | 'custom'

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
  currencyRates: { code: string; base: string; rate: number; changedAt: string }[]
  topProducts: { id: string; name: string; quantity: number; revenue: number }[]
  attention: {
    outOfStock: number
    lowStock: number
    overduePayables: number
    draftSales: number
  }
}

const DAYS: Record<DashboardPeriod, number> = {
  today: 1,
  yesterday: 1,
  week: 7,
  month: 30,
  custom: 0,
}
const COMPARED: Record<DashboardPeriod, string> = {
  today: 'yesterday',
  yesterday: 'the day before',
  week: 'the previous week',
  month: 'the previous month',
  custom: 'the preceding period',
}

const DAY_MS = 86_400_000

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
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')

    // A custom window is measured in days between the two dates, inclusive.
    const days =
      period === 'custom' && from && to
        ? Math.max(1, Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS) + 1)
        : (DAYS[period] ?? 1)
    const random = pseudo(days * 7919)

    const revenueByLocation = Array.from({ length: days === 1 ? 7 : days }, (_, index) => {
      const date =
        period === 'custom' && from
          ? new Date(Date.parse(from) + index * DAY_MS)
          : new Date(Date.now() - (days === 1 ? 6 - index : days - 1 - index) * DAY_MS)
      const row: { date: string; [k: string]: number | string } = {
        date: date.toISOString().slice(0, 10),
      }
      for (const [order, location] of locations.entries()) {
        const base = 3_200_000 + order * 900_000
        // Saturday and Sunday run hot; Monday is the trough.
        const weekday = date.getDay()
        const rhythm = [0.82, 0.94, 0.98, 1.0, 1.12, 1.28, 1.18][weekday] ?? 1
        const trend = 1 + index * 0.004
        const noise = 0.92 + random() * 0.16
        row[location.id] = Math.round(base * rhythm * trend * noise)
      }
      return row
    })

    const revenue = revenueByLocation.reduce(
      (sum, row) =>
        sum + locations.reduce((inner, location) => inner + (row[location.id] as number), 0),
      0,
    )
    const salesCount = Math.round(revenue / 78_400)

    const lowStock = variations.filter(
      (v) => v.lowStockThreshold !== null && v.stock > 0 && v.stock <= v.lowStockThreshold,
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
      currencyRates: [
        { code: 'USD', base: 'UZS', rate: 12_225, changedAt: new Date().toISOString() },
        { code: 'EUR', base: 'UZS', rate: 13_410, changedAt: new Date().toISOString() },
        { code: 'RUB', base: 'UZS', rate: 134.2, changedAt: new Date().toISOString() },
      ],
      topProducts: variations.slice(0, 6).map((v, index) => {
        const quantity = 60 - index * 7
        return { id: v.id, name: v.fullName, quantity, revenue: v.salePrice * quantity }
      }),
      attention: {
        outOfStock: variations.filter((v) => v.stock === 0).length,
        lowStock,
        overduePayables: 3,
        draftSales: 5,
      },
    }

    return HttpResponse.json(summary)
  }),
]
