import { z } from 'zod'
import type { Id, IsoDate } from '@/shared/types'

export type ProductStatus = 'active' | 'archived' | 'draft'
export type UnitOfMeasure = 'pcs' | 'kg' | 'l' | 'm' | 'pack'

/**
 * Suppliers are paid in USD while customers pay in UZS — that is how an
 * importer of truck parts operates, and it is visible in the reference data
 * (supplier price 85 USD against a sale price of 1 476 000 UZS). Cost
 * therefore carries its own currency and is never assumed to be UZS.
 */
export type CostCurrency = 'USD' | 'UZS'

/** Which side of the vehicle a part fits. The main variation axis here. */
export type PartSide = 'left' | 'right' | 'both'

export const PART_SIDES: { value: PartSide; label: string }[] = [
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
  { value: 'both', label: 'Universal' },
]

export interface StockAtLocation {
  locationId: Id
  locationName: string
  quantity: number
}

/**
 * The sellable unit. A product is the thing in the catalogue; a variation is
 * what actually has a barcode, a price and stock on a shelf — "DAF XF 105 step
 * — left" rather than "DAF XF 105 step".
 *
 * Everything that can differ between two variants of the same part lives here:
 * its own SKU, its own cost, its own stock. Everything shared — what the part
 * is, which vehicle it fits — lives on the product.
 */
export interface ProductVariation {
  id: Id
  productId: Id
  /** What distinguishes it, e.g. "Left" or "1.5 m". */
  name: string
  sku: string
  barcode: string | null
  partSide: PartSide | null

  costPrice: number
  costCurrency: CostCurrency
  salePrice: number
  /** Promotional price when set; null means it sells at salePrice. */
  discountPrice: number | null

  stock: number
  stockByLocation: StockAtLocation[]
  lowStockThreshold: number | null
  /** Shelf or bin reference, for picking. */
  shelfAddress: string | null
  /** Minimum quantity a supplier will accept. */
  moq: number | null

  imageUrl: string | null
  status: ProductStatus
}

export interface Product {
  id: Id
  name: string
  /** Free text; the reference tenant keeps the OEM number here. */
  description: string | null
  categoryId: Id
  categoryName: string
  /** Full hierarchy, e.g. "Chassis > Brakes". */
  categoryPath: string
  brandId: Id | null
  brandName: string | null
  tags: string[]
  unit: UnitOfMeasure

  /** Which vehicles it fits — how an auto-parts catalogue is searched. */
  vehicleMake: string | null
  vehicleModels: string[]

  cargoWeightKg: number | null
  /** Free text, e.g. "120*60*30". */
  cargoSize: string | null

  isShippable: boolean
  showOnline: boolean

  variations: ProductVariation[]
  status: ProductStatus
  createdAt: IsoDate
  updatedAt: IsoDate
}

/**
 * A variation flattened with the parent fields needed to display or search it.
 * This is what the catalogue lists and what a sale line points at.
 */
export interface VariationRow extends ProductVariation {
  productName: string
  /** Product name and variation together, e.g. "Brake disc — Left". */
  fullName: string
  description: string | null
  categoryName: string
  categoryPath: string
  brandName: string | null
  tags: string[]
  unit: UnitOfMeasure
  vehicleMake: string | null
  vehicleModels: string[]
  cargoWeightKg: number | null
  cargoSize: string | null
  isShippable: boolean
  showOnline: boolean
}

/* --- money -------------------------------------------------------------- */

export const effectivePrice = (v: Pick<ProductVariation, 'salePrice' | 'discountPrice'>) =>
  v.discountPrice ?? v.salePrice

export const costInUzs = (
  v: Pick<ProductVariation, 'costPrice' | 'costCurrency'>,
  usdRate: number,
) => (v.costCurrency === 'USD' ? v.costPrice * usdRate : v.costPrice)

/** Derived, never stored — margin must always follow live prices. */
export function marginRatio(
  v: Pick<ProductVariation, 'costPrice' | 'costCurrency' | 'salePrice' | 'discountPrice'>,
  usdRate: number,
): number {
  const price = effectivePrice(v)
  if (price === 0) return 0
  return (price - costInUzs(v, usdRate)) / price
}

/* --- product-level aggregates ------------------------------------------- */

export const productStock = (product: Product) =>
  product.variations.reduce((sum, v) => sum + v.stock, 0)

/** Products show a price range, since variations can be priced differently. */
export function productPriceRange(product: Product): { min: number; max: number } {
  const prices = product.variations.map(effectivePrice)
  return { min: Math.min(...prices), max: Math.max(...prices) }
}

/* --- validation --------------------------------------------------------- */

export const variationFormSchema = z.object({
  name: z.string().min(1, 'Every variation needs a name'),
  sku: z.string().min(1, 'SKU is required'),
  barcode: z.string().nullable(),
  partSide: z.enum(['left', 'right', 'both']).nullable(),
  costPrice: z.number().nonnegative(),
  costCurrency: z.enum(['USD', 'UZS']),
  salePrice: z.number().nonnegative(),
  discountPrice: z.number().nonnegative().nullable(),
  lowStockThreshold: z.number().int().nonnegative().nullable(),
  shelfAddress: z.string().nullable(),
  moq: z.number().int().positive().nullable(),
  status: z.enum(['active', 'archived', 'draft']),
})

export const productFormSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  description: z.string().nullable(),
  categoryId: z.string().min(1, 'Pick a category'),
  brandId: z.string().nullable(),
  tags: z.array(z.string()),
  unit: z.enum(['pcs', 'kg', 'l', 'm', 'pack']),
  vehicleMake: z.string().nullable(),
  vehicleModels: z.array(z.string()),
  cargoWeightKg: z.number().nonnegative().nullable(),
  cargoSize: z.string().nullable(),
  isShippable: z.boolean(),
  showOnline: z.boolean(),
  status: z.enum(['active', 'archived', 'draft']),
  // A product with no variations is not sellable.
  variations: z.array(variationFormSchema).min(1, 'Add at least one variation'),
})

export type ProductFormValues = z.infer<typeof productFormSchema>
