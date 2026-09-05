import { describe, expect, it } from 'vitest'
import {
  computeTotals,
  lineTotal,
  nextStep,
  SALE_STATUSES,
  type SaleLine,
  type SaleStatus,
} from './sale'

const line = (over: Partial<SaleLine> = {}): SaleLine => ({
  id: 'l1',
  variationId: 'v1',
  productId: 'p1',
  sku: 'SKU-1',
  name: 'Brake disc',
  brandName: 'Bosch',
  categoryName: 'Brakes',
  imageUrl: null,
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

  it('adds delivery on top of goods, and never discounts it', () => {
    const totals = computeTotals([line({ discountPercent: 50 })], 0, 30_000)
    expect(totals.discount).toBe(100_000)
    expect(totals.deliveryCost).toBe(30_000)
    expect(totals.total).toBe(130_000)
  })

  it('is zero across the board with no lines', () => {
    expect(computeTotals([], 0)).toEqual({
      subtotal: 0,
      discount: 0,
      deliveryCost: 0,
      total: 0,
      change: 0,
      debt: 0,
    })
  })
})

/**
 * The detail page's single primary button is driven entirely by this, so a
 * wrong step here is a wrong button on screen.
 */
describe('sale lifecycle', () => {
  it('walks a delivery order to completion in fixed steps', () => {
    const path: SaleStatus[] = ['open']
    let guard = 0
    while (guard++ < 10) {
      const step = nextStep(path[path.length - 1]!)
      if (!step) break
      path.push(step.to)
    }
    expect(path).toEqual(['open', 'processed', 'delivering', 'delivered', 'completed'])
  })

  it('offers nothing further once a sale is finished or deleted', () => {
    expect(nextStep('completed')).toBeNull()
    expect(nextStep('deleted')).toBeNull()
  })

  it('treats a postponed sale as resumable', () => {
    expect(nextStep('postponed')?.to).toBe('processed')
  })
})

describe('status catalogue', () => {
  /**
   * The chips, the badges and the detail page all read SALE_STATUSES. Adding a
   * status to the union without adding it here would silently drop it from the
   * filters, so the two are pinned together.
   */
  it('carries a label and tone for every status in the union', () => {
    const every: Record<SaleStatus, true> = {
      open: true,
      new: true,
      processed: true,
      delivering: true,
      delivered: true,
      completed: true,
      postponed: true,
      deleted: true,
    }
    expect(SALE_STATUSES.map((s) => s.value).sort()).toEqual(Object.keys(every).sort())
    expect(SALE_STATUSES.every((s) => s.label && s.tone)).toBe(true)
  })

  it('treats deleted as terminal — a deleted sale offers no next step', () => {
    expect(nextStep('deleted')).toBeNull()
  })
})
