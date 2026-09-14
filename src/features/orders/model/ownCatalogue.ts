import type { VariationRow } from '@/features/products/model/product'
import type { CatalogueEntry } from '@/features/suppliers/model/catalogue'

/**
 * Our own catalogue, in the shape the order screen browses.
 *
 * A market purchase has no supplier and so no catalogue of theirs to start
 * from — the buyer walks the bazaar with our list in hand. Rather than build a
 * second browser for that, our variations are presented as catalogue lines:
 * the code is our SKU, the price is what it last cost us, and every line points
 * at itself. The screen, the filters and the suggestion maths then work
 * unchanged, which is the point — two ways of ordering should not be two
 * different screens to learn.
 */
export function ownCatalogue(variations: VariationRow[]): CatalogueEntry[] {
  return variations
    .filter((variation) => variation.status === 'active')
    .map((variation) => ({
      product: {
        id: variation.id,
        supplierId: '',
        supplierSku: variation.sku,
        name: variation.fullName,
        brandName: variation.brandName,
        categoryName: variation.categoryName,
        unit: variation.unit,
        price: variation.costPrice,
        currency: variation.costCurrency,
        moq: null,
        variationId: variation.id,
        updatedAt: new Date().toISOString(),
      },
      variation,
      stock: variation.stock,
    }))
}
