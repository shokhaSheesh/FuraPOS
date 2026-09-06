import { describe, expect, it } from 'vitest'
import { productFormSchema, type ProductFormValues } from './product'

const variation = (over: Partial<ProductFormValues['variations'][number]> = {}) => ({
  name: '',
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
  locationIds: ['loc-1'],
  variations: [variation()],
  ...over,
})

describe('product form schema', () => {
  it('does not ask a single-variation product to name its variation', () => {
    expect(productFormSchema.safeParse(values()).success).toBe(true)
  })

  it('requires a name once there is more than one variation to tell apart', () => {
    const result = productFormSchema.safeParse(
      values({
        variationMode: 'multiple',
        variations: [variation({ name: 'Left' }), variation({ sku: 'SKU-2' })],
      }),
    )
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['variations', 1, 'name'])
  })

  it('refuses a product that is stocked nowhere', () => {
    const result = productFormSchema.safeParse(values({ locationIds: [] }))
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe('Stock it at one location at least')
  })

  it('refuses a product with no variations at all', () => {
    expect(productFormSchema.safeParse(values({ variations: [] })).success).toBe(false)
  })
})
