import { describe, expect, it } from 'vitest'
import { computeTotals, lineTotal, type SaleLine } from './sale'

const line = (over: Partial<SaleLine> = {}): SaleLine => ({
  id: 'l1',
  productId: 'p1',
  sku: 'SKU-1',
  name: 'Brake disc',
  unit: 'pcs',
  quantity: 2,
  unitPrice: 100_000,
  discountPercent: 0,
  ...over,
})

/**
 * The money rules are the part of a sale nobody may get wrong, so they live in
 * one function and are pinned here.
 */
describe('sale totals', () => {
  it('multiplies quantity by price', () => {
    expect(lineTotal(line())).toBe(200_000)
  })

  it('applies a per-line discount to that line only', () => {
    const totals = computeTotals([line({ discountPercent: 15 }), line({ id: 'l2' })], 0)
    expect(totals.subtotal).toBe(400_000)
    expect(totals.discount).toBe(30_000)
    expect(totals.total).toBe(370_000)
  })

  it('reports change when the customer overpays', () => {
    const totals = computeTotals([line()], 250_000)
    expect(totals.change).toBe(50_000)
    expect(totals.debt).toBe(0)
  })

  it('reports debt when the customer underpays, and never a negative', () => {
    const totals = computeTotals([line()], 120_000)
    expect(totals.debt).toBe(80_000)
    expect(totals.change).toBe(0)
  })

  it('is zero across the board with no lines', () => {
    expect(computeTotals([], 0)).toEqual({
      subtotal: 0,
      discount: 0,
      total: 0,
      change: 0,
      debt: 0,
    })
  })
})
