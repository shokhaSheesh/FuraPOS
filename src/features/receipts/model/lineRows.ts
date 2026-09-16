import type { CatalogueEntry } from '@/features/suppliers/model/catalogue'
import type { ReceiptLine } from './receipt'

/**
 * One row of the product step, before anything is looked up for display.
 *
 * `lineIndex` is -1 when the row is only an offer of the supplier's that
 * nobody has received any of yet.
 */
export interface ReceiptRowPlan {
  key: string
  lineIndex: number
  entry: CatalogueEntry | null
}

/**
 * Lays out the product step when the delivery is from a supplier whose
 * catalogue we hold.
 *
 * Every product they list is a row, in their order, so a delivery is checked
 * in by reading down their catalogue with their invoice in hand rather than
 * searching for each part by name.
 *
 * **Lines they no longer list come first, not last.** A supplier drops things
 * from their price list, and a delivery already booked in against one of them
 * must not vanish from the screen — stock has moved, and a row nobody can see
 * is a row nobody can correct. Putting them at the top rather than appending
 * them makes that visible instead of merely possible.
 */
export function planCatalogueRows(
  lines: ReceiptLine[],
  catalogue: CatalogueEntry[],
): ReceiptRowPlan[] {
  const indexOfVariation = new Map(lines.map((line, index) => [line.variationId, index] as const))
  const claimed = new Set<number>()

  const listed = catalogue.map((entry): ReceiptRowPlan => {
    const lineIndex = entry.variation ? (indexOfVariation.get(entry.variation.id) ?? -1) : -1
    if (lineIndex > -1) claimed.add(lineIndex)
    return { key: entry.product.id, lineIndex, entry }
  })

  const orphans = lines
    .map((line, lineIndex) => ({ line, lineIndex }))
    .filter(({ lineIndex }) => !claimed.has(lineIndex))
    .map(({ line, lineIndex }): ReceiptRowPlan => ({ key: line.id, lineIndex, entry: null }))

  return [...orphans, ...listed]
}
