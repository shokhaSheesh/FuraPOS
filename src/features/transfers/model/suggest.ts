import type { Sale } from '@/features/sales/model/sale'
import type { VariationRow } from '@/features/products/model/product'
import { DAYS_PER_MONTH } from '@/shared/lib/demand'

/**
 * Proposing a transfer from what actually sold.
 *
 * The question is not "what is low" but "what is low *here* that is spare
 * *there*". Four figures decide it, and the screen shows all four so the
 * suggestion can be argued with:
 *
 *   - what the destination sells, which is the demand being covered;
 *   - what the destination holds, which is how short it is;
 *   - what the source sells, because a source that sells the part too must
 *     keep enough to trade on — draining it is how one shop is restocked by
 *     emptying another;
 *   - what the source holds, which caps everything.
 *
 * Nothing is proposed for a part the destination does not sell. A shop that
 * has never sold a clutch does not need clutches, however many the warehouse
 * happens to be sitting on.
 *
 * **The target is what sold.** A shop that sold 20 over the window and holds 5
 * is short by 15 — enough to trade at the same pace through another window.
 * The source is held to the same rule in reverse: it keeps back what it sold,
 * so restocking one shelf never empties the one it came from.
 */

export interface TransferSuggestion {
  variationId: string
  productId: string
  sku: string
  name: string
  imageUrl: string | null
  unit: string
  costPrice: number
  costCurrency: VariationRow['costCurrency']
  salePrice: number
  /** Units the destination sold inside the window. */
  soldAtDestination: number
  /** Units the source sold inside the window — what it has to keep back. */
  soldAtSource: number
  stockAtDestination: number
  stockAtSource: number
  /** Days the destination's own stock covers at its current rate. */
  daysOfCover: number
  /** Sold less held: what it would take to trade through another window. */
  shortfall: number
  /** The shortfall, capped by what the source can actually spare. */
  suggested: number
}

const stockAt = (variation: VariationRow, locationId: string) =>
  variation.stockByLocation.find((row) => row.locationId === locationId)?.quantity ?? 0

export function suggestTransfer({
  variations,
  sales,
  fromLocationId,
  toLocationId,
  months,
  now = Date.now(),
}: {
  variations: VariationRow[]
  sales: Pick<Sale, 'status' | 'locationId' | 'createdAt' | 'lines'>[]
  fromLocationId: string
  toLocationId: string
  months: number
  now?: number
}): TransferSuggestion[] {
  if (!fromLocationId || !toLocationId || fromLocationId === toLocationId) return []

  const windowDays = months * DAYS_PER_MONTH
  const since = now - windowDays * 86_400_000

  /* One pass over the sales rather than one per product: the catalogue runs to
     hundreds of variations and scanning the ledger for each would be slow
     enough to feel it. */
  const soldTo = new Map<string, number>()
  const soldFrom = new Map<string, number>()
  for (const sale of sales) {
    if (sale.status === 'deleted') continue
    if (sale.locationId !== fromLocationId && sale.locationId !== toLocationId) continue
    if (new Date(sale.createdAt).getTime() < since) continue
    const into = sale.locationId === toLocationId ? soldTo : soldFrom
    for (const line of sale.lines) {
      into.set(line.variationId, (into.get(line.variationId) ?? 0) + line.quantity)
    }
  }

  const suggestions: TransferSuggestion[] = []

  for (const variation of variations) {
    if (variation.status !== 'active') continue

    const destinationSold = soldTo.get(variation.id) ?? 0
    // No demand there, no reason to send it.
    if (destinationSold === 0) continue

    const destinationStock = stockAt(variation, toLocationId)
    const shortfall = destinationSold - destinationStock
    if (shortfall <= 0) continue

    const sourceStock = stockAt(variation, fromLocationId)
    if (sourceStock <= 0) continue

    // What the source must keep to trade at its own pace over the same window.
    const sourceSold = soldFrom.get(variation.id) ?? 0
    const spare = Math.max(0, sourceStock - sourceSold)
    const suggested = Math.min(shortfall, spare)
    if (suggested <= 0) continue

    suggestions.push({
      variationId: variation.id,
      productId: variation.productId,
      sku: variation.sku,
      name: variation.fullName,
      imageUrl: variation.imageUrl,
      unit: variation.unit,
      costPrice: variation.costPrice,
      costCurrency: variation.costCurrency,
      salePrice: variation.salePrice,
      soldAtDestination: destinationSold,
      soldAtSource: sourceSold,
      stockAtDestination: destinationStock,
      stockAtSource: sourceStock,
      daysOfCover:
        destinationSold > 0 ? destinationStock / (destinationSold / windowDays) : Infinity,
      shortfall,
      suggested,
    })
  }

  // Emptiest shelves first: the part the destination runs out of soonest is
  // the one worth putting on the lorry.
  return suggestions.sort((a, b) => a.daysOfCover - b.daysOfCover)
}

/** "Sells 22, 3 left — about 4 days' cover" — the reason, in words. */
export function explainSuggestion(suggestion: TransferSuggestion, months: number): string {
  const cover = Number.isFinite(suggestion.daysOfCover)
    ? `about ${Math.round(suggestion.daysOfCover)} days left`
    : 'nothing sold yet'
  return `Sold ${suggestion.soldAtDestination} in ${months} months, ${suggestion.stockAtDestination} in stock — ${cover}`
}
