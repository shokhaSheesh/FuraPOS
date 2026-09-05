import { z } from 'zod'
import type { Id, IsoDate } from '@/shared/types'

export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'credit'

/**
 * OX's status set, adopted verbatim (Новые / Обработано / Доставляется /
 * Доставлено / Завершён / Отложки / Открыто / Удалено). The delivery states
 * are not POS leftovers — they are an order-fulfilment lifecycle, which is
 * exactly what a counter that also takes phone orders needs.
 */
export type SaleStatus =
  'open' | 'new' | 'processed' | 'delivering' | 'delivered' | 'completed' | 'postponed' | 'deleted'

export const SALE_STATUSES: {
  value: SaleStatus
  label: string
  tone: 'neutral' | 'info' | 'warning' | 'success' | 'danger'
}[] = [
  { value: 'open', label: 'Open', tone: 'neutral' },
  { value: 'new', label: 'New', tone: 'info' },
  { value: 'processed', label: 'Processed', tone: 'info' },
  { value: 'delivering', label: 'Delivering', tone: 'warning' },
  { value: 'delivered', label: 'Delivered', tone: 'success' },
  { value: 'completed', label: 'Completed', tone: 'success' },
  { value: 'postponed', label: 'Postponed', tone: 'warning' },
  { value: 'deleted', label: 'Deleted', tone: 'danger' },
]

/**
 * Where the sale came from. OX has a boolean "Интернет-магазин" flag because
 * its only two origins are the POS and the web shop; with manual entry the
 * useful distinction is who was in front of you.
 */
export type SaleChannel = 'desk' | 'phone' | 'online'

export const SALE_CHANNELS: { value: SaleChannel; label: string }[] = [
  { value: 'desk', label: 'At the counter' },
  { value: 'phone', label: 'By phone' },
  { value: 'online', label: 'Online store' },
]

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
  channel: SaleChannel
  comment: string | null
  lines: SaleLine[]
  delivery: SaleDelivery | null
  subtotal: number
  discount: number
  deliveryCost: number
  total: number
  paid: number
  /** total - paid, floored at zero. What the client still owes. */
  debt: number
  /** Only on a postponed sale: when the reservation lapses. */
  expiresAt: IsoDate | null
  createdAt: IsoDate
  updatedAt: IsoDate
  /** When the sale reached a terminal state. Null while it is still moving. */
  finishedAt: IsoDate | null
}

export interface SaleDelivery {
  address: string
  cost: number
  /** Planned delivery date, ISO day. */
  scheduledFor: string | null
  courier: string | null
}

/* --- money -------------------------------------------------------------- */

export const lineGross = (line: SaleLine) => line.quantity * line.unitPrice
export const lineDiscount = (line: SaleLine) => (lineGross(line) * line.discountPercent) / 100
export const lineTotal = (line: SaleLine) => lineGross(line) - lineDiscount(line)

export interface SaleTotals {
  subtotal: number
  discount: number
  deliveryCost: number
  total: number
  change: number
  debt: number
}

/**
 * One place computes the money, so the lines table, the totals panel and the
 * payload can never disagree. Nothing here is stored — always derive.
 */
export function computeTotals(lines: SaleLine[], paid: number, deliveryCost = 0): SaleTotals {
  const subtotal = lines.reduce((sum, line) => sum + lineGross(line), 0)
  const discount = lines.reduce((sum, line) => sum + lineDiscount(line), 0)
  // Delivery is charged on top of goods, and is never discounted.
  const total = subtotal - discount + deliveryCost
  return {
    subtotal,
    discount,
    deliveryCost,
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

export const saleDeliverySchema = z.object({
  address: z.string().min(3, 'A delivery needs an address'),
  cost: z.number().nonnegative(),
  scheduledFor: z.string().nullable(),
  courier: z.string().nullable(),
})

export const saleDraftSchema = z.object({
  clientId: z.string().nullable(),
  locationId: z.string().min(1, 'Pick a location'),
  paymentMethod: z.enum(['cash', 'card', 'transfer', 'credit']),
  channel: z.enum(['desk', 'phone', 'online']),
  comment: z.string(),
  paid: z.number().nonnegative(),
  delivery: saleDeliverySchema.nullable(),
  expiresAt: z.string().nullable(),
  lines: z.array(saleLineSchema).min(1, 'Add at least one product'),
})

export type SaleDraft = z.infer<typeof saleDraftSchema>
