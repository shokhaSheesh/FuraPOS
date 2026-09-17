import type { FilterField } from '@/shared/lib/fieldFilters'
import { plainText } from '@/shared/ui/RichTextEditor'
import { USD_RATE } from '@/data/seed'
import { costInUzs, type VariationRow } from './product'

const distinct = (values: (string | null | undefined)[]) =>
  [...new Set(values.filter((value): value is string => Boolean(value)))]
    .sort((a, b) => a.localeCompare(b))
    .map((value) => ({ value, label: value }))

/**
 * What the product list's search bar can filter by — one entry per column of
 * the list, keyed by the column's own id and named with its heading, so the
 * panel reads like the table it filters. A test holds the two together.
 *
 * Choices are read from the catalogue itself, so a list only ever offers what
 * something actually has.
 *
 * Prices are compared in UZS: a catalogue mixes USD and UZS lines, and
 * "under 1 000 000" has to mean the same thing for both.
 */
export function productFilterFields(
  variations: VariationRow[],
  {
    canSeeCost,
    locations,
  }: { canSeeCost: boolean; locations: readonly { id: string; name: string }[] },
): FilterField<VariationRow>[] {
  const fields: FilterField<VariationRow>[] = [
    { id: 'image', label: 'Has image', type: 'boolean', get: (v) => v.imageUrl },
    { id: 'productName', label: 'Product name', type: 'text', get: (v) => v.productName },
    { id: 'name', label: 'Variation name', type: 'text', get: (v) => v.name },
    { id: 'sku', label: 'SKU', type: 'text', get: (v) => v.sku },
    { id: 'barcode', label: 'Barcode', type: 'text', get: (v) => v.barcode },
    { id: 'stock', label: 'Quantity', type: 'range', get: (v) => v.stock },
    {
      id: 'location',
      label: 'Location',
      type: 'options',
      // Where it is actually held, as the Location column shows.
      get: (v) => v.stockByLocation.filter((s) => s.quantity > 0).map((s) => s.locationId),
      options: locations.map((l) => ({ value: l.id, label: l.name })),
    },
    { id: 'shelfAddress', label: 'Storage address', type: 'text', get: (v) => v.shelfAddress },
    {
      id: 'salePrice',
      label: 'Sale price',
      type: 'range',
      unit: 'UZS',
      get: (v) => (v.saleCurrency === 'USD' ? v.salePrice * USD_RATE : v.salePrice),
    },
    {
      id: 'costPrice',
      label: 'Supplier price',
      type: 'range',
      unit: 'UZS',
      get: (v) => costInUzs(v, USD_RATE),
    },
    {
      id: 'brandName',
      label: 'Supplier',
      type: 'options',
      get: (v) => v.brandName,
      options: distinct(variations.map((v) => v.brandName)),
    },
    {
      id: 'categoryPath',
      label: 'Category',
      type: 'options',
      get: (v) => v.categoryPath,
      options: distinct(variations.map((v) => v.categoryPath)),
    },
    { id: 'partSide', label: 'Part', type: 'text', get: (v) => v.partSide },
    { id: 'oem', label: 'OEM', type: 'text', get: (v) => v.oem },
    {
      id: 'vehicleMakes',
      label: 'Make',
      type: 'options',
      get: (v) => v.vehicleMakes,
      options: distinct(variations.flatMap((v) => v.vehicleMakes)),
    },
    {
      id: 'vehicleModels',
      label: 'Model',
      type: 'options',
      get: (v) => v.vehicleModels,
      options: distinct(variations.flatMap((v) => v.vehicleModels)),
    },
    {
      id: 'manufacturer',
      label: 'Product brand',
      type: 'options',
      get: (v) => v.manufacturer,
      options: distinct(variations.map((v) => v.manufacturer)),
    },
    {
      id: 'categoryName',
      label: 'End category',
      type: 'options',
      get: (v) => v.categoryName,
      options: distinct(variations.map((v) => v.categoryName)),
    },
    {
      id: 'cargoWeightKg',
      label: 'Cargo weight',
      type: 'range',
      unit: 'kg',
      get: (v) => v.cargoWeightKg,
    },
    { id: 'cargoSize', label: 'Cargo size', type: 'text', get: (v) => v.cargoSize },
    {
      id: 'description',
      label: 'Description',
      type: 'text',
      get: (v) => plainText(v.description ?? ''),
    },
  ]
  return canSeeCost ? fields : fields.filter((field) => field.id !== 'costPrice')
}

/** What the panel opens with — the fields OX opens with, in our names. */
export const PRODUCT_FILTER_DEFAULTS = [
  'productName',
  'name',
  'barcode',
  'sku',
  'categoryPath',
  'brandName',
  'vehicleMakes',
  'vehicleModels',
]
