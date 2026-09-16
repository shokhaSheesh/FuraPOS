import { describe, expect, it } from 'vitest'
import type { CatalogueEntry } from '@/features/suppliers/model/catalogue'
import type { VariationRow } from '@/features/products/model/product'
import { planCatalogueRows } from './lineRows'
import type { ReceiptLine } from './receipt'

const line = (id: string, variationId: string): ReceiptLine => ({
  id,
  variationId,
  productId: 'prd-1',
  sku: 'SKU-1',
  name: 'A part',
  imageUrl: null,
  unit: 'pcs',
  orderedQuantity: 0,
  receivedQuantity: 5,
  unitCost: 100,
  costCurrency: 'UZS',
})

const entry = (id: string, variationId: string | null): CatalogueEntry => ({
  product: {
    id,
    supplierId: 'sup-1',
    supplierSku: id.toUpperCase(),
    name: 'They call it this',
    brandName: null,
    categoryName: null,
    unit: 'pcs',
    price: 12,
    currency: 'USD',
    moq: null,
    variationId,
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  variation: variationId ? ({ id: variationId } as VariationRow) : null,
  stock: 0,
})

describe('laying out a supplier receipt', () => {
  it('lists every product they sell, in their order, received or not', () => {
    const plan = planCatalogueRows([], [entry('sp-1', 'var-1'), entry('sp-2', 'var-2')])
    expect(plan.map((row) => row.key)).toEqual(['sp-1', 'sp-2'])
    expect(plan.every((row) => row.lineIndex === -1)).toBe(true)
  })

  it('attaches a received line to the catalogue row it came from', () => {
    const plan = planCatalogueRows(
      [line('grl-1', 'var-2')],
      [entry('sp-1', 'var-1'), entry('sp-2', 'var-2')],
    )
    expect(plan.map((row) => [row.key, row.lineIndex])).toEqual([
      ['sp-1', -1],
      ['sp-2', 0],
    ])
  })

  it('keeps a received line they no longer list, and puts it first', () => {
    // A supplier drops something from their price list. The delivery already
    // booked against it has moved stock, so a row nobody can see is a row
    // nobody can correct — it stays, at the top where it is noticed.
    const plan = planCatalogueRows([line('grl-1', 'var-9')], [entry('sp-1', 'var-1')])
    expect(plan.map((row) => [row.key, row.lineIndex])).toEqual([
      ['grl-1', 0],
      ['sp-1', -1],
    ])
    expect(plan[0]!.entry).toBeNull()
  })

  it('never attaches a line to something they list but we have never stocked', () => {
    // Their "new to us" lines have no variation, so nothing can match them —
    // and matching them to each other by accident would receive stock against
    // a product that does not exist.
    const plan = planCatalogueRows(
      [line('grl-1', 'var-1')],
      [entry('sp-new-1', null), entry('sp-new-2', null)],
    )
    expect(plan.filter((row) => row.entry !== null).every((row) => row.lineIndex === -1)).toBe(true)
    expect(plan[0]!.key).toBe('grl-1')
  })
})
