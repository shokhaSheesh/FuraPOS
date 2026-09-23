import { describe, expect, it } from 'vitest'
import type { VariationRow } from '@/features/products/model/product'
import { buildPurchaseRows } from './purchaseRows'

const variation = (id: string, stock: Record<string, number> = {}) =>
  ({
    id,
    productId: `p-${id}`,
    costPrice: 10,
    costCurrency: 'USD',
    stockByLocation: Object.entries(stock).map(([locationId, quantity]) => ({
      locationId,
      quantity,
    })),
  }) as unknown as VariationRow

const none = () => ({ 1: 0, 3: 0 })

describe('buildPurchaseRows', () => {
  it('offers their price until a line is on the document, then keeps the agreed one', () => {
    const a = variation('a', { 'loc-1': 4 })
    const b = variation('b')
    const rows = buildPurchaseRows({
      offers: [
        { variation: a, price: 12, currency: 'USD', supplierSku: 'AK-1' },
        { variation: b, price: 20, currency: 'UZS', supplierSku: 'AK-2' },
      ],
      lines: [{ variationId: 'b', quantity: 3, unitCost: 18, costCurrency: 'UZS', expected: 5 }],
      variations: [a, b],
      locationId: 'loc-1',
      demandOf: none,
    })
    expect(rows.map((r) => [r.key, r.quantity, r.unitCost, r.supplierSku])).toEqual([
      ['a', 0, 12, 'AK-1'],
      ['b', 3, 18, 'AK-2'],
    ])
    expect(rows[0]!.atLocation).toBe(4)
    expect(rows[1]!.expected).toBe(5)
  })

  it('keeps a line whose product is no longer offered, first', () => {
    const a = variation('a')
    const gone = variation('gone')
    const rows = buildPurchaseRows({
      offers: [{ variation: a, price: 1, currency: 'USD', supplierSku: null }],
      lines: [
        { variationId: 'gone', quantity: 2, unitCost: 9, costCurrency: 'USD', expected: null },
      ],
      variations: [a, gone],
      locationId: 'loc-1',
      demandOf: none,
    })
    expect(rows.map((r) => r.key)).toEqual(['gone', 'a'])
  })

  it('lists a variation once even when the price list names it twice', () => {
    const a = variation('a')
    const offer = { variation: a, price: 1, currency: 'USD' as const, supplierSku: null }
    const rows = buildPurchaseRows({
      offers: [offer, offer],
      lines: [],
      variations: [a],
      locationId: 'loc-1',
      demandOf: none,
    })
    expect(rows).toHaveLength(1)
  })
})
