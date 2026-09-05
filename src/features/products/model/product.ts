import { z } from 'zod'
import type { Id, IsoDate } from '@/shared/types'

export type ProductStatus = 'active' | 'archived' | 'draft'
export type UnitOfMeasure = 'pcs' | 'kg' | 'l' | 'm' | 'pack'

export interface Product {
  id: Id
  sku: string
  barcode: string | null
  name: string
  categoryId: Id
  categoryName: string
  brandId: Id | null
  brandName: string | null
  unit: UnitOfMeasure
  costPrice: number
  salePrice: number
  /** Summed across locations; per-location breakdown lives on the detail page. */
  stock: number
  lowStockThreshold: number | null
  status: ProductStatus
  imageUrl: string | null
  createdAt: IsoDate
  updatedAt: IsoDate
}

export const productFormSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  sku: z.string().min(1, 'SKU is required'),
  barcode: z.string().nullable(),
  categoryId: z.string().min(1, 'Pick a category'),
  brandId: z.string().nullable(),
  unit: z.enum(['pcs', 'kg', 'l', 'm', 'pack']),
  costPrice: z.number().nonnegative(),
  salePrice: z.number().nonnegative(),
  lowStockThreshold: z.number().int().nonnegative().nullable(),
  status: z.enum(['active', 'archived', 'draft']),
})

export type ProductFormValues = z.infer<typeof productFormSchema>

/** Derived, never stored — margin must always be computed from live prices. */
export function marginRatio(product: Pick<Product, 'costPrice' | 'salePrice'>) {
  if (product.salePrice === 0) return 0
  return (product.salePrice - product.costPrice) / product.salePrice
}
