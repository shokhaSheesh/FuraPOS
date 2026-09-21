import { describe, expect, it } from 'vitest'
import type { VariationRow } from '@/features/products/model/product'
import { addOne, quantityIn, setQuantity, unitsIn } from './cart'

const part = (id: string) =>
  ({
    id,
    productId: `p-${id}`,
    sku: `SKU-${id}`,
    fullName: `Part ${id}`,
    brandName: null,
    categoryName: null,
    imageUrl: null,
    unit: 'pcs',
    salePrice: 1000,
  }) as unknown as VariationRow

describe('the till cart', () => {
  it('adds a second tap to the same line rather than a new one', () => {
    const a = part('a')
    const cart = addOne(addOne([], a, 10), a, 10)
    expect(cart).toHaveLength(1)
    expect(quantityIn(cart, 'a')).toBe(2)
  })

  it('never sells more than the shelf holds', () => {
    const a = part('a')
    let cart = setQuantity([], a, 3, 3)
    cart = addOne(cart, a, 3)
    expect(quantityIn(cart, 'a')).toBe(3)
    expect(quantityIn(setQuantity([], a, 9, 2), 'a')).toBe(2)
  })

  it('takes a line out at zero and counts the units left', () => {
    const a = part('a')
    const b = part('b')
    let cart = setQuantity(setQuantity([], a, 2, 5), b, 4, 5)
    expect(unitsIn(cart)).toBe(6)
    cart = setQuantity(cart, a, 0, 5)
    expect(cart.map((line) => line.variationId)).toEqual(['b'])
  })

  it('prices a line at the sale price when it goes in', () => {
    expect(addOne([], part('a'), 5)[0]).toMatchObject({ unitPrice: 1000, discountPercent: 0 })
  })
})
