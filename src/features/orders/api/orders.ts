import { useMemo } from 'react'
import { useDataStore, type CreateOrderInput } from '@/data/store'
import { matches, paginate } from '@/data/query'
import { USD_RATE } from '@/data/seed'
import type { ListQuery } from '@/shared/types'
import {
  daysLate,
  isOpen,
  outstandingUnits,
  outstandingValue,
  orderValue,
  type OrderStatus,
  type PurchaseOrder,
} from '../model/order'

function filterOrders(all: PurchaseOrder[], query: ListQuery) {
  return all.filter((order) => {
    if (query.status && order.status !== query.status) return false
    if (query.supplier && order.supplierId !== query.supplier) return false
    if (query.location && order.locationId !== query.location) return false
    if (query.lens === 'open' && !isOpen(order.status)) return false
    if (query.lens === 'late' && daysLate(order) === null) return false
    return matches(
      [
        order.number,
        order.supplierName,
        order.locationName,
        order.comment,
        order.createdBy,
        ...order.lines.map((line) => line.sku),
        ...order.lines.map((line) => line.name),
      ],
      query.search,
    )
  })
}

export function useOrders(query: ListQuery) {
  const orders = useDataStore((s) => s.orders)
  const data = useMemo(() => {
    const filtered = filterOrders(orders, query)
    /* Late first, then whatever is still open, then by date. An orders screen
       is opened because something has not turned up, so the thing that has not
       turned up should be at the top. */
    const ordered = query.sort
      ? filtered
      : [...filtered].sort((a, b) => {
          const lateA = daysLate(a) ?? -1
          const lateB = daysLate(b) ?? -1
          if (lateA !== lateB) return lateB - lateA
          if (isOpen(a.status) !== isOpen(b.status)) return isOpen(a.status) ? -1 : 1
          return b.createdAt.localeCompare(a.createdAt)
        })
    return paginate(ordered, query)
  }, [orders, query])
  return { data, isLoading: false }
}

export function useOrder(id: string) {
  const order = useDataStore((s) => s.orders.find((entry) => entry.id === id))
  return { data: order, isLoading: false, isError: !order }
}

/** The deliveries booked against an order, newest first. */
export function useOrderReceipts(id: string) {
  const receipts = useDataStore((s) => s.receipts)
  return useMemo(
    () =>
      receipts
        .filter((receipt) => receipt.orderId === id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [receipts, id],
  )
}

export interface OrdersSummary {
  open: number
  openValue: number
  late: number
  lateValue: number
  awaitingUnits: number
}

export function useOrdersSummary(query: ListQuery) {
  const orders = useDataStore((s) => s.orders)
  return useMemo<OrdersSummary>(() => {
    const scoped = filterOrders(orders, { ...query, status: undefined, lens: undefined })
    const open = scoped.filter((order) => isOpen(order.status))
    const late = scoped.filter((order) => daysLate(order) !== null)
    return {
      open: open.length,
      openValue: open.reduce((sum, order) => sum + outstandingValue(order, USD_RATE), 0),
      late: late.length,
      lateValue: late.reduce((sum, order) => sum + outstandingValue(order, USD_RATE), 0),
      awaitingUnits: open.reduce((sum, order) => sum + outstandingUnits(order), 0),
    }
  }, [orders, query])
}

export function useOrderStatusCounts(query: ListQuery) {
  const orders = useDataStore((s) => s.orders)
  const data = useMemo(() => {
    const scoped = filterOrders(orders, { ...query, status: undefined, lens: undefined })
    const counts: Record<string, number> = {
      all: scoped.length,
      open: scoped.filter((order) => isOpen(order.status)).length,
      late: scoped.filter((order) => daysLate(order) !== null).length,
    }
    for (const order of scoped) counts[order.status] = (counts[order.status] ?? 0) + 1
    return counts
  }, [orders, query])
  return { data, isLoading: false }
}

export { orderValue }

/* --- writes -------------------------------------------------------------- */

export function useCreateOrder() {
  const create = useDataStore((s) => s.createOrder)
  return {
    isPending: false,
    mutate: (input: CreateOrderInput, opts?: { onSuccess?: (o: PurchaseOrder) => void }) => {
      opts?.onSuccess?.(create(input))
    },
  }
}

export function useOrderActions(id: string) {
  const setStatus = useDataStore((s) => s.setOrderStatus)
  const receive = useDataStore((s) => s.receiveAgainstOrder)
  return {
    setStatus: (
      to: OrderStatus,
      opts?: { onSuccess?: () => void; onError?: (m: string) => void },
    ) => {
      const result = setStatus(id, to)
      if (result.ok) opts?.onSuccess?.()
      else opts?.onError?.(result.error)
    },
    receive: (
      input: { quantities: Record<string, number>; invoiceNumber: string },
      opts?: { onSuccess?: (receiptId: string) => void; onError?: (m: string) => void },
    ) => {
      const result = receive(id, input.quantities, input.invoiceNumber)
      if (result.ok) opts?.onSuccess?.(result.receiptId)
      else opts?.onError?.(result.error)
    },
  }
}
