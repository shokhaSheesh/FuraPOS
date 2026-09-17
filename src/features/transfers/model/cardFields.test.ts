import { describe, expect, it } from 'vitest'
import {
  buildProductFieldColumns,
  PRODUCT_FIELD_COLUMN_IDS,
} from '@/features/products/components/productFieldColumns'
import type { VariationRow } from '@/features/products/model/product'
import { ALWAYS_ON_CARD, CATALOGUE_CARD_FIELDS } from './cardFields'

/**
 * The client rule, for the transfer's product cards: every field of the
 * product list can be put on a card. This is what stops the card's choices
 * falling behind when the catalogue gains a field.
 */
describe('a transfer card offers every product-list field', () => {
  it('has a choice for each field, in the catalogue’s order', () => {
    expect(CATALOGUE_CARD_FIELDS.map((field) => field.id)).toEqual(
      PRODUCT_FIELD_COLUMN_IDS.filter((id) => !ALWAYS_ON_CARD.includes(id)),
    )
  })

  it('names each field the way the product list does', () => {
    const headers = Object.fromEntries(
      buildProductFieldColumns<VariationRow>({ variationOf: (row) => row, canSeeCost: true }).map(
        (column) => [column.id, column.header],
      ),
    )
    for (const field of CATALOGUE_CARD_FIELDS) expect(field.label).toBe(headers[field.id])
  })

  it('shows a value once when variations share it, and a range when prices differ', () => {
    const variation = (salePrice: number, sku: string) =>
      ({ salePrice, saleCurrency: 'UZS', sku, manufacturer: 'Space' }) as unknown as VariationRow
    const pair = [variation(100, 'A'), variation(300, 'B')]
    const field = (id: string) => CATALOGUE_CARD_FIELDS.find((f) => f.id === id)!
    expect(field('manufacturer').value(pair)).toBe('Space')
    expect(field('sku').value(pair)).toBe('A, B')
    expect(field('salePrice').value(pair)).toContain('–')
  })
})
