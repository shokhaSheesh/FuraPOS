import { describe, expect, it } from 'vitest'
import { buildProductFieldColumns } from '../components/productFieldColumns'
import type { VariationRow } from './product'
import { productFilterFields } from './productFilterFields'

describe('the product search panel offers every product-list field', () => {
  const columns = buildProductFieldColumns<VariationRow>({
    variationOf: (row) => row,
    canSeeCost: true,
  })
  const fields = productFilterFields([], { canSeeCost: true, locations: [] })

  it('has a field for each column, in the list’s order', () => {
    // Image moves to the end of the panel; everything else keeps the list's order.
    const ids = columns.map((column) => column.id).filter((id) => id !== 'image')
    expect(fields.map((field) => field.id)).toEqual([...ids, 'image'])
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
})
