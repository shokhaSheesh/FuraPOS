import { describe, expect, it } from 'vitest'
import { suggestTransfer } from './suggest'
import type { VariationRow } from '@/features/products/model/product'
import type { Sale } from '@/features/sales/model/sale'

const NOW = new Date('2026-09-12T12:00:00Z').getTime()
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString()

const FROM = 'loc-1'
const TO = 'loc-2'

const variation = (over: Partial<VariationRow> & { id: string }): VariationRow =>
  ({
    productId: 'prd-1',
    sku: `SKU-${over.id}`,
    fullName: `Part ${over.id}`,
    imageUrl: null,
    unit: 'pcs',
    status: 'active',
    costPrice: 100,
    costCurrency: 'UZS',
    salePrice: 200,
    stockByLocation: [],
    ...over,
  }) as unknown as VariationRow

type TestSale = Pick<Sale, 'status' | 'locationId' | 'createdAt' | 'lines'>

const sale = (locationId: string, variationId: string, quantity: number, days = 10): TestSale => ({
  status: 'completed',
  locationId,
  createdAt: daysAgo(days),
  lines: [
    {
      id: `l-${variationId}-${days}`,
      variationId,
      productId: 'prd-1',
      sku: 'SKU-1',
      name: 'Part',
      brandName: null,
      categoryName: 'Brakes',
      imageUrl: null,
      unit: 'pcs',
      quantity,
      unitPrice: 200,
      discountPercent: 0,
    },
  ],
})

const run = (variations: VariationRow[], sales: TestSale[], months = 3) =>
  suggestTransfer({ variations, sales, fromLocationId: FROM, toLocationId: TO, months, now: NOW })

