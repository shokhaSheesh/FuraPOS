import type { Id, IsoDate } from '@/shared/types'
import type { VariationRow } from '@/features/products/model/product'

/**
 * What a supplier says they sell.
 *
 * This is **their** catalogue, not ours. Each supplier signs in to their own
 * portal and lists what they carry, so ordering starts from what is actually
 * on offer rather than from our shelf — which is the difference between "what
 * do we need" and "what can this company send us".
 *
 * The two catalogues meet at `variationId`. Most of what a supplier lists is
 * something we already stock, and that link is what lets an order line know
 * our stock and what it has been selling. A supplier listing something new to
 * us is normal and kept: it is how the range grows. It simply has no history
 * behind it yet, so nothing can be suggested about it.
 */
export interface SupplierProduct {
  id: Id
  supplierId: Id
  /** Their code for it, which is what goes on their invoice — not our SKU. */
  supplierSku: string
  name: string
  brandName: string | null
  categoryName: string | null
  unit: string
  /** What they are asking, in their currency. */
  price: number
  currency: 'USD' | 'UZS'
  /** The smallest quantity they will accept. */
  moq: number | null
  /** Our variation when we already carry it; null when it is new to us. */
  variationId: Id | null
  updatedAt: IsoDate
}

/** A supplier's line with our own numbers attached, which is what the order screen lists. */
export interface CatalogueEntry {
  product: SupplierProduct
  /** Our variation, when their line points at something we stock. */
  variation: VariationRow | null
  /** Units we hold across every location. */
  stock: number
}

export function catalogueFor(
  products: SupplierProduct[],
  variations: VariationRow[],
  supplierId: string,
): CatalogueEntry[] {
  const byId = new Map(variations.map((variation) => [variation.id, variation]))
  return products
    .filter((product) => product.supplierId === supplierId)
    .map((product) => {
      const variation = product.variationId ? (byId.get(product.variationId) ?? null) : null
      return { product, variation, stock: variation?.stock ?? 0 }
    })
}

/** The headline above the list: how much this supplier actually offers. */
export interface CatalogueSummary {
  products: number
  categories: string[]
  brands: string[]
  /** Lines they list that we have never stocked. */
  newToUs: number
}

export function summariseCatalogue(entries: CatalogueEntry[]): CatalogueSummary {
  return {
    products: entries.length,
    categories: [...new Set(entries.map((e) => e.product.categoryName).filter(Boolean))] as string[],
    brands: [...new Set(entries.map((e) => e.product.brandName).filter(Boolean))] as string[],
    newToUs: entries.filter((e) => e.variation === null).length,
  }
}
