import type { VariationRow } from '@/features/products/model/product'
import type { CatalogueRow } from './browse'

type Currency = 'USD' | 'UZS'

/**
 * A row of a purchase document's product step — an order or a goods receipt.
 *
 * Both buy goods in, so both pick the same way: out of a catalogue (a
 * supplier's own, or ours for a market run or a factory), with a price per
 * variation that starts at what is being asked and is ours to change.
 */
export interface PurchaseRow extends CatalogueRow {
  unitCost: number
  costCurrency: Currency
  /** Their code for it, which is what their paperwork says — not our SKU. */
  supplierSku: string | null
  /** What the landing location holds now. */
  atLocation: number
  /** What was expected, from the order behind a delivery. Null when nothing was. */
  expected: number | null
  /** The supplier put it on their price list lately — the card marks it «Новинка». */
  newFromSupplier: boolean
}

/** How recently a supplier has to have listed something for it to read as new. */
export const NEW_FOR_DAYS = 45

export const listedRecently = (listedAt: string | null | undefined, now = Date.now()) =>
  Boolean(listedAt && now - new Date(listedAt).getTime() <= NEW_FOR_DAYS * 86_400_000)

/** Something on offer: a line of a supplier's catalogue, or of ours. */
export interface PurchaseOffer {
  variation: VariationRow
  price: number
  currency: Currency
  supplierSku: string | null
  /** When the supplier last listed it, where they keep a price list of their own. */
  listedAt?: string | null
}

/** A line already on the document, in the terms both documents share. */
export interface PurchaseLineInput {
  variationId: string
  quantity: number
  unitCost: number
  costCurrency: Currency
  expected: number | null
}

/**
 * Everything on offer, with what is already on the document laid over it.
 *
 * A line whose product is no longer on offer — a supplier dropped it from their
 * price list — is still a row: stock has been ordered or booked against it, and
 * a line nobody can see is a line nobody can correct.
 */
export function buildPurchaseRows({
  offers,
  lines,
  variations,
  locationId,
  demandOf,
}: {
  offers: PurchaseOffer[]
  lines: PurchaseLineInput[]
  variations: VariationRow[]
  locationId: string
  demandOf: (variationId: string) => { 3: number; 6: number }
}): PurchaseRow[] {
  const lineOf = new Map(lines.map((line) => [line.variationId, line]))
  const seen = new Set<string>()
  const atLocation = (variation: VariationRow) =>
    variation.stockByLocation.find((s) => s.locationId === locationId)?.quantity ?? 0

  const row = (variation: VariationRow, offer: PurchaseOffer | null): PurchaseRow => {
    const line = lineOf.get(variation.id)
    return {
      key: variation.id,
      variation,
      quantity: line?.quantity ?? 0,
      demand: demandOf(variation.id),
      // Their asking price until it is on the document; after that, whatever was agreed.
      unitCost: line?.unitCost ?? offer?.price ?? variation.costPrice,
      costCurrency: line?.costCurrency ?? offer?.currency ?? variation.costCurrency,
      supplierSku: offer?.supplierSku ?? null,
      atLocation: atLocation(variation),
      expected: line?.expected ?? null,
      newFromSupplier: listedRecently(offer?.listedAt),
    }
  }

  const offered = offers
    .filter((offer) => {
      // One row per variation, even if a price list names it twice.
      if (seen.has(offer.variation.id)) return false
      seen.add(offer.variation.id)
      return true
    })
    .map((offer) => row(offer.variation, offer))

  const byId = new Map(variations.map((v) => [v.id, v]))
  const orphans = lines
    .filter((line) => !seen.has(line.variationId))
    .flatMap((line) => {
      const variation = byId.get(line.variationId)
      return variation ? [row(variation, null)] : []
    })

  return [...orphans, ...offered]
}
