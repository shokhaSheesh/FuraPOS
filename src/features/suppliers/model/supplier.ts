import { z } from 'zod'
import type { Id, IsoDate } from '@/shared/types'

/**
 * Who we buy from.
 *
 * OX's Поставщики is the most substantial screen in the product, and reading it
 * explains why: it is not a contact list. Every column is money or movement —
 * what we owe, when we last paid, what we bought, what is still on the shelf,
 * how much of it has sold. A supplier's name and phone number are the least
 * interesting thing about it.
 *
 * We follow that. Contact details exist because someone has to be rung, but the
 * screen answers "how is this relationship going".
 */
export interface Supplier {
  id: Id
  name: string
  /** Broad region, as OX's `Зона` column — "Uzbekistan", "Türkiye". */
  zone: string | null
  contactName: string | null
  phone: string | null
  email: string | null
  address: string | null
  /** Days we are given to pay. Null when nothing was agreed. */
  paymentTermDays: number | null
  /**
   * What we owe them, positive. Kept on the supplier rather than derived from
   * receipts, because an invoice can be paid before or after its goods arrive
   * and the two are not the same ledger.
   */
  debt: number
  lastPaymentAt: IsoDate | null
  comment: string | null
  status: 'active' | 'archived'
  createdAt: IsoDate
  updatedAt: IsoDate
}

/**
 * What a supplier looks like once the receipts and the catalogue are read.
 * Derived, never stored: a stored total is a total that goes stale.
 */
export interface SupplierStats {
  /** Landed value of everything received from them. */
  purchased: number
  purchasedUnits: number
  /** Units still on a shelf that came from them, and what they are worth. */
  onHandUnits: number
  onHandValue: number
  /**
   * Roughly how much of what we bought has since sold, by value. The same
   * estimate as a receipt's sell-through and with the same caveat: without lot
   * tracking, stock still on the shelf is assumed to be theirs.
   */
  soldValue: number
  soldRatio: number
  receipts: number
  lastReceiptAt: IsoDate | null
  /** Distinct products ever received from them. */
  products: number
}

/** No receipt and nothing sold in this long counts as dormant. */
export const DORMANT_DAYS = 90

export const isDormant = (stats: Pick<SupplierStats, 'lastReceiptAt'>) => {
  if (!stats.lastReceiptAt) return true
  return Date.now() - new Date(stats.lastReceiptAt).getTime() > DORMANT_DAYS * 86_400_000
}

export const owesMoney = (supplier: Pick<Supplier, 'debt'>) => supplier.debt > 0

/**
 * How overdue a debt is, in days past the agreed terms. Null when nothing is
 * owed or no terms were agreed — an unpaid invoice is not late until someone
 * said when it was due.
 */
export function daysOverdue(
  supplier: Pick<Supplier, 'debt' | 'lastPaymentAt' | 'paymentTermDays'>,
): number | null {
  if (supplier.debt <= 0 || supplier.paymentTermDays === null) return null
  const since = supplier.lastPaymentAt ? new Date(supplier.lastPaymentAt).getTime() : null
  if (since === null) return null
  const elapsed = (Date.now() - since) / 86_400_000
  const over = Math.floor(elapsed - supplier.paymentTermDays)
  return over > 0 ? over : null
}

/* --- validation --------------------------------------------------------- */

export const supplierFormSchema = z.object({
  name: z.string().min(2, 'A supplier needs a name'),
  zone: z.string(),
  contactName: z.string(),
  phone: z.string(),
  email: z.string().refine((value) => value === '' || /.+@.+\..+/.test(value), 'Not an email'),
  address: z.string(),
  paymentTermDays: z.number().int().nonnegative().nullable(),
  comment: z.string(),
  status: z.enum(['active', 'archived']),
})

export type SupplierFormValues = z.infer<typeof supplierFormSchema>

export const paymentSchema = z.object({
  amount: z.number().positive('How much was paid?'),
  comment: z.string(),
})

export type PaymentValues = z.infer<typeof paymentSchema>
