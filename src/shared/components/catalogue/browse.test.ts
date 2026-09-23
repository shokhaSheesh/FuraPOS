import { describe, expect, it } from 'vitest'
import type { VariationRow } from '@/features/products/model/product'
import {
  countByCategory,
  bestSellingFirst,
  groupByProduct,
  matchesSearch,
  stockLevel,
  subtreeOf,
  sumRows,
  type CatalogueRow,
  type CategoryNode,
} from './browse'

interface Row extends CatalogueRow {
  atSource: number
  supplierSku: string | null
}

const row = (
  id: string,
  productId: string,
  categoryId: string,
  numbers: { atSource?: number; sold?: number; quantity?: number } = {},
): Row => ({
  key: id,
  variation: {
    id,
    productId,
    productName: `Product ${productId}`,
    fullName: `Product ${productId} — ${id}`,
    sku: `SKU-${id}`,
    barcode: null,
    oem: `OEM-${id}`,
    shelfAddress: null,
    categoryId,
    categoryPath: categoryId,
    brandName: null,
    manufacturer: null,
    vehicleMakes: [],
    vehicleModels: [],
  } as unknown as VariationRow,
  quantity: numbers.quantity ?? 0,
  atSource: numbers.atSource ?? 5,
  demand: { 1: numbers.sold ?? 0, 3: numbers.sold ?? 0 },
  supplierSku: `THEIR-${id}`,
})

const tree: CategoryNode[] = [
  { id: 'engine', name: 'Engine', parentId: null },
  { id: 'filters', name: 'Filters', parentId: 'engine' },
  { id: 'oil', name: 'Oil filters', parentId: 'filters' },
  { id: 'body', name: 'Body', parentId: null },
]

describe('groupByProduct', () => {
  it('puts the variations of one product on one card and adds their numbers up', () => {
    const groups = groupByProduct([
      row('a', 'p1', 'oil', { atSource: 3, sold: 4, quantity: 2 }),
      row('b', 'p1', 'oil', { atSource: 4, sold: 1 }),
      row('c', 'p2', 'body'),
    ])
    expect(groups).toHaveLength(2)
    expect(groups[0]).toMatchObject({ chosen: 2 })
    expect(sumRows(groups[0]!, (r) => r.atSource)).toBe(7)
    expect(groups[0]!.demand).toEqual({ 1: 5, 3: 5 })
  })
})

describe('categories', () => {
  it('counts a product under its category and every parent of it', () => {
    const counts = countByCategory(
      groupByProduct([row('a', 'p1', 'oil'), row('c', 'p2', 'body')]),
      tree,
    )
    expect(counts.get('oil')).toBe(1)
    expect(counts.get('filters')).toBe(1)
    expect(counts.get('engine')).toBe(1)
    expect(counts.get('body')).toBe(1)
  })

  it('finds everything filed beneath a category', () => {
    expect([...subtreeOf('engine', tree)].sort()).toEqual(['engine', 'filters', 'oil'])
  })
})

describe('finding and ordering cards', () => {
  it('searches the variations, not only the product name', () => {
    const [group] = groupByProduct([row('a', 'p1', 'oil'), row('b', 'p1', 'oil')])
    expect(matchesSearch(group!, 'oem-b')).toBe(true)
    expect(matchesSearch(group!, 'nothing like it')).toBe(false)
  })

  it('also searches what the document knows a row by, such as a supplier code', () => {
    const [group] = groupByProduct([row('a', 'p1', 'oil')])
    expect(matchesSearch(group!, 'their-a')).toBe(false)
    expect(matchesSearch(group!, 'their-a', (r) => [r.supplierSku])).toBe(true)
  })

  it('puts the best sellers first', () => {
    const groups = groupByProduct([
      row('a', 'p1', 'oil', { sold: 1 }),
      row('b', 'p2', 'oil', { sold: 8 }),
    ])
    expect(bestSellingFirst(groups)[0]!.productId).toBe('p2')
  })

  it('reads two or fewer as critical and five or fewer as low', () => {
    expect([0, 2, 3, 5, 6].map(stockLevel)).toEqual(['critical', 'critical', 'low', 'low', 'good'])
  })
})
