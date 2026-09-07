import { describe, expect, it } from 'vitest'
import { useDataStore } from '@/data/store'
import {
  averageChange,
  belowCost,
  changedLines,
  marginOf,
  marginShift,
  priceUnder,
  roundPrice,
} from './repricing'

const priceOf = (variationId: string) =>
  useDataStore.getState().variations.find((v) => v.id === variationId)?.salePrice ?? 0

const discountOf = (variationId: string) =>
  useDataStore.getState().variations.find((v) => v.id === variationId)?.discountPrice ?? null

describe('price rules', () => {
  const line = { oldPrice: 1_000_000, costAtTime: 700_000 }

  it('moves a price by a percentage', () => {
    expect(priceUnder({ kind: 'percent', value: 10, roundTo: 1 }, line)).toBe(1_100_000)
    expect(priceUnder({ kind: 'percent', value: -10, roundTo: 1 }, line)).toBe(900_000)
  })

  it('moves a price by a fixed amount', () => {
    expect(priceUnder({ kind: 'amount', value: 50_000, roundTo: 1 }, line)).toBe(1_050_000)
  })

  it('works a target margin backwards from cost', () => {
    // 30% margin means cost is 70% of price: 700 000 / 0.7 = 1 000 000.
    expect(priceUnder({ kind: 'margin', value: 0.3, roundTo: 1 }, line)).toBe(1_000_000)
    // And it can lower a price that was sitting far above its cost.
    const rich = { oldPrice: 5_000_000, costAtTime: 700_000 }
    expect(priceUnder({ kind: 'margin', value: 0.3, roundTo: 1 }, rich)).toBe(1_000_000)
  })

  it('refuses to produce infinity from an impossible margin', () => {
    // 100% margin would need an infinite price; the old one is kept instead.
    expect(priceUnder({ kind: 'margin', value: 1, roundTo: 1 }, line)).toBe(line.oldPrice)
    expect(priceUnder({ kind: 'margin', value: 1.5, roundTo: 1 }, line)).toBe(line.oldPrice)
  })

  it('leaves the price alone when the rule is manual', () => {
    expect(priceUnder({ kind: 'manual', value: 0, roundTo: 1000 }, line)).toBe(line.oldPrice)
  })

  it('never produces a negative price', () => {
    expect(priceUnder({ kind: 'amount', value: -9_000_000, roundTo: 1 }, line)).toBe(0)
  })

  it('rounds to the chosen multiple', () => {
    expect(roundPrice(2_340_671, 1000)).toBe(2_341_000)
    expect(roundPrice(2_340_671, 5000)).toBe(2_340_000)
    expect(roundPrice(2_340_671, 1)).toBe(2_340_671)
  })
})

describe('reading a sheet', () => {
  const sheet = (rows: [number, number, number][]) => ({
    lines: rows.map(([oldPrice, newPrice, costAtTime], index) => ({
      id: `l${index}`,
      variationId: `v${index}`,
      productId: 'p',
      sku: 's',
      name: 'n',
      imageUrl: null,
      categoryName: 'c',
      costAtTime,
      oldPrice,
      newPrice,
      oldDiscountPrice: null,
      newDiscountPrice: null,
    })),
  })

  it('counts only the prices that actually move', () => {
    expect(
      changedLines(
        sheet([
          [100, 110, 70],
          [100, 100, 70],
        ]),
      ),
    ).toHaveLength(1)
  })

  it('averages the move across changed lines only', () => {
    // +10% and +20%, plus one unchanged that must not drag it to 10%.
    expect(
      averageChange(
        sheet([
          [100, 110, 70],
          [100, 120, 70],
          [100, 100, 70],
        ]),
      ),
    ).toBeCloseTo(0.15)
  })

  it('flags anything that would sell below what it cost', () => {
    const risky = belowCost(
      sheet([
        [100, 60, 70],
        [100, 110, 70],
      ]),
    )
    expect(risky).toHaveLength(1)
    expect(risky[0]!.newPrice).toBe(60)
  })

  it('shows margin moving', () => {
    const shift = marginShift(sheet([[100, 200, 50]]))
    expect(shift.before).toBeCloseTo(0.5)
    expect(shift.after).toBeCloseTo(0.75)
  })

  it('computes margin the way the catalogue does', () => {
    expect(marginOf(100, 70)).toBeCloseTo(0.3)
    expect(marginOf(0, 70)).toBe(0)
  })
})

