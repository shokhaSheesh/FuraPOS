import { useMemo } from 'react'
import { useDataStore } from '@/data/store'
import { matches, paginate } from '@/data/query'
import { correctionReasonLabel } from '@/features/corrections/model/correction'
import { byNewest, byOldest, type StockLogEntry, type StockLogKind } from '../model/log'

type State = ReturnType<typeof useDataStore.getState>

/**
 * Replays every stock-moving document into one ordered list of events.
 *
 * **The running balance is worked backwards.** Nothing stores what a shelf held
 * on a given day — only what it holds now — so the opening balance is
 * `current − (everything that has happened since)`, and the column is filled by
 * walking forward from there. That is exact rather than approximate, and it is
 * why the log and the product page can never disagree.
 */
export function buildStockLog(state: State): StockLogEntry[] {
  const entries: StockLogEntry[] = []

  const push = (entry: Omit<StockLogEntry, 'balanceAfter'>) =>
    entries.push({ ...entry, balanceAfter: null })

  for (const receipt of state.receipts) {
    if (receipt.status !== 'received' || !receipt.receivedAt) continue
    for (const line of receipt.lines) {
      const quantity = line.receivedQuantity ?? line.orderedQuantity
      if (quantity === 0) continue
      push({
        id: `log-rec-${receipt.id}-${line.id}`,
        at: receipt.receivedAt,
        kind: 'receipt',
        variationId: line.variationId,
        productId: line.productId,
        sku: line.sku,
        name: line.name,
        imageUrl: line.imageUrl,
        locationId: receipt.locationId,
        locationName: receipt.locationName,
        delta: quantity,
        documentId: receipt.id,
        documentNumber: receipt.number,
        reason: null,
        by: receipt.receivedBy ?? receipt.createdBy,
      })
    }
  }

  for (const transfer of state.transfers) {
    if (transfer.status !== 'received') continue
    for (const line of transfer.lines) {
      const moved = line.receivedQuantity ?? line.sentQuantity ?? line.requestedQuantity
      if (moved === 0) continue
      const shared = {
        variationId: line.variationId,
        productId: line.productId,
        sku: line.sku,
        name: line.name,
        imageUrl: line.imageUrl,
        documentId: transfer.id,
        documentNumber: transfer.number,
        reason: null,
        by: transfer.receivedBy ?? transfer.sentBy ?? transfer.createdBy,
        at: transfer.createdAt,
      }
      // Two events, not one: a transfer leaves one shelf and arrives on
      // another, and the log of either shelf must show its own side.
      push({
        ...shared,
        id: `log-trf-out-${transfer.id}-${line.id}`,
        kind: 'transfer_out',
        locationId: transfer.fromLocationId,
        locationName: transfer.fromLocationName,
        delta: -moved,
      })
      push({
        ...shared,
        id: `log-trf-in-${transfer.id}-${line.id}`,
        kind: 'transfer_in',
        locationId: transfer.toLocationId,
        locationName: transfer.toLocationName,
        delta: moved,
      })
    }
  }

  for (const correction of state.corrections) {
    const fromStocktake = correction.source === 'stocktake'
    for (const line of correction.lines) {
      const delta = line.countedAfter - line.countedBefore
      if (delta === 0) continue
      push({
        id: `log-cor-${correction.id}-${line.id}`,
        at: correction.createdAt,
        kind: fromStocktake ? 'stocktake' : 'correction',
        variationId: line.variationId,
        productId: line.productId,
        sku: line.sku,
        name: line.name,
        imageUrl: line.imageUrl,
        locationId: correction.locationId,
        locationName: correction.locationName,
        delta,
        documentId: correction.id,
        documentNumber: correction.number,
        // The one place a real reason exists, so the column earns its keep.
        reason: correctionReasonLabel(correction.reason),
        by: correction.createdBy,
      })
    }
  }

  for (const sale of state.sales) {
    if (sale.status === 'deleted') continue
    for (const line of sale.lines) {
      push({
        id: `log-sale-${sale.id}-${line.id}`,
        at: sale.createdAt,
        kind: 'sale',
        variationId: line.variationId,
        productId: line.productId,
        sku: line.sku,
        name: line.name,
        imageUrl: line.imageUrl,
        locationId: sale.locationId,
        locationName: sale.locationName,
        delta: -line.quantity,
        documentId: sale.id,
        documentNumber: sale.number,
        reason: null,
        by: sale.sellerName,
      })
    }
  }

  return withBalances(entries, state)
}

