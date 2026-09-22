import { describe, expect, it } from 'vitest'
import { suggestOrder } from './suggestOrder'
import type { CatalogueEntry } from '@/features/suppliers/model/catalogue'
import type { Sale } from '@/features/sales/model/sale'

const NOW = new Date('2026-09-12T12:00:00Z').getTime()
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString()

const entry = (over: {
  id: string
  variationId: string | null
  stock: number
  moq?: number | null
}): CatalogueEntry =>
  ({
    product: {
      id: over.id,
      supplierId: 'sup-1',
      supplierSku: `S-${over.id}`,
      name: `Part ${over.id}`,
      brandName: 'Bosch',
      categoryName: 'Brakes',
      unit: 'pcs',
      price: 10,
      currency: 'USD',
      moq: over.moq ?? null,
      variationId: over.variationId,
      updatedAt: daysAgo(10),
    },
    variation: over.variationId
      ? ({ id: over.variationId, fullName: `Part ${over.id}`, stock: over.stock } as never)
      : null,
    stock: over.stock,
  }) as CatalogueEntry

type TestSale = Pick<Sale, 'status' | 'locationId' | 'createdAt' | 'lines'>

const sale = (
  variationId: string,
  quantity: number,
  days = 10,
  locationId = 'loc-1',
): TestSale => ({
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

const run = (entries: CatalogueEntry[], sales: TestSale[], months = 3) =>
  suggestOrder({ entries, sales, months, now: NOW })

describe('suggestOrder', () => {
  it('orders the difference between what sold and what is left', () => {
    // The client's case: sold 20 over three months, 2 left, so 18 short.
    const [suggestion] = run(
      [entry({ id: 'a', variationId: 'var-a', stock: 2 })],
      [sale('var-a', 20)],
    )
    expect(suggestion?.sold).toBe(20)
    expect(suggestion?.stock).toBe(2)
    expect(suggestion?.suggested).toBe(18)
  })

  it('suggests nothing when the shelf already covers what sold', () => {
    expect(run([entry({ id: 'a', variationId: 'var-a', stock: 25 })], [sale('var-a', 20)])).toEqual(
      [],
    )
  })

  it('suggests nothing for a stocked part that has not sold', () => {
    // A full warehouse of something nobody buys is not a reason to buy more.
    expect(run([entry({ id: 'a', variationId: 'var-a', stock: 25 })], [])).toEqual([])
  })

  it('proposes a variation that is out of stock, even with nothing sold behind it', () => {
    // The client's case: a part with a left and a right, the left run out.
    // It cannot sell what it has none of, so being empty is reason enough.
    const [suggestion] = run([entry({ id: 'a', variationId: 'var-a', stock: 0 })], [])
    expect(suggestion?.suggested).toBe(1)
    expect(suggestion?.daysOfCover).toBe(0)

    const [carton] = run([entry({ id: 'b', variationId: 'var-b', stock: 0, moq: 20 })], [])
    expect(carton?.suggested).toBe(20)
  })

  it('puts an empty shelf before one that still has a few', () => {
    const entries = [
      entry({ id: 'a', variationId: 'var-a', stock: 2 }),
      entry({ id: 'b', variationId: 'var-b', stock: 0 }),
    ]
    expect(run(entries, [sale('var-a', 20)]).map((s) => s.supplierProductId)).toEqual(['b', 'a'])
  })

  it('skips what the supplier lists but we have never stocked', () => {
    // No variation means no sales history, so there is nothing to reason from.
    expect(run([entry({ id: 'a', variationId: null, stock: 0 })], [sale('var-a', 20)])).toEqual([])
  })

  it('raises the quantity to the supplier minimum when they will not break a carton', () => {
    const [suggestion] = run(
      [entry({ id: 'a', variationId: 'var-a', stock: 2, moq: 50 })],
      [sale('var-a', 20)],
    )
    expect(suggestion?.shortfall).toBe(18)
    expect(suggestion?.suggested).toBe(50)
  })

  it('counts sales from every location, because an order refills the business', () => {
    const sales = [sale('var-a', 12, 10, 'loc-1'), sale('var-a', 8, 20, 'loc-2')]
    const [suggestion] = run([entry({ id: 'a', variationId: 'var-a', stock: 2 })], sales)
    expect(suggestion?.sold).toBe(20)
    expect(suggestion?.suggested).toBe(18)
  })

  it('ignores sales outside the window', () => {
    expect(
      run([entry({ id: 'a', variationId: 'var-a', stock: 2 })], [sale('var-a', 20, 200)]),
    ).toEqual([])
  })

  it('reads six months when asked for six', () => {
    const sales = [sale('var-a', 20, 10), sale('var-a', 10, 150)]
    expect(run([entry({ id: 'a', variationId: 'var-a', stock: 2 })], sales, 3)[0]?.sold).toBe(20)
    expect(run([entry({ id: 'a', variationId: 'var-a', stock: 2 })], sales, 6)[0]?.sold).toBe(30)
  })

  it('ignores a cancelled sale, which is not demand', () => {
    const deleted = { ...sale('var-a', 20), status: 'deleted' as const }
    expect(run([entry({ id: 'a', variationId: 'var-a', stock: 2 })], [deleted])).toEqual([])
  })

  it('puts the part that runs out soonest first', () => {
    const entries = [
      entry({ id: 'a', variationId: 'var-a', stock: 3 }),
      entry({ id: 'b', variationId: 'var-b', stock: 1 }),
    ]
    const sales = [sale('var-a', 20), sale('var-b', 20)]
    expect(run(entries, sales).map((s) => s.supplierProductId)).toEqual(['b', 'a'])
  })
  it('leaves a shelf alone until it is nearly empty', () => {
    // The client's case: 25 sold and 22 still on the shelf is "three short" by
    // arithmetic, and an order full of threes is not an order anybody places.
    // Nothing is proposed until it is down to three.
    const stocked = [entry({ id: 'a', variationId: 'var-a', stock: 22 })]
    expect(run(stocked, [sale('var-a', 25)])).toEqual([])

    const nearlyOut = [entry({ id: 'a', variationId: 'var-a', stock: 3 })]
    const [suggestion] = run(nearlyOut, [sale('var-a', 25)])
    expect(suggestion?.suggested).toBe(22)
  })
})
