import { z } from 'zod'
import type { Id, IsoDate } from '@/shared/types'

export type ProductStatus = 'active' | 'archived' | 'draft'
export type UnitOfMeasure = 'pcs' | 'kg' | 'l' | 'm' | 'pack'

/**
 * Suppliers are paid in USD while customers pay in UZS — that is how an
 * importer of truck parts actually operates, and it is visible in the
 * reference data (supplier price 85 USD, sale price 1 476 000 UZS). Cost
 * therefore carries its own currency; it is never assumed to be UZS.
 */
export type CostCurrency = 'USD' | 'UZS'

/** Which side of the vehicle a part belongs to. Core to auto parts. */
export type PartSide = 'left' | 'right' | 'both' | null

export const PART_SIDES: { value: Exclude<PartSide, null>; label: string }[] = [
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
  { value: 'both', label: 'Universal' },
]

export interface ProductStock {
  locationId: Id
  locationName: string
  quantity: number
}

export interface Product {
  id: Id
  sku: string
  barcode: string | null
  name: string
  /** Free text; in the reference data this holds the OEM number. */
  description: string | null
  categoryId: Id
  categoryName: string
  /** Full hierarchy, e.g. "Steps & parts > Steps & parts DAF 105-95". */
  categoryPath: string
  brandId: Id | null
  brandName: string | null
  tags: string[]
  unit: UnitOfMeasure

  /** Minimum order quantity a supplier will accept. */
  moq: number | null

  costPrice: number
  costCurrency: CostCurrency
  salePrice: number
  /** Promotional price when one is set; null means it sells at salePrice. */
  discountPrice: number | null

  /** Summed across locations; the per-location split lives in `stockByLocation`. */
  stock: number
  stockByLocation: ProductStock[]
  lowStockThreshold: number | null
  /** Shelf or bin reference, for picking. */
  shelfAddress: string | null

  /** Which vehicles the part fits — how an auto-parts catalogue is searched. */
  vehicleMake: string | null
  vehicleModels: string[]
  partSide: PartSide

  cargoWeightKg: number | null
  /** Free text, e.g. "120*60*30". */
  cargoSize: string | null

  isShippable: boolean
  showOnline: boolean

  status: ProductStatus
  imageUrl: string | null
  createdAt: IsoDate
  updatedAt: IsoDate
}

export const productFormSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  sku: z.string().min(1, 'SKU is required'),
  barcode: z.string().nullable(),
  description: z.string().nullable(),
  categoryId: z.string().min(1, 'Pick a category'),
  brandId: z.string().nullable(),
  tags: z.array(z.string()),
  unit: z.enum(['pcs', 'kg', 'l', 'm', 'pack']),
  moq: z.number().int().positive().nullable(),
  costPrice: z.number().nonnegative(),
  costCurrency: z.enum(['USD', 'UZS']),
  salePrice: z.number().nonnegative(),
  discountPrice: z.number().nonnegative().nullable(),
  lowStockThreshold: z.number().int().nonnegative().nullable(),
  shelfAddress: z.string().nullable(),
  vehicleMake: z.string().nullable(),
  vehicleModels: z.array(z.string()),
  partSide: z.enum(['left', 'right', 'both']).nullable(),
  cargoWeightKg: z.number().nonnegative().nullable(),
  cargoSize: z.string().nullable(),
  isShippable: z.boolean(),
  showOnline: z.boolean(),
  status: z.enum(['active', 'archived', 'draft']),
})

export type ProductFormValues = z.infer<typeof productFormSchema>

/** The price a customer actually pays today. */
export const effectivePrice = (product: Pick<Product, 'salePrice' | 'discountPrice'>) =>
  product.discountPrice ?? product.salePrice

/** Derived, never stored — margin must always follow live prices. */
export function marginRatio(
  product: Pick<Product, 'costPrice' | 'costCurrency' | 'salePrice' | 'discountPrice'>,
  usdRate: number,
): number {
  const price = effectivePrice(product)
  if (price === 0) return 0
  const cost = product.costCurrency === 'USD' ? product.costPrice * usdRate : product.costPrice
  return (price - cost) / price
}
