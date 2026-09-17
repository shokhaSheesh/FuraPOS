import { useMemo } from 'react'
import { useDataStore, type Client, type CreateSaleInput } from '@/data/store'
import { matches, paginate } from '@/data/query'
import type { ListQuery } from '@/shared/types'
import type { Sale, SaleStatus } from '../model/sale'
import { applyQueryFilters } from '@/shared/lib/fieldFilters'
import { gettersOf } from '@/shared/lib/columnFilterFields'
import { SALE_FILTER_OVERRIDES } from '../model/saleFilterFields'

export type { Client, CreateSaleInput }

/**
 * Reads the in-memory store. No network, so nothing loads and nothing fails —
 * the hooks keep the shape the screens already expect.
 */

function filterSales(all: Sale[], query: ListQuery, includeDeleted = false) {
  const byField = applyQueryFilters(all, query.f, gettersOf(SALE_FILTER_OVERRIDES))
  return byField.filter((sale) => {
    // A cancelled sale must not sit in the ledger inflating revenue.
    if (!query.status && !includeDeleted && sale.status === 'deleted') return false
    if (query.status && sale.status !== query.status) return false
    if (query.from && sale.createdAt.slice(0, 10) < String(query.from)) return false
    if (query.to && sale.createdAt.slice(0, 10) > String(query.to)) return false
    return matches([sale.number, sale.clientName, sale.locationName, sale.sellerName], query.search)
  })
}

export function useSales(query: ListQuery) {
  const sales = useDataStore((s) => s.sales)
  const data = useMemo(
    () => paginate([...filterSales(sales, query)].reverse(), query),
    [sales, query],
  )
  return { data, isLoading: false }
}

export function useSale(id: string) {
  const sale = useDataStore((s) => s.sales.find((item) => item.id === id))
  return { data: sale, isLoading: false, isError: !sale }
}

export function useSaleStatusCounts(query: ListQuery) {
  const sales = useDataStore((s) => s.sales)
  const data = useMemo(() => {
    const scoped = filterSales(sales, { ...query, status: undefined }, true)
    const counts: Record<string, number> = {}
    for (const sale of scoped) counts[sale.status] = (counts[sale.status] ?? 0) + 1
    // "All" excludes deleted, matching what the ledger actually shows.
    counts.all = scoped.filter((sale) => sale.status !== 'deleted').length
    return counts
  }, [sales, query])
  return { data, isLoading: false }
}

/* --- writes -------------------------------------------------------------- */

export function useCreateSale() {
  const create = useDataStore((s) => s.createSale)
  return {
    isPending: false,
    variables: undefined as CreateSaleInput | undefined,
    mutate: (input: CreateSaleInput, opts?: { onSuccess?: (sale: Sale) => void }) => {
      opts?.onSuccess?.(create(input))
    },
  }
}

export function useUpdateSale(id: string) {
  const update = useDataStore((s) => s.updateSale)
  return {
    isPending: false,
    mutate: (patch: { status?: SaleStatus; paid?: number }, opts?: { onSuccess?: () => void }) => {
      update(id, patch)
      opts?.onSuccess?.()
    },
  }
}
