import { useMemo } from 'react'
import { applyQueryFilters } from '@/shared/lib/fieldFilters'
import { gettersOf } from '@/shared/lib/columnFilterFields'
import { ONLINE_SALE_FILTER_OVERRIDES } from '../model/onlineSaleFilterFields'
import { useDataStore } from '@/data/store'
import { matches, paginate } from '@/data/query'
import type { ListQuery } from '@/shared/types'
import type { OnlineSale } from '../model/onlineSale'

/** Everything but the status chip, so the chip counts describe the rest of the filters. */
function scope(all: OnlineSale[], query: ListQuery) {
  const from = query.from ? new Date(String(query.from)).getTime() : null
  const to = query.to ? new Date(String(query.to)).getTime() + 86_400_000 - 1 : null
  const byField = applyQueryFilters(all, query.f, gettersOf(ONLINE_SALE_FILTER_OVERRIDES))
  return byField.filter((sale) => {
    if (query.location && sale.locationId !== query.location) return false
    if (query.payment && sale.paymentStatus !== query.payment) return false
    const at = new Date(sale.createdAt).getTime()
    if (from !== null && at < from) return false
    if (to !== null && at > to) return false
    return matches(
      [
        sale.number,
        sale.customerName,
        sale.customerPhone,
        sale.pickupPoint,
        sale.courierOrderId,
        ...sale.lines.map((line) => line.sku),
        ...sale.lines.map((line) => line.name),
      ],
      query.search,
    )
  })
}

export function useOnlineSales(query: ListQuery) {
  const all = useDataStore((s) => s.onlineSales)
  const data = useMemo(() => {
    const rows = scope(all, query).filter((sale) => !query.status || sale.status === query.status)
    return paginate(rows, query)
  }, [all, query])
  return { data, isLoading: false }
}

export function useOnlineSaleCounts(query: ListQuery) {
  const all = useDataStore((s) => s.onlineSales)
  return useMemo(() => {
    const rows = scope(all, query)
    const counts: Record<string, number> = { all: rows.length }
    for (const sale of rows) counts[sale.status] = (counts[sale.status] ?? 0) + 1
    return counts
  }, [all, query])
}

export function useOnlineSale(id: string) {
  const sale = useDataStore((s) => s.onlineSales.find((entry) => entry.id === id))
  return { data: sale, isLoading: false }
}
