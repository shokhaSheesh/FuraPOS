import { describe, expect, it } from 'vitest'
import {
  combinationName,
  optionCombinations,
  productFormSchema,
  reconcileVariations,
  usableOptions,
  type ProductFormValues,
} from './product'

const variation = (over: Partial<ProductFormValues['variations'][number]> = {}) => ({
  optionValues: [],
  enabled: true,
  sku: 'SKU-1',
  barcode: null,
  partSide: null,
  costPrice: 10,
  costCurrency: 'USD' as const,
  salePrice: 200_000,
  discountPrice: null,
  lowStockThreshold: null,
  shelfAddress: null,
  moq: null,
  status: 'active' as const,
  stockByLocation: [{ locationId: 'loc-1', quantity: 3 }],
  ...over,
})

const values = (over: Partial<ProductFormValues> = {}): ProductFormValues => ({
  name: 'Brake disc',
  description: null,
  categoryId: 'cat-1',
  brandId: null,
  manufacturer: null,
  tags: [],
  unit: 'pcs',
  vehicleMake: null,
  vehicleModels: [],
  cargoWeightKg: null,
  cargoSize: null,
  isShippable: true,
  showOnline: false,
  status: 'active',
  variationMode: 'single',
  options: [],
  locationIds: ['loc-1'],
  variations: [variation()],
  ...over,
})

describe('product form schema', () => {
  it('does not ask a single-variation product to name its variation', () => {
    expect(productFormSchema.safeParse(values()).success).toBe(true)
  })

  it('will not let a product vary along nothing', () => {
    const result = productFormSchema.safeParse(values({ variationMode: 'multiple' }))
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toMatch(/at least one value/)
  })

  it('rejects an option that is named but has no values', () => {
    const result = productFormSchema.safeParse(
      values({
        variationMode: 'multiple',
        options: [{ id: 'o1', name: 'Side', values: [] }],
      }),
    )
    expect(result.success).toBe(false)
    expect(result.error?.issues.some((i) => i.message === 'Add at least one value')).toBe(true)
  })

  it('rejects two options with the same name', () => {
    const result = productFormSchema.safeParse(
      values({
        variationMode: 'multiple',
        options: [
          { id: 'o1', name: 'Side', values: ['Left'] },
          { id: 'o2', name: 'side', values: ['Right'] },
        ],
      }),
    )
    expect(result.success).toBe(false)
    expect(result.error?.issues.some((i) => i.message === 'Already used by another option')).toBe(
      true,
    )
  })

  it('refuses a product that is stocked nowhere', () => {
    const result = productFormSchema.safeParse(values({ locationIds: [] }))
    expect(result.success).toBe(false)
    expect(
      result.error?.issues.some((i) => i.message === 'Stock it at one location at least'),
    ).toBe(true)
  })

  it('refuses a product with no variations at all', () => {
    expect(productFormSchema.safeParse(values({ variations: [] })).success).toBe(false)
  })
})

