import { useMemo } from 'react'
import { useDataStore } from '@/data/store'
import { matches, paginate } from '@/data/query'
import type { ListQuery } from '@/shared/types'
import { orderedUnits, shippedUnits, type PartnerOrder } from '../model/partnerOrder'

function filterOrders(all: PartnerOrder[], query: ListQuery) {
  return all.filter((order) => {
    if (query.status && order.status !== query.status) return false
    if (query.client && order.clientId !== query.client) return false
    if (query.location && order.locationId !== query.locationId) return false
    return matches(
      [order.number, order.clientName, order.comment, ...order.lines.map((line) => line.name)],
      query.search,
    )
  })
}

export function usePartnerOrders(query: ListQuery) {
  const orders = useDataStore((s) => s.partnerOrders)
  const data = useMemo(() => {
    const filtered = filterOrders(orders, query)
    // Newest first: an order placed this morning is the one somebody is
    // waiting on an answer for.
    const ordered = query.sort
      ? filtered
      : [...filtered].sort((a, b) => b.placedAt.localeCompare(a.placedAt))
    return paginate(ordered, query)
  }, [orders, query])
  return { data, isLoading: false }
}

export function usePartnerOrder(id: string) {
  const order = useDataStore((s) => s.partnerOrders.find((o) => o.id === id))
  return { data: order, isLoading: false, isError: !order }
}

export function usePartnerOrderStatusCounts(query: ListQuery) {
  const orders = useDataStore((s) => s.partnerOrders)
  const data = useMemo(() => {
    const scoped = filterOrders(orders, { ...query, status: undefined })
    const counts: Record<string, number> = { all: scoped.length }
    for (const order of scoped) counts[order.status] = (counts[order.status] ?? 0) + 1
    return counts
  }, [orders, query])
  return { data, isLoading: false }
}

export interface PartnerOrderSummary {
  waiting: number
  toShip: number
  shippedUnits: number
}

export function usePartnerOrderSummary(query: ListQuery) {
  const orders = useDataStore((s) => s.partnerOrders)
  return useMemo<PartnerOrderSummary>(() => {
    const scoped = filterOrders(orders, { ...query, status: undefined })
    return {
      waiting: scoped.filter((order) => order.status === 'new').length,
      toShip: scoped
        .filter((order) => order.status === 'confirmed' || order.status === 'partial')
        .reduce((sum, order) => sum + orderedUnits(order) - shippedUnits(order), 0),
      shippedUnits: scoped.reduce((sum, order) => sum + shippedUnits(order), 0),
    }
  }, [orders, query])
}

/* --- writes -------------------------------------------------------------- */

export function usePartnerOrderActions(id: string) {
  const confirm = useDataStore((s) => s.confirmPartnerOrder)
  const ship = useDataStore((s) => s.shipPartnerOrder)
  const cancel = useDataStore((s) => s.cancelPartnerOrder)

  type Opts<T = void> = { onSuccess?: (value: T) => void; onError?: (message: string) => void }
  const run = <T>(
    result: { ok: true } | { ok: false; error: string },
    opts: Opts<T> | undefined,
    value: T,
  ) => {
    if (result.ok) opts?.onSuccess?.(value)
    else opts?.onError?.(result.error)
  }

  return {
    isPending: false,
    confirm: (opts?: Opts) => run(confirm(id), opts, undefined as void),
    ship: (input: { quantities: Record<string, number>; note: string }, opts?: Opts<string>) => {
      const result = ship(id, input.quantities, input.note)
      if (result.ok) opts?.onSuccess?.(result.shipmentId)
      else opts?.onError?.(result.error)
    },
    cancel: (opts?: Opts) => run(cancel(id), opts, undefined as void),
  }
}
