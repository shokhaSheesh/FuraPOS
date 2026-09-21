import type { VariationRow } from '@/features/products/model/product'
import type { SaleLine } from '@/features/sales/model/sale'

/**
 * The till's cart: one line per variation, however it got there — a tap on a
 * card, a variation picked in the dialog, or a barcode scanned. Adding the same
 * part again is one more of it, never a second line.
 *
 * Quantities are capped at what the shelf holds, because a till that lets you
 * sell ten of something with four on the shelf is a till that lies about stock.
 */

export function lineFor(variation: VariationRow, quantity: number): SaleLine {
  return {
    id: `pos-${variation.id}`,
    variationId: variation.id,
    productId: variation.productId,
    sku: variation.sku,
    name: variation.fullName,
    brandName: variation.brandName,
    categoryName: variation.categoryName,
    imageUrl: variation.imageUrl,
    unit: variation.unit,
    quantity,
    unitPrice: variation.salePrice,
    discountPercent: 0,
  }
}

/** Sets how many of a variation are in the cart; zero takes the line out. */
export function setQuantity(
  cart: SaleLine[],
  variation: VariationRow,
  quantity: number,
  available: number,
): SaleLine[] {
  const next = Math.max(0, Math.min(available, Math.floor(quantity)))
  const at = cart.findIndex((line) => line.variationId === variation.id)
  if (at === -1) return next > 0 ? [...cart, lineFor(variation, next)] : cart
  if (next === 0) return cart.filter((_, index) => index !== at)
  return cart.map((line, index) => (index === at ? { ...line, quantity: next } : line))
}

/** One more of a variation — a tap, or a scan. */
export function addOne(cart: SaleLine[], variation: VariationRow, available: number): SaleLine[] {
  const current = cart.find((line) => line.variationId === variation.id)?.quantity ?? 0
  return setQuantity(cart, variation, current + 1, available)
}

export const quantityIn = (cart: SaleLine[], variationId: string) =>
  cart.find((line) => line.variationId === variationId)?.quantity ?? 0

export const unitsIn = (cart: SaleLine[]) => cart.reduce((sum, line) => sum + line.quantity, 0)
