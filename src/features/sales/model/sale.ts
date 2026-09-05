import { z } from 'zod'
import type { Id, IsoDate } from '@/shared/types'

export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'credit'
export type SaleStatus = 'draft' | 'completed' | 'postponed' | 'deleted'

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'transfer', label: 'Bank transfer' },
  { value: 'credit', label: 'On credit' },
]

export interface SaleLine {
  /** Client-side row id; a product can legitimately appear twice. */
  id: string
  productId: Id
  sku: string
  name: string
  unit: string
  quantity: number
  unitPrice: number
  /** Per-line discount, as a percentage of that line's gross. */
  discountPercent: number
}

export interface Sale {
  id: Id
  number: string
  status: SaleStatus
  clientId: Id | null
  clientName: string | null
  locationId: Id
  locationName: string
  sellerName: string
  paymentMethod: PaymentMethod
  comment: string | null
  lines: SaleLine[]
  subtotal: number
  discount: number
  total: number
  paid: number
  /** total - paid, floored at zero. What the client still owes. */
  debt: number
  createdAt: IsoDate
}

/* --- money -------------------------------------------------------------- */

export const lineGross = (line: SaleLine) => line.quantity * line.unitPrice
export const lineDiscount = (line: SaleLine) => (lineGross(line) * line.discountPercent) / 100
export const lineTotal = (line: SaleLine) => lineGross(line) - lineDiscount(line)

export interface SaleTotals {
  subtotal: number
  discount: number
  total: number
  change: number
  debt: number
}

/**
 * One place computes the money, so the lines table, the totals panel and the
 * payload can never disagree. Nothing here is stored — always derive.
 */
export function computeTotals(lines: SaleLine[], paid: number): SaleTotals {
  const subtotal = lines.reduce((sum, line) => sum + lineGross(line), 0)
  const discount = lines.reduce((sum, line) => sum + lineDiscount(line), 0)
  const total = subtotal - discount
  return {
    subtotal,
    discount,
    total,
    change: Math.max(0, paid - total),
    debt: Math.max(0, total - paid),
  }
}

/* --- validation --------------------------------------------------------- */

export const saleLineSchema = z.object({
  id: z.string(),
  productId: z.string(),
  sku: z.string(),
  name: z.string(),
  unit: z.string(),
  quantity: z.number().positive('Quantity must be more than zero'),
  unitPrice: z.number().nonnegative(),
  discountPercent: z.number().min(0).max(100),
})

export const saleDraftSchema = z.object({
  clientId: z.string().nullable(),
  locationId: z.string().min(1, 'Pick a location'),
  paymentMethod: z.enum(['cash', 'card', 'transfer', 'credit']),
  comment: z.string(),
  paid: z.number().nonnegative(),
  lines: z.array(saleLineSchema).min(1, 'Add at least one product'),
})

export type SaleDraft = z.infer<typeof saleDraftSchema>
