import { beforeEach, describe, expect, it } from 'vitest'
import { useDataStore } from '../store'
import { matches, paginate } from '../query'
import type { SaleLine } from '@/features/sales/model/sale'

const line = (over: Partial<SaleLine> = {}): SaleLine => ({
  id: 'l1',
  variationId: 'var-1-1',
  productId: 'prd-1',
  sku: 'SKU-1',
  name: 'Brake disc',
  brandName: null,
  categoryName: 'Brakes',
  imageUrl: null,
  unit: 'pcs',
  quantity: 2,
  unitPrice: 100_000,
  discountPercent: 0,
  ...over,
})

describe('list helpers', () => {
  const rows = Array.from({ length: 30 }, (_, i) => ({ id: i, n: 30 - i }))

  it('slices the requested page and reports the full total', () => {
    const page = paginate(rows, { page: 2, pageSize: 10 })
    expect(page.items).toHaveLength(10)
    expect(page.items[0]!.id).toBe(10)
    expect(page.total).toBe(30)
  })

  it('sorts numerically rather than as text', () => {
    const page = paginate(rows, { sort: 'n', order: 'asc', pageSize: 3 })
    expect(page.items.map((r) => r.n)).toEqual([1, 2, 3])
  })

  it('matches case-insensitively and ignores empty needles', () => {
    expect(matches(['Brake disc'], 'BRAKE')).toBe(true)
    expect(matches(['Brake disc'], '')).toBe(true)
    expect(matches([null, undefined], 'x')).toBe(false)
  })
})

describe('data store', () => {
  beforeEach(() => {
    // Each test starts from whatever the previous left; assertions are relative.
  })

  it('creates a sale with server-style totals and a running number', () => {
    const before = useDataStore.getState().sales.length
    const sale = useDataStore.getState().createSale({
      clientId: null,
      locationId: 'loc-2',
      channel: 'desk',
      paymentMethod: 'cash',
      comment: '',
      paid: 0,
      lines: [line({ discountPercent: 10 })],
      status: 'completed',
      expiresAt: null,
      delivery: null,
    })

    expect(useDataStore.getState().sales).toHaveLength(before + 1)
    // 2 × 100 000 less 10%
    expect(sale.total).toBe(180_000)
    expect(sale.debt).toBe(180_000)
    expect(sale.number).toMatch(/^S-\d{5}$/)
  })

  it('caps a payment at the total and clears the debt', () => {
    const sale = useDataStore.getState().createSale({
      clientId: null,
      locationId: 'loc-2',
      channel: 'desk',
      paymentMethod: 'cash',
      comment: '',
      paid: 0,
      lines: [line()],
      status: 'open',
      expiresAt: null,
      delivery: null,
    })

    const updated = useDataStore.getState().updateSale(sale.id, { paid: 999_999_999 })
    expect(updated?.paid).toBe(sale.total)
    expect(updated?.debt).toBe(0)
  })

  it('stamps finishedAt once a sale reaches a terminal status', () => {
    const sale = useDataStore.getState().createSale({
      clientId: null,
      locationId: 'loc-2',
      channel: 'desk',
      paymentMethod: 'cash',
      comment: '',
      paid: 0,
      lines: [line()],
      status: 'open',
      expiresAt: null,
      delivery: null,
    })
    expect(sale.finishedAt).toBeNull()

    const done = useDataStore.getState().updateSale(sale.id, { status: 'completed' })
    expect(done?.finishedAt).toBeTruthy()
  })

  it('keeps the flat catalogue in step when a product is created', () => {
    const before = useDataStore.getState().variations.length
    const product = useDataStore.getState().createProduct({
      name: 'Test bracket',
      description: null,
      categoryId: 'cat-2',
      brandId: null,
      manufacturer: null,
      tags: [],
      unit: 'pcs',
      vehicleMake: 'DAF',
      vehicleModels: ['XF 105'],
      cargoWeightKg: null,
      cargoSize: null,
      isShippable: true,
      showOnline: false,
      status: 'active',
      options: [{ id: 'opt-side', name: 'Side', values: ['Left', 'Right'] }],
      variations: [
        {
          optionValues: [{ optionId: 'opt-side', value: 'Left' }],
          sku: 'TEST-L',
          barcode: null,
          partSide: 'left',
          costPrice: 10,
          costCurrency: 'USD',
          salePrice: 200_000,
          discountPrice: null,
          lowStockThreshold: null,
          shelfAddress: null,
          moq: null,
          stockByLocation: [{ locationId: 'loc-1', quantity: 4 }],
          status: 'active',
        },
        {
          optionValues: [{ optionId: 'opt-side', value: 'Right' }],
          sku: 'TEST-R',
          barcode: null,
          partSide: 'right',
          costPrice: 10,
          costCurrency: 'USD',
          salePrice: 200_000,
          discountPrice: null,
          lowStockThreshold: null,
          shelfAddress: null,
          moq: null,
          stockByLocation: [
            { locationId: 'loc-1', quantity: 4 },
            { locationId: 'loc-3', quantity: 6 },
          ],
          status: 'active',
        },
      ],
    })

    expect(product.variations).toHaveLength(2)
    // Both variations must appear in the sellable list, named with the parent.
    const rows = useDataStore.getState().variations
    expect(rows).toHaveLength(before + 2)
    expect(rows.filter((v) => v.productId === product.id).map((v) => v.fullName)).toEqual([
      'Test bracket — Left',
      'Test bracket — Right',
    ])
    // Opening stock is per location, and `stock` is always the sum of it.
    expect(product.variations[0]!.stock).toBe(4)
    expect(product.variations[1]!.stock).toBe(10)
    // Location names are resolved on write so screens never have to join.
    expect(product.variations[1]!.stockByLocation.map((r) => r.locationName)).toEqual([
      'Central warehouse',
      'Shop — Yunusobod',
    ])
  })

  it('removes a variation from the catalogue', () => {
    const target = useDataStore.getState().variations[0]!
    useDataStore.getState().deleteVariation(target.id)
    expect(useDataStore.getState().variations.map((v) => v.id)).not.toContain(target.id)
  })
})

