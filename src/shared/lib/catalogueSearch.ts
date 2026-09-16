import { matches } from '@/data/query'
import type { VariationRow } from '@/features/products/model/product'

/**
 * One product in the add-mode dropdown, already shaped for display.
 *
 * Pages build these from whatever they pick from — our catalogue, or a
 * supplier's — so the dropdown itself never needs to know which.
 */
export interface CatalogueHit {
  id: string
  name: string
  imageUrl: string | null
  /** Barcode and SKU-like codes, shown with a barcode mark. */
  codes: string[]
  /** Everything else worth reading at a glance: fits, category, brand, OEM. */
  details: string[]
  /** Price, already formatted. */
  price: string
  /** A short note beside the price — stock here, "New to us". */
  note?: { text: string; tone: 'muted' | 'danger' | 'info' }
  /** Listed but not addable, with the reason in the note. */
  disabled?: boolean
}

/** How many results the dropdown shows; a scan or a precise search needs only one. */
export const HIT_LIMIT = 30

/**
 * Searches our catalogue the way the counter does: name, SKU, barcode, OEM
 * number, brand and what it fits. An exact barcode or SKU match comes first,
 * because that is what a scanner types.
 */
export function searchVariations(variations: VariationRow[], term: string): VariationRow[] {
  const wanted = term.trim()
  if (!wanted) return []
  const lower = wanted.toLowerCase()
  const found = variations.filter(
    (v) =>
      v.status === 'active' &&
      matches(
        [v.fullName, v.sku, v.barcode, v.oem, v.brandName, v.vehicleMake, ...v.vehicleModels],
        wanted,
      ),
  )
  const exact = (v: VariationRow) =>
    v.barcode?.toLowerCase() === lower || v.sku.toLowerCase() === lower ? 0 : 1
  return found.sort((a, b) => exact(a) - exact(b)).slice(0, HIT_LIMIT)
}

/** The details line for one of our variations. */
export const variationDetails = (v: VariationRow) =>
  [
    v.vehicleMake,
    v.vehicleModels.length ? v.vehicleModels.join(', ') : null,
    v.categoryName,
    v.brandName,
    v.oem ? `OEM ${v.oem}` : null,
  ].filter(Boolean) as string[]