/**
 * Fills in `balanceAfter` per (variation, location).
 *
 * Walks each shelf's history oldest-first from an opening balance of
 * `now − net change`, so the last entry always lands exactly on what the
 * product page shows.
 */
function withBalances(entries: StockLogEntry[], state: State): StockLogEntry[] {
  const byShelf = new Map<string, StockLogEntry[]>()
  for (const entry of entries) {
    const key = `${entry.variationId}@${entry.locationId}`
    const list = byShelf.get(key)
    if (list) list.push(entry)
    else byShelf.set(key, [entry])
  }

  const stockNow = new Map<string, number>()
  for (const variation of state.variations) {
    for (const row of variation.stockByLocation) {
      stockNow.set(`${variation.id}@${row.locationId}`, row.quantity)
    }
  }

  for (const [key, list] of byShelf) {
    list.sort(byOldest)
    const net = list.reduce((sum, entry) => sum + entry.delta, 0)
    const current = stockNow.get(key)
    if (current === undefined) continue // Shelf no longer exists; leave null.

    let running = current - net
    for (const entry of list) {
      running += entry.delta
      entry.balanceAfter = running
    }
  }

  return entries.sort(byNewest)
}

export interface LogFilters {
  search?: unknown
  location?: unknown
  kind?: unknown
  from?: unknown
  to?: unknown
  page?: unknown
  pageSize?: unknown
}

export function useStockLog(filters: LogFilters = {}) {
  const variations = useDataStore((s) => s.variations)
  const sales = useDataStore((s) => s.sales)
  const receipts = useDataStore((s) => s.receipts)
  const transfers = useDataStore((s) => s.transfers)
  const corrections = useDataStore((s) => s.corrections)

  return useMemo(() => {
    const state = { variations, sales, receipts, transfers, corrections } as State
    const all = buildStockLog(state)

    const from = filters.from ? new Date(String(filters.from)).getTime() : null
    // An end date means the end of that day, not midnight at the start of it.
    const to = filters.to ? new Date(String(filters.to)).getTime() + 86_400_000 - 1 : null

    const items = all.filter((entry) => {
      if (filters.location && entry.locationId !== filters.location) return false
      if (filters.kind && entry.kind !== filters.kind) return false
      const at = new Date(entry.at).getTime()
      if (from !== null && at < from) return false
      if (to !== null && at > to) return false
      return matches(
        [entry.name, entry.sku, entry.documentNumber, entry.by],
        filters.search as string | undefined,
      )
    })

    // Paginated like every other list: 1 500 rows in the DOM is a slow screen
    // and a pagination footer that lies about what it is showing.
    return { data: paginate(items, filters as never), isLoading: false }
  }, [
    variations,
    sales,
    receipts,
    transfers,
    corrections,
    filters.search,
    filters.location,
    filters.kind,
    filters.from,
    filters.to,
    filters.page,
    filters.pageSize,
  ])
}

export function useLogKindCounts(filters: LogFilters = {}) {
  // Counts are of the whole filtered set, not the page in front of you.
  const { data } = useStockLog({ ...filters, kind: null, page: 1, pageSize: 100_000 })
  return useMemo(() => {
    const counts: Record<string, number> = { all: data.items.length }
    for (const entry of data.items) counts[entry.kind] = (counts[entry.kind] ?? 0) + 1
    return { data: counts }
  }, [data.items])
}

export function useLogSummary(filters: LogFilters = {}) {
  const { data } = useStockLog({ ...filters, page: 1, pageSize: 100_000 })
  return useMemo(
    () => ({
      events: data.items.length,
      unitsIn: data.items.reduce((sum, e) => sum + Math.max(0, e.delta), 0),
      unitsOut: data.items.reduce((sum, e) => sum + Math.max(0, -e.delta), 0),
      products: new Set(data.items.map((e) => e.variationId)).size,
    }),
    [data.items],
  )
}

export type { StockLogKind }
