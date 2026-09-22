import type { Sale } from '@/features/sales/model/sale'
import type { CatalogueEntry } from '@/features/suppliers/model/catalogue'
import { DAYS_PER_MONTH, SUGGEST_AT_OR_BELOW, unitsSoldAt } from '@/shared/lib/demand'

/**
 * What to order, worked out from what sold.
 *
 * The problem this exists for: a catalogue of ten thousand parts cannot be
 * checked by hand. Nobody opens each product, reads its stock, remembers what
 * it sold and decides. So the arithmetic is deliberately the plainest thing
 * that answers the question:
 *
 *   sold over the window − what we hold = what we are short by.
 *
 * Twenty sold in three months with two left over is eighteen short, because
 * trading at the same pace through another three months needs twenty and two
 * are already here. It is not a forecast and does not pretend to be one; it is
 * the last window repeated, which is the assumption a buyer makes anyway.
 *
 * Stock is counted company-wide rather than per shop. An order refills the
 * business, and a part sitting in the other warehouse is a part we do not need
 * to buy.
 *
 * Nothing is proposed until the shelf is nearly empty — see
 * `SUGGEST_AT_OR_BELOW`. The arithmetic on its own proposes a top-up for
 * anything at all short, and an order full of threes is not an order anybody
 * places.
 *
 * An **empty** shelf is the exception (client request): a variation at zero is
 * proposed whether or not it sold in the window, because it cannot sell what
 * it has none of, and a part with a left and a right where only the left has
 * run out is exactly the case the buyer opens this for. With nothing sold to
 * size it, it is proposed at the supplier's minimum, or one.
 */

export interface OrderSuggestion {
  supplierProductId: string
  variationId: string
  name: string
  supplierSku: string
  brandName: string | null
  categoryName: string | null
  unit: string
  price: number
  currency: 'USD' | 'UZS'
  /** Units sold across the business inside the window. */
  sold: number
  /** Units we hold across the business now. */
  stock: number
  /** Sold less held: what it would take to trade through another window. */
  shortfall: number
  /** The shortfall, raised to the supplier's minimum if they insist on more. */
  suggested: number
  /** Days our stock covers at the rate it has been selling. */
  daysOfCover: number
}

export function suggestOrder({
  entries,
  sales,
  months,
  now = Date.now(),
}: {
  entries: CatalogueEntry[]
  sales: Pick<Sale, 'status' | 'locationId' | 'createdAt' | 'lines'>[]
  months: number
  now?: number
}): OrderSuggestion[] {
  const windowDays = months * DAYS_PER_MONTH
  const suggestions: OrderSuggestion[] = []

  for (const entry of entries) {
    // Something the supplier lists but we have never stocked has no history to
    // reason from. Buying it is a judgement call, not an arithmetic one.
    if (!entry.variation) continue

    // Out of stock is reason enough on its own; otherwise not until the shelf
    // is nearly empty. Being below the last window's sales is not a reason to
    // buy; being nearly out is. See SUGGEST_AT_OR_BELOW.
    const empty = entry.stock <= 0
    if (!empty && entry.stock > SUGGEST_AT_OR_BELOW) continue

    // Null location: this is about the business, not one shelf.
    const sold = unitsSoldAt(sales, entry.variation.id, null, months, now)
    if (sold === 0 && !empty) continue

    const shortfall = Math.max(0, sold - entry.stock)
    if (shortfall <= 0 && !empty) continue

    const { product } = entry
    suggestions.push({
      supplierProductId: product.id,
      variationId: entry.variation.id,
      name: entry.variation.fullName,
      supplierSku: product.supplierSku,
      brandName: product.brandName,
      categoryName: product.categoryName,
      unit: product.unit,
      price: product.price,
      currency: product.currency,
      sold,
      stock: entry.stock,
      shortfall,
      // They will not break a carton, so the minimum wins where it is larger;
      // an empty shelf with no sales behind it is proposed at one.
      suggested: Math.max(shortfall, product.moq ?? 0, empty ? 1 : 0),
      // Nothing on the shelf covers nothing, however briskly it sells.
      daysOfCover: empty ? 0 : entry.stock / (sold / windowDays),
    })
  }

  // Emptiest shelf first: what runs out soonest is what needs deciding first.
  return suggestions.sort((a, b) => a.daysOfCover - b.daysOfCover)
}