describe('location scope', () => {
  it("reports a location's own quantity as stock, and hides what it does not carry", () => {
    const rows = useDataStore.getState().variations
    const [locationA] = useDataStore.getState().locations
    const carried = rows.filter((v) =>
      v.stockByLocation.some((row) => row.locationId === locationA!.id),
    )
    // The scope is what the catalogue applies: only rows with a row there, and
    // `stock` replaced by that row's quantity rather than the total.
    const scoped = carried.map((v) => ({
      ...v,
      stock: v.stockByLocation.find((row) => row.locationId === locationA!.id)!.quantity,
    }))

    expect(scoped.length).toBeLessThan(rows.length)
    expect(scoped.every((v) => v.stock <= rows.find((r) => r.id === v.id)!.stock)).toBe(true)
    // Summing one location can never exceed summing every location.
    const here = scoped.reduce((sum, v) => sum + v.stock, 0)
    const everywhere = rows.reduce((sum, v) => sum + v.stock, 0)
    expect(here).toBeLessThan(everywhere)
  })
})

describe('booking a delivery against an order', () => {
  /** An order still waiting on stock, so there is something to short-ship. */
  const openOrder = () =>
    useDataStore
      .getState()
      .orders.find((order) =>
        order.lines.some((line) => line.orderedQuantity - line.receivedQuantity > 0),
      )

  it('keeps the invoiced and the counted figures apart when a delivery is short', () => {
    const order = openOrder()!
    const line = order.lines.find((l) => l.orderedQuantity - l.receivedQuantity > 1)!
    const outstanding = line.orderedQuantity - line.receivedQuantity
    const counted = outstanding - 1

    const result = useDataStore
      .getState()
      .receiveAgainstOrder(order.id, { [line.id]: counted }, 'INV-SHORT')
    expect(result.ok).toBe(true)

    const receipt = useDataStore.getState().receipts.at(-1)!
    const received = receipt.lines.find((l) => l.variationId === line.variationId)!

    // The bug this pins: both used to be the counted number, so a short
    // delivery vanished and freight was spread over the wrong unit count.
    expect(received.orderedQuantity).toBe(outstanding)
    expect(received.receivedQuantity).toBe(counted)
    expect(received.orderedQuantity - (received.receivedQuantity ?? 0)).toBe(1)
  })

  it('leaves the missing units outstanding on the order', () => {
    const order = openOrder()!
    const line = order.lines.find((l) => l.orderedQuantity - l.receivedQuantity > 1)!
    const outstanding = line.orderedQuantity - line.receivedQuantity

    useDataStore
      .getState()
      .receiveAgainstOrder(order.id, { [line.id]: outstanding - 1 }, 'INV-SHORT-2')

    const after = useDataStore.getState().orders.find((o) => o.id === order.id)!
    const sameLine = after.lines.find((l) => l.id === line.id)!
    expect(sameLine.orderedQuantity - sameLine.receivedQuantity).toBe(1)
    expect(after.status).toBe('partial')
  })

  it('never books in more than the order still expects', () => {
    const order = openOrder()!
    const line = order.lines.find((l) => l.orderedQuantity - l.receivedQuantity > 0)!
    const outstanding = line.orderedQuantity - line.receivedQuantity

    useDataStore
      .getState()
      .receiveAgainstOrder(order.id, { [line.id]: outstanding + 10 }, 'INV-OVER')

    const receipt = useDataStore.getState().receipts.at(-1)!
    const received = receipt.lines.find((l) => l.variationId === line.variationId)!
    expect(received.receivedQuantity).toBe(outstanding)
  })
})
