import { useMemo } from 'react'
import { useDataStore } from '@/data/store'
import { matches } from '@/data/query'
import { USD_RATE } from '@/data/seed'
import {
  DEFAULT_SETTINGS,
  daysOfCover,
  dailyRate,
  lineCostUzs,
  needsOrdering,
  reorderPoint,
  suggestedQuantity,
  urgencyOf,
  URGENCY_ORDER,
  type ReorderLine,
  type ReorderSettings,
  type Urgency,
} from '../model/reorder'

export interface ReorderFilters {
  search?: string
  supplierId?: string | null
  categoryId?: string | null
  locationId?: string | null
  /** A selection can be scoped to several warehouses at once, as OX allows. */
  locationIds?: string[]
  urgency?: Urgency | null
  /** Hide anything already comfortable, which is most of the catalogue. */
  onlyNeeded?: boolean
}

/**
 * Turns the whole catalogue into a buying list.
 *
 * Everything here is derived on read. There is no stored "suggestion", because
 * a suggestion is only true for as long as the stock and the sales behind it
 * are — one sale later and yesterday's answer is wrong.
 */
export function useReorderLines(settings: ReorderSettings, filters: ReorderFilters) {
  const variations = useDataStore((s) => s.variations)
  const sales = useDataStore((s) => s.sales)
  const receipts = useDataStore((s) => s.receipts)

  return useMemo(
    () => buildReorderLines({ variations, sales, receipts }, settings, filters),
    [variations, sales, receipts, settings, filters],
  )
}

/**
 * The calculation itself, free of React so a saved selection can freeze the
 * same answer the screen would have shown.
 */
export function buildReorderLines(
  data: {
    variations: ReturnType<typeof useDataStore.getState>['variations']
    sales: ReturnType<typeof useDataStore.getState>['sales']
    receipts: ReturnType<typeof useDataStore.getState>['receipts']
  },
  settings: ReorderSettings,
  filters: ReorderFilters,
): ReorderLine[] {
  const { variations, sales, receipts } = data
  {
    const since = Date.now() - settings.salesWindowDays * 86_400_000

    /* Units sold per variation in the window. Deleted sales are excluded for
       the same reason they are excluded from revenue: a cancelled sale is not
       demand, and treating it as such would have us buying stock to replace
       goods that never left. */
    const sold = new Map<string, number>()
    for (const sale of sales) {
      if (sale.status === 'deleted') continue
      if (new Date(sale.createdAt).getTime() < since) continue
      if (filters.locationId && sale.locationId !== filters.locationId) continue
      if (filters.locationIds?.length && !filters.locationIds.includes(sale.locationId)) continue
      for (const line of sale.lines) {
        sold.set(line.variationId, (sold.get(line.variationId) ?? 0) + line.quantity)
      }
    }

    /* Who last sent us each part, and at what landed cost. The most recent
       posted receipt wins: a supplier we stopped buying from is not who we
       should be ordering from now. */
    const source = new Map<
      string,
      { supplierId: string | null; supplierName: string | null; at: string }
    >()
    for (const receipt of receipts) {
      if (receipt.status !== 'received' || !receipt.receivedAt) continue
      for (const line of receipt.lines) {
        const current = source.get(line.variationId)
        if (!current || receipt.receivedAt > current.at) {
          source.set(line.variationId, {
            supplierId: receipt.supplierId,
            supplierName: receipt.supplierName,
            at: receipt.receivedAt,
          })
        }
      }
    }

    const lines: ReorderLine[] = variations
      .filter((variation) => variation.status === 'active')
      .map((variation) => {
        const scope = filters.locationIds?.length
          ? filters.locationIds
          : filters.locationId
            ? [filters.locationId]
            : null
        const onHand = scope
          ? variation.stockByLocation
              .filter((row) => scope.includes(row.locationId))
              .reduce((sum, row) => sum + row.quantity, 0)
          : variation.stock
        const unitsSold = sold.get(variation.id) ?? 0
        const rate = dailyRate(unitsSold, settings.salesWindowDays)
        const cover = daysOfCover(onHand, rate)
        const { shortfall, suggested } = suggestedQuantity(onHand, rate, variation.moq, settings)
        const from = source.get(variation.id)

        return {
          variationId: variation.id,
          productId: variation.productId,
          sku: variation.sku,
          name: variation.fullName,
          imageUrl: variation.imageUrl,
          unit: variation.unit,
          categoryName: variation.categoryName,
          supplierId: from?.supplierId ?? null,
          supplierName: from?.supplierName ?? null,
          onHand,
          sold: unitsSold,
          dailyRate: rate,
          daysOfCover: cover,
          reorderPoint: reorderPoint(rate, settings),
          shortfall,
          suggested,
          moq: variation.moq,
          unitCost: variation.costPrice,
          costCurrency: variation.costCurrency,
          urgency: urgencyOf(onHand, rate, cover, settings),
        }
      })
      .filter((line) => {
        if (filters.onlyNeeded && !needsOrdering(line)) return false
        if (filters.urgency && line.urgency !== filters.urgency) return false
        if (filters.supplierId && line.supplierId !== filters.supplierId) return false
        if (filters.categoryId) {
          const variation = variations.find((v) => v.id === line.variationId)
          if (variation?.categoryId !== filters.categoryId) return false
        }
        return matches([line.name, line.sku, line.supplierName, line.categoryName], filters.search)
      })

    // Most urgent first, then whatever runs out soonest — the order someone
    // would deal with them in.
    lines.sort((a, b) => {
      const byUrgency = URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency]
      if (byUrgency !== 0) return byUrgency
      return (a.daysOfCover ?? Infinity) - (b.daysOfCover ?? Infinity)
    })

    return lines
  }
}

export interface ReorderSummary {
  needed: number
  outOfStock: number
  critical: number
  units: number
  cost: number
  suppliers: number
}

export function summariseReorder(lines: ReorderLine[]): ReorderSummary {
  const needed = lines.filter(needsOrdering)
  return {
    needed: needed.length,
    outOfStock: lines.filter((line) => line.urgency === 'out').length,
    critical: lines.filter((line) => line.urgency === 'critical').length,
    units: needed.reduce((sum, line) => sum + line.suggested, 0),
    cost: needed.reduce((sum, line) => sum + lineCostUzs(line, USD_RATE), 0),
    suppliers: new Set(needed.map((line) => line.supplierId ?? '__none__')).size,
  }
}

export function countByUrgency(lines: ReorderLine[]): Record<string, number> {
  const counts: Record<string, number> = { all: lines.length }
  for (const line of lines) counts[line.urgency] = (counts[line.urgency] ?? 0) + 1
  return counts
}

export { DEFAULT_SETTINGS }
