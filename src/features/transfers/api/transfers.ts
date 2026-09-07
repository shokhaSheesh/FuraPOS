import { useMemo } from 'react'
import { useDataStore, type CreateTransferInput } from '@/data/store'
import { matches, paginate } from '@/data/query'
import type { ListQuery } from '@/shared/types'
import { transferQuantity, type Transfer, type TransferStatus } from '../model/transfer'

/**
 * Reads straight from the in-memory store, keeping the `{ data, isLoading }`
 * and `{ mutate, isPending }` shapes the rest of the app uses, so a screen
 * cannot tell where its data came from.
 */

function filterTransfers(all: Transfer[], query: ListQuery) {
  return all.filter((transfer) => {
    if (query.status && transfer.status !== query.status) return false
    // One location filter, matching either end: "show me anything involving
    // Chilonzor" is the question a shop manager actually asks, and asking them
    // to pick a direction first would hide half the answer.
    if (
      query.location &&
      transfer.fromLocationId !== query.location &&
      transfer.toLocationId !== query.location
    ) {
      return false
    }
    return matches(
      [
        transfer.number,
        transfer.fromLocationName,
        transfer.toLocationName,
        transfer.comment,
        transfer.createdBy,
        ...transfer.lines.map((line) => line.sku),
        ...transfer.lines.map((line) => line.name),
      ],
      query.search,
    )
  })
}

export function useTransfers(query: ListQuery) {
  const transfers = useDataStore((s) => s.transfers)
  const data = useMemo(() => {
    const filtered = filterTransfers(transfers, query)
    // Newest first by default: a transfer list is a log, and the useful end of
    // a log is the recent one.
    const ordered = query.sort
      ? filtered
      : [...filtered].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return paginate(ordered, query)
  }, [transfers, query])
  return { data, isLoading: false }
}

export function useTransfer(id: string) {
  const transfer = useDataStore((s) => s.transfers.find((t) => t.id === id))
  return { data: transfer, isLoading: false, isError: !transfer }
}

export interface TransferSummary {
  inTransit: number
  inTransitUnits: number
  drafts: number
  receivedRecently: number
}

export function useTransferSummary(query: ListQuery) {
  const transfers = useDataStore((s) => s.transfers)
  return useMemo<TransferSummary>(() => {
    // Status is deliberately ignored so the tiles keep describing the whole
    // board while a status filter narrows the table beneath them.
    const scoped = filterTransfers(transfers, { ...query, status: undefined })
    const inTransit = scoped.filter((t) => t.status === 'in_transit')
    const monthAgo = new Date(Date.now() - 30 * 86_400_000).toISOString()
    return {
      inTransit: inTransit.length,
      inTransitUnits: inTransit.reduce((sum, t) => sum + transferQuantity(t), 0),
      drafts: scoped.filter((t) => t.status === 'draft').length,
      receivedRecently: scoped.filter(
        (t) => t.status === 'received' && (t.receivedAt ?? '') > monthAgo,
      ).length,
    }
  }, [transfers, query])
}

export function useTransferStatusCounts(query: ListQuery) {
  const transfers = useDataStore((s) => s.transfers)
  const data = useMemo(() => {
    const scoped = filterTransfers(transfers, { ...query, status: undefined })
    const counts: Record<string, number> = { all: scoped.length }
    for (const transfer of scoped) {
      counts[transfer.status] = (counts[transfer.status] ?? 0) + 1
    }
    return counts
  }, [transfers, query])
  return { data, isLoading: false }
}

/* --- writes -------------------------------------------------------------- */

export function useCreateTransfer() {
  const create = useDataStore((s) => s.createTransfer)
  return {
    isPending: false,
    mutate: (input: CreateTransferInput, opts?: { onSuccess?: (t: Transfer) => void }) => {
      opts?.onSuccess?.(create(input))
    },
  }
}

export function useSetTransferStatus(id: string) {
  const setStatus = useDataStore((s) => s.setTransferStatus)
  return {
    isPending: false,
    mutate: (
      to: TransferStatus,
      opts?: { onSuccess?: () => void; onError?: (message: string) => void },
    ) => {
      const result = setStatus(id, to)
      if (result.ok) opts?.onSuccess?.()
      else opts?.onError?.(result.error)
    },
  }
}
