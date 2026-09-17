import { describe, expect, it } from 'vitest'
import { buildProductFieldColumns } from '../components/productFieldColumns'
import type { VariationRow } from './product'
import { PRODUCT_FILTER_DEFAULTS, productFilterFields } from './productFilterFields'

describe('the product search panel offers every product-list field', () => {
  const columns = buildProductFieldColumns<VariationRow>({
    variationOf: (row) => row,
    canSeeCost: true,
  })
  const fields = productFilterFields([], { canSeeCost: true, locations: [] })

  it('has a field for each column, in the same order', () => {
    expect(fields.map((field) => field.id)).toEqual(columns.map((column) => column.id))
  })

  it('names each field the way the list heads its column', () => {
    const headers = Object.fromEntries(columns.map((column) => [column.id, column.header]))
    // The image column has no words to filter by, so it asks whether there is one.
    for (const field of fields.filter((f) => f.id !== 'image')) {
      expect(field.label).toBe(headers[field.id])
    }
  })

  it('hides supplier price from roles that may not see what we pay', () => {
    const hidden = productFilterFields([], { canSeeCost: false, locations: [] })
    expect(hidden.map((field) => field.id)).not.toContain('costPrice')
  })

  it('opens with fields that exist', () => {
    const ids = fields.map((field) => field.id)
    for (const id of PRODUCT_FILTER_DEFAULTS) expect(ids).toContain(id)
  })
})
