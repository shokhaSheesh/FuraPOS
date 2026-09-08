import { useMemo } from 'react'
import { useDataStore, type ClientInput } from '@/data/store'
import { matches } from '@/data/query'
import type { Sale } from '@/features/sales/model/sale'
import {
  EMPTY_CLIENT_STATS,
  headroom,
  isDormant,
  isOverLimit,
  type Client,
  type ClientStats,
  type ClientStatus,
} from '../model/client'

/**
 * What the sales ledger says about each client.
 *
 * Deleted sales are excluded, as everywhere else: a cancelled sale is not
 * custom, and counting it would make a client look better than they are.
 */
export function buildClientStats(sales: Sale[]): Map<string, ClientStats> {
  const stats = new Map<string, ClientStats>()
  const seenProducts = new Map<string, Set<string>>()

  for (const sale of sales) {
    if (sale.status === 'deleted' || !sale.clientId) continue

    const current = stats.get(sale.clientId) ?? { ...EMPTY_CLIENT_STATS }
    const products = seenProducts.get(sale.clientId) ?? new Set<string>()

    current.revenue += sale.total
    current.sales += 1
    for (const line of sale.lines) {
      current.units += line.quantity
      products.add(line.variationId)
    }
    if (!current.lastSaleAt || sale.createdAt > current.lastSaleAt) {
      current.lastSaleAt = sale.createdAt
    }

    seenProducts.set(sale.clientId, products)
    stats.set(sale.clientId, current)
  }

  for (const [id, entry] of stats) {
    entry.averageCheck = entry.sales === 0 ? 0 : entry.revenue / entry.sales
    entry.products = seenProducts.get(id)?.size ?? 0
  }

  return stats
}

export interface ClientRow extends Client {
  stats: ClientStats
  headroom: number | null
  overLimit: boolean
  dormant: boolean
}

export interface ClientFilters {
  search?: unknown
  type?: unknown
  lens?: unknown
}

export function useClients(filters: ClientFilters = {}) {
  const clients = useDataStore((s) => s.clients)
  const sales = useDataStore((s) => s.sales)

  return useMemo(() => {
    const stats = buildClientStats(sales)

    const items: ClientRow[] = clients
      .map((client) => {
        const entry = stats.get(client.id) ?? EMPTY_CLIENT_STATS
        return {
          ...client,
          stats: entry,
          headroom: headroom(client),
          overLimit: isOverLimit(client),
          dormant: isDormant(client, entry),
        }
      })
      .filter((client) => {
        if (filters.type && client.type !== filters.type) return false
        if (filters.lens === 'owing' && client.debt <= 0) return false
        if (filters.lens === 'overLimit' && !client.overLimit) return false
        if (filters.lens === 'dormant' && !client.dormant) return false
        return matches(
          [client.name, client.phone, client.email],
          filters.search as string | undefined,
        )
      })
      /*
        Archived last, then whoever owes the most. A customer list ordered by
        name is a phone book; ordered by exposure it is the list somebody
        actually has to act on.
      */
      .sort((a, b) => {
        const byStatus = Number(a.status === 'archived') - Number(b.status === 'archived')
        if (byStatus !== 0) return byStatus
        if (b.debt !== a.debt) return b.debt - a.debt
        return b.stats.revenue - a.stats.revenue
      })

    return { data: { items, total: items.length }, isLoading: false }
  }, [clients, sales, filters.type, filters.lens, filters.search])
}

export function useClient(id: string | undefined) {
  const clients = useDataStore((s) => s.clients)
  const sales = useDataStore((s) => s.sales)

  return useMemo(() => {
    const client = clients.find((c) => c.id === id)
    if (!client) return { data: undefined, isLoading: false }
    const stats = buildClientStats(sales).get(client.id) ?? EMPTY_CLIENT_STATS
    return {
      data: {
        ...client,
        stats,
        headroom: headroom(client),
        overLimit: isOverLimit(client),
        dormant: isDormant(client, stats),
      } as ClientRow,
      isLoading: false,
    }
  }, [clients, sales, id])
}

export function useClientSales(id: string | undefined, limit = 10) {
  const sales = useDataStore((s) => s.sales)
  return useMemo(
    () =>
      sales
        .filter((sale) => sale.clientId === id && sale.status !== 'deleted')
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit),
    [sales, id, limit],
  )
}

export function useClientCounts(filters: ClientFilters = {}) {
  const { data } = useClients({ ...filters, lens: null })
  return useMemo(
    () => ({
      data: {
        all: data.items.length,
        owing: data.items.filter((c) => c.debt > 0).length,
        overLimit: data.items.filter((c) => c.overLimit).length,
        dormant: data.items.filter((c) => c.dormant).length,
      },
    }),
    [data.items],
  )
}

export interface ClientsSummary {
  owed: number
  owing: number
  overLimit: number
  dormant: number
  revenue: number
}

export function useClientsSummary(): ClientsSummary {
  const { data } = useClients()
  return useMemo(
    () => ({
      owed: data.items.reduce((sum, c) => sum + c.debt, 0),
      owing: data.items.filter((c) => c.debt > 0).length,
      overLimit: data.items.filter((c) => c.overLimit).length,
      dormant: data.items.filter((c) => c.dormant).length,
      revenue: data.items.reduce((sum, c) => sum + c.stats.revenue, 0),
    }),
    [data.items],
  )
}

export function useClientActions() {
  const create = useDataStore((s) => s.createClient)
  const update = useDataStore((s) => s.updateClient)
  const setStatus = useDataStore((s) => s.setClientStatus)

  return {
    create: (input: ClientInput) => create(input),
    update: (id: string, input: ClientInput) => update(id, input),
    setStatus: (id: string, status: ClientStatus) => setStatus(id, status),
    isPending: false,
  }
}
