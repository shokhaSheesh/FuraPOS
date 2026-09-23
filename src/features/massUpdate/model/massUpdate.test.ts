import { describe, expect, it } from 'vitest'
import type { VariationRow } from '@/features/products/model/product'
import {
  actionAllowed,
  checkKeys,
  guessRole,
  planCounts,
  planMassUpdate,
  problems,
  type ColumnRole,
} from './massUpdate'

const variation = (id: string, productId: string, barcode: string | null, sku: string) =>
  ({ id, productId, barcode, sku }) as unknown as VariationRow

const variations = [
  variation('v1', 'p1', '460001', 'SKU-1-L'),
  variation('v2', 'p1', '460002', 'SKU-1-R'),
  variation('v3', 'p2', null, 'SKU-2'),
]
const categories = [{ id: 'cat-2', name: 'Brakes', path: 'Chassis > Brakes' }]
const brands = [{ id: 'brand-1', name: 'Bosch' }]

const plan = (rows: string[][], roles: ColumnRole[]) =>
  planMassUpdate({ rows, roles, variations, categories, brands })

describe('choosing what each column is', () => {
  it('needs a key and something to update', () => {
    expect(problems([{ kind: 'skip' }])).toEqual([
      'No key column chosen',
      'No field to update chosen',
    ])
  })

  it('needs a currency for a price and a location for a quantity', () => {
    const found = problems([
      { kind: 'key', keyType: 'barcode' },
      { kind: 'action', action: 'salePrice' },
      { kind: 'action', action: 'quantity' },
    ])
    expect(found).toContain('Sale price: no currency chosen')
    expect(found).toContain('Quantity: no location chosen')
  })

  it('will not set what a key cannot reach', () => {
    const roles: ColumnRole[] = [{ kind: 'key', keyType: 'productId' }]
    // A product ID finds every variation, so one barcode for all of them is refused.
    expect(actionAllowed('barcode', roles)).toBe(false)
    expect(actionAllowed('productName', roles)).toBe(true)
  })

  it('refuses the same field twice', () => {
    expect(
      problems([
        { kind: 'key', keyType: 'sku' },
        { kind: 'action', action: 'productName' },
        { kind: 'action', action: 'productName' },
      ]),
    ).toContain('Product name is chosen for more than one column')
  })

  it('reads the template headings on its own', () => {
    expect(guessRole('Barcode')).toEqual({ kind: 'key', keyType: 'barcode' })
    expect(guessRole('Sale price')).toEqual({ kind: 'action', action: 'salePrice' })
    expect(guessRole('Something else')).toEqual({ kind: 'skip' })
  })
})

describe('checking the keys before running', () => {
  it('counts what is found and lists what is not', () => {
    const check = checkKeys(
      [['460001'], ['999'], ['']],
      [{ kind: 'key', keyType: 'barcode' }],
      variations,
    )
    expect(check).toEqual({ total: 3, found: 1, notFound: ['999', '(empty)'] })
  })
})

describe('the plan', () => {
  it('updates prices in the chosen currency and leaves empty cells alone', () => {
    const result = plan(
      [
        ['460001', '125 000', 'New name'],
        ['460002', '', ''],
      ],
      [
        { kind: 'key', keyType: 'barcode' },
        { kind: 'action', action: 'salePrice', currency: 'UZS' },
        { kind: 'action', action: 'productName' },
      ],
    )
    expect(result.variationPatches.get('v1')).toEqual({ salePrice: 125000, saleCurrency: 'UZS' })
    expect(result.variationPatches.has('v2')).toBe(false)
    expect(result.productPatches.get('p1')).toEqual({ name: 'New name' })
  })

  it('reaches every variation of a product by its ID', () => {
    const result = plan(
      [['p1', '12.5']],
      [
        { kind: 'key', keyType: 'productId' },
        { kind: 'action', action: 'costPrice', currency: 'USD' },
      ],
    )
    expect([...result.variationPatches.keys()]).toEqual(['v1', 'v2'])
  })

  it('sets a shelf to a quantity at the chosen location', () => {
    const result = plan(
      [['SKU-2', '7']],
      [
        { kind: 'key', keyType: 'sku' },
        { kind: 'action', action: 'quantity', locationId: 'loc-1' },
      ],
    )
    expect(result.stock.get('loc-1')?.get('v3')).toBe(7)
    expect(planCounts(result)).toEqual({ products: 0, variations: 0, stock: 1 })
  })

  it('looks categories and brands up by name, and reports what it cannot find', () => {
    const result = plan(
      [
        ['SKU-2', 'chassis > brakes', 'bosch'],
        ['SKU-1-L', 'Nowhere', 'Nobody'],
      ],
      [
        { kind: 'key', keyType: 'sku' },
        { kind: 'action', action: 'category' },
        { kind: 'action', action: 'brand' },
      ],
    )
    expect(result.productPatches.get('p2')).toMatchObject({
      categoryId: 'cat-2',
      brandId: 'brand-1',
    })
    expect(result.errors).toEqual([
      'Row 2: no category called "Nowhere"',
      'Row 2: no brand called "Nobody"',
    ])
  })

  it('skips rows the key cannot find and reports bad numbers', () => {
    const result = plan(
      [
        ['nope', '1'],
        ['460001', 'abc'],
      ],
      [
        { kind: 'key', keyType: 'barcode' },
        { kind: 'action', action: 'salePrice', currency: 'UZS' },
      ],
    )
    expect(result.skipped).toBe(1)
    expect(result.errors).toEqual(['Row 2: Sale price "abc" is not a number'])
  })
})

describe('running it', () => {
  it('writes fields, sets a shelf through a correction and records the run', async () => {
    const { useDataStore } = await import('@/data/store')
    const state = useDataStore.getState()
    const target = state.variations.find((v) => v.barcode && v.stockByLocation.length > 0)!
    const locationId = target.stockByLocation[0]!.locationId
    const before = state.corrections.length

    const result = planMassUpdate({
      rows: [[target.barcode!, '777', 'Renamed part', '3']],
      roles: [
        { kind: 'key', keyType: 'barcode' },
        { kind: 'action', action: 'salePrice', currency: 'UZS' },
        { kind: 'action', action: 'productName' },
        { kind: 'action', action: 'quantity', locationId },
      ],
      variations: state.variations,
      categories: state.categories,
      brands: state.brands,
    })
    const record = state.applyMassUpdate({ fileName: 'prices.xlsx', totalRows: 1, plan: result })

    const after = useDataStore.getState()
    const row = after.variations.find((v) => v.id === target.id)!
    expect(row.salePrice).toBe(777)
    expect(row.productName).toBe('Renamed part')
    expect(row.stockByLocation.find((s) => s.locationId === locationId)?.quantity).toBe(3)
    expect(after.products.find((p) => p.id === target.productId)?.name).toBe('Renamed part')
    expect(after.corrections).toHaveLength(before + 1)
    expect(record.result).toEqual({ products: 1, variations: 1, stock: 1 })
    expect(after.massUpdates[0]?.fileName).toBe('prices.xlsx')
  })
})
