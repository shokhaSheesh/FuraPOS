import { useMemo } from 'react'
import { useDataStore, type CreateReceiptInput } from '@/data/store'
import { matches, paginate } from '@/data/query'
import { USD_RATE } from '@/data/seed'
import type { ListQuery } from '@/shared/types'
import {
  extraCostsTotal,
  landedTotal,
  receiptReceived,
  supplierTotal,
  type GoodsReceipt,
  type ReceiptStatus,
} from '../model/receipt'

function filterReceipts(all: GoodsReceipt[], query: ListQuery) {
  return all.filter((receipt) => {
    if (query.status && receipt.status !== query.status) return false
    if (query.location && receipt.locationId !== query.location) return false
    if (query.supplier && receipt.supplierId !== query.supplier) return false
    return matches(
      [
        receipt.number,
        receipt.invoiceNumber,
        receipt.supplierName,
        receipt.locationName,
        receipt.comment,
        receipt.createdBy,
        ...receipt.lines.map((line) => line.sku),
        ...receipt.lines.map((line) => line.name),
      ],
      query.search,
    )
  })
}

export function useReceipts(query: ListQuery) {
  const receipts = useDataStore((s) => s.receipts)
  const data = useMemo(() => {
    const filtered = filterReceipts(receipts, query)
    const ordered = query.sort
      ? filtered
      : [...filtered].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return paginate(ordered, query)
  }, [receipts, query])
  return { data, isLoading: false }
}

export function useReceipt(id: string) {
  const receipt = useDataStore((s) => s.receipts.find((r) => r.id === id))
  return { data: receipt, isLoading: false, isError: !receipt }
}

export interface ReceiptSummary {
  receivedUnits: number
  landedValue: number
  drafts: number
  uplift: number
}

/**
 * What came in and what it really cost. The uplift tile is the number an
 * importer cannot get anywhere else: how much freight and duty add on top of
 * every supplier invoice, across everything actually received.
 */
export function useReceiptSummary(query: ListQuery) {
  const receipts = useDataStore((s) => s.receipts)
  return useMemo<ReceiptSummary>(() => {
    const scoped = filterReceipts(receipts, { ...query, status: undefined })
    const posted = scoped.filter((receipt) => receipt.status === 'received')
    const goods = posted.reduce((sum, r) => sum + supplierTotal(r, USD_RATE), 0)
    const extras = posted.reduce((sum, r) => sum + extraCostsTotal(r, USD_RATE), 0)
    return {
      receivedUnits: posted.reduce((sum, r) => sum + receiptReceived(r), 0),
      landedValue: posted.reduce((sum, r) => sum + landedTotal(r, USD_RATE), 0),
      drafts: scoped.filter((receipt) => receipt.status === 'draft').length,
      uplift: goods === 0 ? 0 : extras / goods,
    }
  }, [receipts, query])
}

export function useReceiptStatusCounts(query: ListQuery) {
  const receipts = useDataStore((s) => s.receipts)
  const data = useMemo(() => {
    const scoped = filterReceipts(receipts, { ...query, status: undefined })
    const counts: Record<string, number> = { all: scoped.length }
    for (const receipt of scoped) counts[receipt.status] = (counts[receipt.status] ?? 0) + 1
    return counts
  }, [receipts, query])
  return { data, isLoading: false }
}

export function useSuppliers() {
  const items = useDataStore((s) => s.suppliers)
  return { data: { items }, isLoading: false }
}

/* --- writes -------------------------------------------------------------- */

export function useCreateReceipt() {
  const create = useDataStore((s) => s.createReceipt)
  return {
    isPending: false,
    mutate: (input: CreateReceiptInput, opts?: { onSuccess?: (r: GoodsReceipt) => void }) => {
      opts?.onSuccess?.(create(input))
    },
  }
}

export function useSetReceiptStatus(id: string) {
  const setStatus = useDataStore((s) => s.setReceiptStatus)
  return {
    isPending: false,
    mutate: (
      input: { to: ReceiptStatus; quantities?: Record<string, number> },
      opts?: { onSuccess?: () => void; onError?: (message: string) => void },
    ) => {
      const result = setStatus(id, input.to, input.quantities)
      if (result.ok) opts?.onSuccess?.()
      else opts?.onError?.(result.error)
    },
  }
}