describe('option combinations', () => {
  const side = { id: 'o-side', name: 'Side', values: ['Left', 'Right'] }
  const colour = { id: 'o-colour', name: 'Colour', values: ['Black', 'Silver', 'Red'] }

  it('multiplies every option out, in option order', () => {
    const rows = optionCombinations([side, colour])
    expect(rows).toHaveLength(6)
    expect(rows.map(combinationName)).toEqual([
      'Left / Black',
      'Left / Silver',
      'Left / Red',
      'Right / Black',
      'Right / Silver',
      'Right / Red',
    ])
  })

  it('ignores options that are not usable yet', () => {
    expect(usableOptions([side, { id: 'x', name: '', values: ['a'] }])).toEqual([side])
    expect(usableOptions([side, { id: 'x', name: 'Size', values: [] }])).toEqual([side])
  })

  it('carries pricing onto every combination when a second option is added', () => {
    const before = optionCombinations([side]).map((optionValues, i) => ({
      optionValues,
      id: `var-${i}` as string | undefined,
      sku: `SKU-${i}`,
      salePrice: (i + 1) * 1000,
    }))
    const { variations, dropped } = reconcileVariations([side, colour], before, (optionValues) => ({
      optionValues,
      id: undefined,
      sku: '',
      salePrice: 0,
    }))
    expect(variations).toHaveLength(6)
    expect(dropped).toHaveLength(0)
    // The three Left rows all inherit Left's price; nothing arrives blank.
    expect(variations.map((v) => v.salePrice)).toEqual([1000, 1000, 1000, 2000, 2000, 2000])
    // But only one of each keeps the SKU — two rows cannot share an identity.
    expect(variations.map((v) => v.sku)).toEqual(['SKU-0', '', '', 'SKU-1', '', ''])
    // …nor an id, or the two would be the same record.
    const ids = variations.map((v) => v.id).filter(Boolean)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('restores the exact rows when the added option is removed again', () => {
    const start = optionCombinations([side]).map((optionValues, i) => ({
      optionValues,
      sku: `SKU-${i}`,
      salePrice: 0,
    }))
    const widened = reconcileVariations([side, colour], start, (optionValues) => ({
      optionValues,
      sku: '',
      salePrice: 0,
    })).variations
    const { variations } = reconcileVariations([side], widened, (optionValues) => ({
      optionValues,
      sku: '',
      salePrice: 0,
    }))
    expect(variations.map((v) => v.sku)).toEqual(['SKU-0', 'SKU-1'])
  })

  it('starts a new value from its sibling rather than from zero', () => {
    const before = optionCombinations([side, { ...colour, values: ['Black'] }]).map(
      (optionValues, i) => ({ optionValues, sku: `SKU-${i}`, salePrice: (i + 1) * 1000 }),
    )
    const { variations } = reconcileVariations(
      [side, { ...colour, values: ['Black', 'Silver'] }],
      before,
      (optionValues) => ({ optionValues, sku: '', salePrice: 0 }),
    )
    expect(variations.map((v) => combinationName(v.optionValues))).toEqual([
      'Left / Black',
      'Left / Silver',
      'Right / Black',
      'Right / Silver',
    ])
    // Silver inherits its Side sibling's price, but never its SKU.
    expect(variations.map((v) => v.salePrice)).toEqual([1000, 1000, 2000, 2000])
    expect(variations.map((v) => v.sku)).toEqual(['SKU-0', '', 'SKU-1', ''])
  })

  it('never carries stock onto a combination that did not exist before', () => {
    const before = optionCombinations([side]).map((optionValues) => ({
      optionValues,
      sku: 'SKU',
      salePrice: 1000,
      stock: 40,
    }))
    const { variations } = reconcileVariations(
      [side, { ...colour, values: ['Black', 'Silver'] }],
      before,
      (optionValues) => ({ optionValues, sku: '', salePrice: 0, stock: 0 }),
      (row) => ({ ...row, stock: 0 }),
    )
    // Price carries; the discs on the shelf do not get duplicated.
    expect(variations.map((v) => v.salePrice)).toEqual([1000, 1000, 1000, 1000])
    expect(variations.map((v) => v.stock)).toEqual([40, 0, 40, 0])
  })

  it('matches by combination, not by position, when values are reordered', () => {
    const flipped = { ...side, values: ['Right', 'Left'] }
    const before = optionCombinations([side]).map((optionValues, i) => ({
      optionValues,
      sku: i === 0 ? 'LEFT' : 'RIGHT',
    }))
    const { variations } = reconcileVariations([flipped], before, (optionValues) => ({
      optionValues,
      sku: '',
    }))
    expect(variations.map((v) => v.sku)).toEqual(['RIGHT', 'LEFT'])
  })

  it('reports the combinations it had to drop', () => {
    const before = optionCombinations([side]).map((optionValues, i) => ({
      optionValues,
      sku: `SKU-${i}`,
    }))
    const { variations, dropped } = reconcileVariations(
      [{ ...side, values: ['Left'] }],
      before,
      (optionValues) => ({ optionValues, sku: '' }),
    )
    expect(variations).toHaveLength(1)
    expect(dropped.map((v) => v.sku)).toEqual(['SKU-1'])
  })

  it('collapses to a single unnamed variation when the options go away', () => {
    const before = optionCombinations([side]).map((optionValues, i) => ({
      optionValues,
      sku: `SKU-${i}`,
    }))
    const { variations, dropped } = reconcileVariations([], before, (optionValues) => ({
      optionValues,
      sku: '',
    }))
    expect(variations).toEqual([{ optionValues: [], sku: 'SKU-0' }])
    expect(dropped).toHaveLength(1)
  })
})

describe('combinations that are not sold', () => {
  it('does not ask an unsold combination for a SKU', () => {
    const result = productFormSchema.safeParse(
      values({
        variationMode: 'multiple',
        options: [{ id: 'o1', name: 'Side', values: ['Left', 'Right'] }],
        variations: [variation(), variation({ enabled: false, sku: '' })],
      }),
    )
    expect(result.success).toBe(true)
  })

  it('still asks a sold combination for one', () => {
    const result = productFormSchema.safeParse(
      values({
        variationMode: 'multiple',
        options: [{ id: 'o1', name: 'Side', values: ['Left', 'Right'] }],
        variations: [variation(), variation({ sku: '' })],
      }),
    )
    expect(result.success).toBe(false)
    expect(result.error?.issues.some((i) => i.message === 'SKU is required')).toBe(true)
  })

  it('refuses a product where nothing is sold', () => {
    const result = productFormSchema.safeParse(
      values({
        variationMode: 'multiple',
        options: [{ id: 'o1', name: 'Side', values: ['Left'] }],
        variations: [variation({ enabled: false })],
      }),
    )
    expect(result.success).toBe(false)
    expect(result.error?.issues.some((i) => /at least one combination/.test(i.message))).toBe(true)
  })
})