describe('applying and reverting', () => {
  it('changes the price on the catalogue, and nowhere else', () => {
    const store = useDataStore.getState()
    const before = priceOf('var-1-1')

    const repricing = store.createRepricing({
      rule: { kind: 'percent', value: 10, roundTo: 1 },
      categoryId: '',
      brandId: '',
      locationId: '',
      comment: 'test',
    })
    // Preparing changes nothing.
    expect(priceOf('var-1-1')).toBe(before)

    expect(useDataStore.getState().applyRepricing(repricing.id)).toEqual({ ok: true })
    expect(priceOf('var-1-1')).toBe(Math.round(before * 1.1))
  })

  it('restores the exact old price, not the rule in reverse', () => {
    const store = useDataStore.getState()
    // A rounded rule cannot be undone by arithmetic: +7% then −7% does not
    // return to the start, and rounding pushes it further each time. Reverting
    // must replay the snapshot.
    const before = priceOf('var-2-1')

    const repricing = store.createRepricing({
      rule: { kind: 'percent', value: 7, roundTo: 5000 },
      categoryId: '',
      brandId: '',
      locationId: '',
      comment: '',
    })
    useDataStore.getState().applyRepricing(repricing.id)
    expect(priceOf('var-2-1')).not.toBe(before)

    expect(useDataStore.getState().revertRepricing(repricing.id)).toEqual({ ok: true })
    expect(priceOf('var-2-1')).toBe(before)
  })

  it('moves a promotional price with the price it discounts', () => {
    const store = useDataStore.getState()
    // Find something that actually carries a discount.
    const withDiscount = useDataStore
      .getState()
      .variations.find((v) => v.discountPrice !== null && v.status === 'active')!
    const oldPrice = withDiscount.salePrice
    const oldDiscount = withDiscount.discountPrice!
    const share = oldDiscount / oldPrice

    const repricing = store.createRepricing({
      rule: { kind: 'percent', value: 20, roundTo: 1 },
      categoryId: '',
      brandId: '',
      locationId: '',
      comment: '',
    })
    useDataStore.getState().applyRepricing(repricing.id)

    const after = discountOf(withDiscount.id)!
    // The discount keeps its shape rather than its absolute size.
    expect(after / priceOf(withDiscount.id)).toBeCloseTo(share, 2)
  })

  it('refuses to apply when the rule changes nothing', () => {
    const store = useDataStore.getState()
    const repricing = store.createRepricing({
      rule: { kind: 'manual', value: 0, roundTo: 1 },
      categoryId: '',
      brandId: '',
      locationId: '',
      comment: '',
    })
    expect(useDataStore.getState().applyRepricing(repricing.id).ok).toBe(false)
  })

  it('cannot be applied twice, or reverted before it is applied', () => {
    const store = useDataStore.getState()
    const repricing = store.createRepricing({
      rule: { kind: 'percent', value: 3, roundTo: 1 },
      categoryId: '',
      brandId: '',
      locationId: '',
      comment: '',
    })
    expect(useDataStore.getState().revertRepricing(repricing.id).ok).toBe(false)
    useDataStore.getState().applyRepricing(repricing.id)
    expect(useDataStore.getState().applyRepricing(repricing.id).ok).toBe(false)
  })

  it('keeps the nested product and the flat catalogue row in step', () => {
    const store = useDataStore.getState()
    const repricing = store.createRepricing({
      rule: { kind: 'percent', value: 5, roundTo: 100 },
      categoryId: '',
      brandId: '',
      locationId: '',
      comment: '',
    })
    useDataStore.getState().applyRepricing(repricing.id)

    const nested = useDataStore
      .getState()
      .products.find((p) => p.id === 'prd-1')
      ?.variations.find((v) => v.id === 'var-1-1')
    const flat = useDataStore.getState().variations.find((v) => v.id === 'var-1-1')
    expect(nested?.salePrice).toBe(flat?.salePrice)
    expect(nested?.discountPrice).toBe(flat?.discountPrice)
  })
})
