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
      tags: [],
      unit: 'pcs',
      vehicleMake: 'DAF',
      vehicleModels: ['XF 105'],
      cargoWeightKg: null,
      cargoSize: null,
      isShippable: true,
      showOnline: false,
      status: 'active',
      variations: [
        {
          name: 'Left',
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
          stock: 0,
          stockByLocation: [],
          imageUrl: null,
          status: 'active',
        },
        {
          name: 'Right',
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
          stock: 0,
          stockByLocation: [],
          imageUrl: null,
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
    // Stock never comes from the product form; it arrives via goods receipt.
    expect(product.variations.every((v) => v.stock === 0)).toBe(true)
  })

  it('removes a variation from the catalogue', () => {
    const target = useDataStore.getState().variations[0]!
    useDataStore.getState().deleteVariation(target.id)
    expect(useDataStore.getState().variations.map((v) => v.id)).not.toContain(target.id)
  })
})
