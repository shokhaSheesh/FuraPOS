import { formatMoney, formatNumber } from '@/shared/lib/format'
import { plainText } from '@/shared/ui/RichTextEditor'
import type { VariationRow } from '@/features/products/model/product'

/**
 * What a product card can show, wherever products are picked from cards.
 *
 * The client rule for documents holds here too: wherever products are picked,
 * every field of the product list is available. A card is one *product*, so a
 * field that differs between its variations shows each value once, and a price
 * that differs shows as a range.
 *
 * The list below is keyed by the product list's own column ids and a test
 * compares the two, so a field added to the catalogue cannot go missing from
 * the cards. Image and product name are not in it: every card always shows
 * them.
 */
export type CatalogueCardField =
  | 'name'
  | 'sku'
  | 'barcode'
  | 'stock'
  | 'location'
  | 'shelfAddress'
  | 'salePrice'
  | 'costPrice'
  | 'brandName'
  | 'categoryPath'
  | 'partSide'
  | 'oem'
  | 'vehicleMakes'
  | 'vehicleModels'
  | 'manufacturer'
  | 'categoryName'
  | 'cargoWeightKg'
  | 'cargoSize'
  | 'description'

/** Always on a card, so never offered as a choice. */
export const ALWAYS_ON_CARD = ['image', 'productName']

const EMPTY = '—'

const distinct = (values: (string | null | undefined)[]) =>
  [...new Set(values.filter((value): value is string => Boolean(value)))].join(', ') || EMPTY

const priced = (
  variations: VariationRow[],
  amountOf: (v: VariationRow) => number,
  currencyOf: (v: VariationRow) => 'USD' | 'UZS',
) => {
  const show = (v: VariationRow) =>
    currencyOf(v) === 'USD' ? `${formatNumber(amountOf(v))} USD` : formatMoney(amountOf(v))
  const sorted = [...variations].sort((a, b) => amountOf(a) - amountOf(b))
  const low = show(sorted[0]!)
  const high = show(sorted.at(-1)!)
  return low === high ? low : `${low} – ${high}`
}

export const CATALOGUE_CARD_FIELDS: {
  id: CatalogueCardField
  /** The product list's own heading for the field. */
  label: string
  value: (variations: VariationRow[]) => string
  /** Supplier price is hidden from roles that may not see what we pay. */
  costOnly?: boolean
}[] = [
  { id: 'name', label: 'Variation name', value: (vs) => distinct(vs.map((v) => v.name)) },
  { id: 'sku', label: 'SKU', value: (vs) => distinct(vs.map((v) => v.sku)) },
  { id: 'barcode', label: 'Barcode', value: (vs) => distinct(vs.map((v) => v.barcode)) },
  {
    id: 'stock',
    label: 'Quantity',
    value: (vs) =>
      `${formatNumber(vs.reduce((sum, v) => sum + v.stock, 0))} ${vs[0]?.unit ?? ''}`.trim(),
  },
  {
    id: 'location',
    label: 'Location',
    value: (vs) =>
      distinct(
        vs.flatMap((v) =>
          v.stockByLocation.filter((s) => s.quantity > 0).map((s) => s.locationName),
        ),
      ),
  },
  {
    id: 'shelfAddress',
    label: 'Storage address',
    value: (vs) => distinct(vs.map((v) => v.shelfAddress)),
  },
  {
    id: 'salePrice',
    label: 'Sale price',
    value: (vs) =>
      priced(
        vs,
        (v) => v.salePrice,
        (v) => v.saleCurrency,
      ),
  },
  {
    id: 'costPrice',
    label: 'Supplier price',
    costOnly: true,
    value: (vs) =>
      priced(
        vs,
        (v) => v.costPrice,
        (v) => v.costCurrency,
      ),
  },
  { id: 'brandName', label: 'Supplier', value: (vs) => distinct(vs.map((v) => v.brandName)) },
  { id: 'categoryPath', label: 'Category', value: (vs) => distinct(vs.map((v) => v.categoryPath)) },
  { id: 'partSide', label: 'Part', value: (vs) => distinct(vs.map((v) => v.partSide)) },
  { id: 'oem', label: 'OEM', value: (vs) => distinct(vs.map((v) => v.oem)) },
  { id: 'vehicleMakes', label: 'Make', value: (vs) => distinct(vs.flatMap((v) => v.vehicleMakes)) },
  {
    id: 'vehicleModels',
    label: 'Model',
    value: (vs) => distinct(vs.flatMap((v) => v.vehicleModels)),
  },
  {
    id: 'manufacturer',
    label: 'Product brand',
    value: (vs) => distinct(vs.map((v) => v.manufacturer)),
  },
  {
    id: 'categoryName',
    label: 'End category',
    value: (vs) => distinct(vs.map((v) => v.categoryName)),
  },
  {
    id: 'cargoWeightKg',
    label: 'Cargo weight',
    value: (vs) =>
      distinct(vs.map((v) => (v.cargoWeightKg ? `${formatNumber(v.cargoWeightKg)} kg` : null))),
  },
  { id: 'cargoSize', label: 'Cargo size', value: (vs) => distinct(vs.map((v) => v.cargoSize)) },
  {
    id: 'description',
    label: 'Description',
    value: (vs) => distinct(vs.map((v) => plainText(v.description ?? '') || null)),
  },
]
