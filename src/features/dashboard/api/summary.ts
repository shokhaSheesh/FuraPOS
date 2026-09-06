import { useMemo } from 'react'
import { useDataStore } from '@/data/store'
import type { DateRange } from '@/shared/ui/DateRangePicker'

export type DashboardPeriod = 'today' | 'yesterday' | 'week' | 'month' | 'custom'

export interface Metric {
  value: number
  change: number | null
}

const DAYS: Record<Exclude<DashboardPeriod, 'custom'>, number> = {
  today: 1,
  yesterday: 1,
  week: 7,
  month: 30,
}
const COMPARED: Record<DashboardPeriod, string> = {
  today: 'yesterday',
  yesterday: 'the day before',
  week: 'the previous week',
  month: 'the previous month',
  custom: 'the preceding period',
}
const DAY_MS = 86_400_000

/** Seeded, so the dashboard does not reshuffle on every render. */
function pseudo(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

/**
 * Computed from the in-memory store. Revenue is illustrative — the seed has no
 * per-day sales history — but everything on the "needs attention" list is real,
 * read from the same products and sales the other screens show.
 */
export function useDashboardSummary(period: DashboardPeriod, range?: DateRange) {
  const variations = useDataStore((s) => s.variations)
  const sales = useDataStore((s) => s.sales)
  const locations = useDataStore((s) => s.locations)

  const data = useMemo(() => {
    const days =
      period === 'custom' && range?.from && range?.to
        ? Math.max(1, Math.round((+range.to - +range.from) / DAY_MS) + 1)
        : (DAYS[period as Exclude<DashboardPeriod, 'custom'>] ?? 1)
    const random = pseudo(days * 7919)

    const revenueByLocation = Array.from({ length: days === 1 ? 7 : days }, (_, index) => {
      const date =
        period === 'custom' && range?.from
          ? new Date(+range.from + index * DAY_MS)
          : new Date(Date.now() - (days === 1 ? 6 - index : days - 1 - index) * DAY_MS)
      const row: { date: string; [k: string]: number | string } = {
        date: date.toISOString().slice(0, 10),
      }
      for (const [order, location] of locations.entries()) {
        const base = 3_200_000 + order * 900_000
        const rhythm = [0.82, 0.94, 0.98, 1, 1.12, 1.28, 1.18][date.getDay()] ?? 1
        row[location.id] = Math.round(base * rhythm * (1 + index * 0.004) * (0.92 + random() * 0.16))
      }
      return row
    })

    const revenue = revenueByLocation.reduce(
      (sum, row) => sum + locations.reduce((inner, l) => inner + (row[l.id] as number), 0),
      0,
    )
    const salesCount = Math.round(revenue / 78_400)

    return {
      period,
      comparedTo: COMPARED[period],
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
        lowStock: variations.filter(
          (v) => v.lowStockThreshold !== null && v.stock > 0 && v.stock <= v.lowStockThreshold,
        ).length,
        overduePayables: 3,
        draftSales: sales.filter((s) => s.status === 'open').length,
      },
    }
  }, [period, range, variations, sales, locations])

  return { data, isLoading: false }
}

export type DashboardSummary = NonNullable<ReturnType<typeof useDashboardSummary>['data']>