describe('suggestTransfer', () => {
  it('proposes nothing for a part the destination has never sold', () => {
    // The warehouse is full of them; the shop has never sold one.
    const v = variation({
      id: 'a',
      stockByLocation: [{ locationId: FROM, locationName: FROM, quantity: 500 }],
    })
    expect(run([v], [])).toEqual([])
  })

  it('proposes what it sold, less what it already holds', () => {
    const v = variation({
      id: 'a',
      stockByLocation: [
        { locationId: FROM, locationName: FROM, quantity: 100 },
        { locationId: TO, locationName: TO, quantity: 0 },
      ],
    })
    // Sold 90 and holds none, so it needs all 90 to trade on.
    const sales = [sale(TO, 'a', 90)]
    const [suggestion] = run([v], sales)
    expect(suggestion?.suggested).toBe(90)
  })

  it('subtracts what the destination already holds', () => {
    const v = variation({
      id: 'a',
      stockByLocation: [
        { locationId: FROM, locationName: FROM, quantity: 100 },
        { locationId: TO, locationName: TO, quantity: 20 },
      ],
    })
    const [suggestion] = run([v], [sale(TO, 'a', 90)])
    expect(suggestion?.suggested).toBe(70)
  })

  it('proposes nothing when the destination already holds what it sells', () => {
    const v = variation({
      id: 'a',
      stockByLocation: [
        { locationId: FROM, locationName: FROM, quantity: 100 },
        { locationId: TO, locationName: TO, quantity: 90 },
      ],
    })
    expect(run([v], [sale(TO, 'a', 90)])).toEqual([])
  })

  it('leaves the source what it sold, and sends the rest', () => {
    // The client's case: the destination needs more than the source can give,
    // so it sends what it can spare rather than what was asked for.
    const v = variation({
      id: 'a',
      stockByLocation: [
        { locationId: FROM, locationName: FROM, quantity: 100 },
        { locationId: TO, locationName: TO, quantity: 0 },
      ],
    })
    const sales = [sale(TO, 'a', 90), sale(FROM, 'a', 90)]
    const [suggestion] = run([v], sales)
    expect(suggestion?.shortfall).toBe(90)
    expect(suggestion?.suggested).toBe(10)
  })

  it('sends all but what the source sold when it is nearly out', () => {
    // Sold 20 at the shop, 5 there, so 15 short. The warehouse has 5 and sold
    // 1, so it keeps 1 and sends 4.
    const v = variation({
      id: 'a',
      stockByLocation: [
        { locationId: FROM, locationName: FROM, quantity: 5 },
        { locationId: TO, locationName: TO, quantity: 5 },
      ],
    })
    const [suggestion] = run([v], [sale(TO, 'a', 20), sale(FROM, 'a', 1)])
    expect(suggestion?.shortfall).toBe(15)
    expect(suggestion?.suggested).toBe(4)
  })

  it('proposes nothing when the source cannot spare any', () => {
    const v = variation({
      id: 'a',
      stockByLocation: [
        { locationId: FROM, locationName: FROM, quantity: 25 },
        { locationId: TO, locationName: TO, quantity: 0 },
      ],
    })
    // The source sold more than it holds, so it has nothing spare.
    expect(run([v], [sale(TO, 'a', 90), sale(FROM, 'a', 90)])).toEqual([])
  })

  it('proposes nothing when the source has none', () => {
    const v = variation({
      id: 'a',
      stockByLocation: [{ locationId: TO, locationName: TO, quantity: 0 }],
    })
    expect(run([v], [sale(TO, 'a', 90)])).toEqual([])
  })

  it('ignores sales outside the window', () => {
    const v = variation({
      id: 'a',
      stockByLocation: [
        { locationId: FROM, locationName: FROM, quantity: 100 },
        { locationId: TO, locationName: TO, quantity: 0 },
      ],
    })
    expect(run([v], [sale(TO, 'a', 90, 200)])).toEqual([])
  })

  it('ignores a deleted sale — a cancellation is not demand', () => {
    const v = variation({
      id: 'a',
      stockByLocation: [
        { locationId: FROM, locationName: FROM, quantity: 100 },
        { locationId: TO, locationName: TO, quantity: 0 },
      ],
    })
    const deleted = { ...sale(TO, 'a', 90), status: 'deleted' as const }
    expect(run([v], [deleted])).toEqual([])
  })

  it('ignores sales made at a third location', () => {
    const v = variation({
      id: 'a',
      stockByLocation: [
        { locationId: FROM, locationName: FROM, quantity: 100 },
        { locationId: TO, locationName: TO, quantity: 0 },
      ],
    })
    expect(run([v], [sale('loc-9', 'a', 90)])).toEqual([])
  })

  it('puts the emptiest shelf first', () => {
    const a = variation({
      id: 'a',
      stockByLocation: [
        { locationId: FROM, locationName: FROM, quantity: 100 },
        { locationId: TO, locationName: TO, quantity: 20 },
      ],
    })
    const b = variation({
      id: 'b',
      stockByLocation: [
        { locationId: FROM, locationName: FROM, quantity: 100 },
        { locationId: TO, locationName: TO, quantity: 1 },
      ],
    })
    const order = run([a, b], [sale(TO, 'a', 90), sale(TO, 'b', 90)]).map((s) => s.variationId)
    expect(order).toEqual(['b', 'a'])
  })

  it('returns nothing when both ends are the same place', () => {
    const v = variation({
      id: 'a',
      stockByLocation: [{ locationId: FROM, locationName: FROM, quantity: 100 }],
    })
    const result = suggestTransfer({
      variations: [v],
      sales: [sale(FROM, 'a', 90)],
      fromLocationId: FROM,
      toLocationId: FROM,
      months: 3,
      now: NOW,
    })
    expect(result).toEqual([])
  })

  it('skips an archived product', () => {
    const v = variation({
      id: 'a',
      status: 'archived',
      stockByLocation: [
        { locationId: FROM, locationName: FROM, quantity: 100 },
        { locationId: TO, locationName: TO, quantity: 0 },
      ],
    })
    expect(run([v], [sale(TO, 'a', 90)])).toEqual([])
  })
})
