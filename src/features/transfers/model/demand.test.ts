import { describe, expect, it } from 'vitest'
import { demandAt, hasStalled, unitsSoldAt } from './demand'
import type { Sale } from '@/features/sales/model/sale'

const NOW = new Date('2026-09-12T12:00:00Z').getTime()
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString()

type TestSale = Pick<Sale, 'status' | 'locationId' | 'createdAt' | 'lines'>

const sale = (over: Partial<TestSale> & { quantity?: number; variationId?: string }): TestSale => ({
  status: over.status ?? 'completed',
  locationId: over.locationId ?? 'loc-1',
  createdAt: over.createdAt ?? daysAgo(10),
  lines: over.lines ?? [
    {
      id: 'l1',
      variationId: over.variationId ?? 'var-1',
      productId: 'prd-1',
      sku: 'SKU-1',
      name: 'Brake disc',
      brandName: null,
      categoryName: 'Brakes',
      imageUrl: null,
      unit: 'pcs',
      quantity: over.quantity ?? 1,
      unitPrice: 100_000,
      discountPercent: 0,
    },
  ],
})

describe('unitsSoldAt', () => {
  it('adds up the quantity sold at one location', () => {
    const sales = [sale({ quantity: 3 }), sale({ quantity: 2 })]
    expect(unitsSoldAt(sales, 'var-1', 'loc-1', 3, NOW)).toBe(5)
  })

  it('ignores sales made somewhere else', () => {
    const sales = [sale({ quantity: 3 }), sale({ quantity: 9, locationId: 'loc-2' })]
    expect(unitsSoldAt(sales, 'var-1', 'loc-1', 3, NOW)).toBe(3)
  })

  it('counts every location when none is given', () => {
    const sales = [sale({ quantity: 3 }), sale({ quantity: 9, locationId: 'loc-2' })]
    expect(unitsSoldAt(sales, 'var-1', null, 3, NOW)).toBe(12)
  })

  it('ignores another product on the same sale', () => {
    const sales = [sale({ quantity: 4, variationId: 'var-2' })]
    expect(unitsSoldAt(sales, 'var-1', 'loc-1', 3, NOW)).toBe(0)
  })

  it('ignores a deleted sale — a cancellation is not demand', () => {
    const sales = [sale({ quantity: 5, status: 'deleted' })]
    expect(unitsSoldAt(sales, 'var-1', 'loc-1', 3, NOW)).toBe(0)
  })

  it('stops at the edge of the window', () => {
    const sales = [
      sale({ quantity: 2, createdAt: daysAgo(89) }),
      sale({ quantity: 7, createdAt: daysAgo(91) }),
    ]
    // Three months is 90 days, so the older sale falls outside it.
    expect(unitsSoldAt(sales, 'var-1', 'loc-1', 3, NOW)).toBe(2)
    expect(unitsSoldAt(sales, 'var-1', 'loc-1', 6, NOW)).toBe(9)
  })
})

describe('demandAt', () => {
  it('reports both windows, the longer one containing the shorter', () => {
    const sales = [
      sale({ quantity: 4, createdAt: daysAgo(10) }),
      sale({ quantity: 6, createdAt: daysAgo(120) }),
    ]
    expect(demandAt(sales, 'var-1', 'loc-1', NOW)).toEqual({ 3: 4, 6: 10 })
  })
})

describe('hasStalled', () => {
  it('flags a part that sold months ago and has since stopped', () => {
    expect(hasStalled({ 3: 0, 6: 12 })).toBe(true)
  })

  it('does not flag one still moving', () => {
    expect(hasStalled({ 3: 5, 6: 12 })).toBe(false)
  })

  it('does not flag one that has never sold', () => {
    expect(hasStalled({ 3: 0, 6: 0 })).toBe(false)
  })
})
