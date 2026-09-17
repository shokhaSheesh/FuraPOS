import { describe, expect, it } from 'vitest'
import type { TransferRow } from '../components/transferLineColumns'
import type { VariationRow } from '@/features/products/model/product'
import {
  countByCategory,
  groupByProduct,
  matchesAvailability,
  matchesSearch,
  sortGroups,
  stockLevel,
  subtreeOf,
  type CategoryNode,
} from './browse'

const row = (
  id: string,
  productId: string,
  categoryId: string,
  numbers: { atSource?: number; atDestination?: number; sold?: number; quantity?: number } = {},
): TransferRow => ({
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
  index: numbers.quantity ? 0 : -1,
  quantity: numbers.quantity ?? 0,
  atSource: numbers.atSource ?? 5,
  atDestination: numbers.atDestination ?? 0,
  demand: { 3: numbers.sold ?? 0, 6: numbers.sold ?? 0 },
  stalled: false,
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
      row('a', 'p1', 'oil', { atSource: 3, atDestination: 1, sold: 4, quantity: 2 }),
      row('b', 'p1', 'oil', { atSource: 4, atDestination: 2, sold: 1 }),
      row('c', 'p2', 'body'),
    ])
    expect(groups).toHaveLength(2)
    expect(groups[0]).toMatchObject({ atSource: 7, atDestination: 3, chosen: 2 })
    expect(groups[0]!.demand).toEqual({ 3: 5, 6: 5 })
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

  it('filters on what the receiving end holds', () => {
    const [low, full] = groupByProduct([
      row('a', 'p1', 'oil', { atDestination: 4 }),
      row('b', 'p2', 'oil', { atDestination: 40 }),
    ])
    expect(matchesAvailability(low!, 'low')).toBe(true)
    expect(matchesAvailability(full!, 'low')).toBe(false)
    expect(matchesAvailability(low!, 'none')).toBe(false)
  })

  it('puts the best sellers first, or the emptiest destination first', () => {
    const groups = groupByProduct([
      row('a', 'p1', 'oil', { sold: 1, atDestination: 9 }),
      row('b', 'p2', 'oil', { sold: 8, atDestination: 0 }),
    ])
    expect(sortGroups(groups, 'sales')[0]!.productId).toBe('p2')
    expect(sortGroups(groups, 'stock')[0]!.productId).toBe('p2')
  })

  it('reads two or fewer as critical and five or fewer as low', () => {
    expect([0, 2, 3, 5, 6].map(stockLevel)).toEqual(['critical', 'critical', 'low', 'low', 'good'])
  })
})
