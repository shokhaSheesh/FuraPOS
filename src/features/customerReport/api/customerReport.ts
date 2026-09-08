import { useMemo } from 'react'
import { useDataStore } from '@/data/store'
import { matches } from '@/data/query'
import {
  AT_RISK_DAYS,
  scoreCustomers,
  type CustomerFacts,
  type RfmSegment,
  type ScoredCustomer,
} from '../model/rfm'

export interface CustomerReportFilters {
  from?: unknown
  to?: unknown
  segment?: unknown
  search?: unknown
}

export interface CustomerReportSummary {
  base: number
  newInPeriod: number
  activeInPeriod: number
  /** Share of buyers who bought more than once — the number that says whether
   *  the business keeps people or just keeps finding them. */
  repeatRate: number
  averageCheck: number
  averageSpend: number
  atRisk: number
  cashbackOwed: number
  debtOwed: number
  revenue: number
}

export interface CustomerReportResult {
  customers: ScoredCustomer[]
  summary: CustomerReportSummary
  bySegment: Record<RfmSegment, number>
}

/**
 * The customer report.
 *
 * Everything is scoped to the chosen window: "spend" is spend in the period,
 * not all time, because a report about who is slipping away must not be
 * flattered by what somebody bought two years ago.
 */
export function useCustomerReport(
  filters: CustomerReportFilters,
  enabled: boolean,
): CustomerReportResult | null {
  const clients = useDataStore((s) => s.clients)
  const sales = useDataStore((s) => s.sales)

  return useMemo(() => {
    if (!enabled) return null

    const from = filters.from ? new Date(String(filters.from)).getTime() : null
    const to = filters.to ? new Date(String(filters.to)).getTime() + 86_400_000 - 1 : null

    const facts = new Map<string, CustomerFacts>()
    for (const client of clients) {
      facts.set(client.id, {
        clientId: client.id,
        name: client.name,
        recencyDays: null,
        purchases: 0,
        spend: 0,
        averageCheck: 0,
        lastPurchaseAt: null,
        firstPurchaseAt: null,
        debt: client.debt,
        cashback: client.cashback,
      })
    }

    let revenue = 0
    for (const sale of sales) {
      if (sale.status === 'deleted' || !sale.clientId) continue
      const at = new Date(sale.createdAt).getTime()
      if (from !== null && at < from) continue
      if (to !== null && at > to) continue

      const entry = facts.get(sale.clientId)
      // A sale against a client who no longer exists is not attributable, and
      // inventing a row for them would put a nameless customer in a segment.
      if (!entry) continue

      entry.purchases += 1
      entry.spend += sale.total
      revenue += sale.total
      if (!entry.lastPurchaseAt || sale.createdAt > entry.lastPurchaseAt) {
        entry.lastPurchaseAt = sale.createdAt
      }
      if (!entry.firstPurchaseAt || sale.createdAt < entry.firstPurchaseAt) {
        entry.firstPurchaseAt = sale.createdAt
      }
    }

    // Recency is measured from the end of the window, not from today: a report
    // on last spring should say who was quiet last spring.
    const asOf = to ?? Date.now()
    for (const entry of facts.values()) {
      entry.averageCheck = entry.purchases === 0 ? 0 : entry.spend / entry.purchases
      entry.recencyDays = entry.lastPurchaseAt
        ? Math.max(0, Math.floor((asOf - new Date(entry.lastPurchaseAt).getTime()) / 86_400_000))
        : null
    }

    const scored = scoreCustomers([...facts.values()])

    const buyers = scored.filter((entry) => entry.purchases > 0)
    const repeat = buyers.filter((entry) => entry.purchases > 1)
    const clientById = new Map(clients.map((client) => [client.id, client]))

    const summary: CustomerReportSummary = {
      base: scored.length,
      newInPeriod: scored.filter((entry) => {
        const created = clientById.get(entry.clientId)?.createdAt
        if (!created) return false
        const at = new Date(created).getTime()
        return (from === null || at >= from) && (to === null || at <= to)
      }).length,
      activeInPeriod: buyers.length,
      repeatRate: buyers.length === 0 ? 0 : repeat.length / buyers.length,
      averageCheck:
        buyers.length === 0
          ? 0
          : buyers.reduce((sum, e) => sum + e.spend, 0) /
            buyers.reduce((sum, e) => sum + e.purchases, 0),
      averageSpend: buyers.length === 0 ? 0 : revenue / buyers.length,
      atRisk: buyers.filter((entry) => (entry.recencyDays ?? 0) > AT_RISK_DAYS).length,
      cashbackOwed: scored.reduce((sum, e) => sum + e.cashback, 0),
      debtOwed: scored.reduce((sum, e) => sum + e.debt, 0),
      revenue,
    }

    const bySegment = Object.fromEntries(
      RFM_SEGMENT_KEYS.map((key) => [key, scored.filter((e) => e.segment === key).length]),
    ) as Record<RfmSegment, number>

    const customers = scored
      .filter((entry) => {
        if (filters.segment && entry.segment !== filters.segment) return false
        return matches([entry.name], filters.search as string | undefined)
      })
      // Biggest spenders first: the list is read top-down and the money at the
      // top is the money worth acting on.
      .sort((a, b) => b.spend - a.spend)

    return { customers, summary, bySegment }
  }, [enabled, clients, sales, filters.from, filters.to, filters.segment, filters.search])
}

const RFM_SEGMENT_KEYS: RfmSegment[] = [
  'champions',
  'loyal',
  'promising',
  'new',
  'needAttention',
  'atRisk',
  'cantLose',
  'lost',
]
