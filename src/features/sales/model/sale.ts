import { z } from 'zod'
import type { Id, IsoDate } from '@/shared/types'
import { t } from '@/shared/i18n'

export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'credit'

/**
 * OX's status set without its two delivery states. «Доставляется» and
 * «Доставлено» were dropped at the client's request along with delivery
 * itself: an offline sale leaves with the customer, so the lifecycle is
 * open / new / postponed → processed → completed, or deleted.
 */
export type SaleStatus = 'open' | 'new' | 'processed' | 'completed' | 'postponed' | 'deleted'

export const SALE_STATUSES: {
  value: SaleStatus
  label: string
  tone: 'neutral' | 'info' | 'warning' | 'success' | 'danger'
}[] = [
  { value: 'open', label: 'Open', tone: 'neutral' },
  { value: 'new', label: 'New', tone: 'info' },
  { value: 'processed', label: 'Processed', tone: 'info' },
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
  { value: 'card', label: 'Card transfer' },
  { value: 'transfer', label: 'Bank transfer' },
  { value: 'credit', label: 'On credit' },
]

export interface SaleLine {
  /** Client-side row id; a product can legitimately appear twice. */
  id: string
  /** The sellable unit. The parent product is kept for reporting. */
  variationId: Id
  productId: Id
  sku: string
  name: string
  /**
   * Brand, category and image are snapshotted onto the line rather than looked
   * up, for the same reason name and price already are: a sale is a record of
   * what was sold that day, and renaming or re-photographing a product later
   * must not rewrite history.
   */
  brandName: string | null
  categoryName: string | null
  imageUrl: string | null
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
  /**
   * Who made the sale. The id is what performance is counted on; the name is
   * snapshotted beside it so an employee who leaves and is archived does not
   * blank out the history of every sale they ever made.
   */
  sellerId: Id | null
  sellerName: string
  /**
   * The promotion applied to this sale, if any.
   *
   * Without it a discount is an anonymous number and no report can ever say
   * whether a campaign paid for itself — which is the whole reason promotions
   * are recorded as decisions rather than typed into a line.
   */
  promotionId: Id | null
  /**
   * Who collected the parts, and which truck they were for.
   *
   * Neither is used by this back-office directly — they exist because two
   * other apps read them. The e-commerce app shows a driver his offline
   * purchases under "My orders"; the autopark owner's app hangs an operation
   * on the truck's page. Without both on the sale, neither app has anything
   * to show, and an offline purchase simply disappears from the customer's view.
   *
   * The name is snapshotted beside the id for the same reason the seller's is:
   * a driver who leaves must not blank the history of what he bought.
   */
  driverId: Id | null
  driverName: string | null
  truckPlate: string | null
  paymentMethod: PaymentMethod
  /**
   * Which cash shift took the money. Only ever set on a cash sale — a card
   * payment never touches a drawer, so tying it to one would make every
   * cash-up wrong. Null on anything paid another way, and on the history from
   * before shifts existed.
   */
  shiftId: Id | null
  channel: SaleChannel
  comment: string | null
  lines: SaleLine[]
  subtotal: number
  discount: number
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
  /**
   * When money last came in against this sale (client request) — a driver or
   * an autopark is asked "when did they last pay us", and the answer is the
   * latest of these across their sales. Null means nothing has been paid.
   */
  lastPaidAt: IsoDate | null
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
  variationId: z.string(),
  productId: z.string(),
  sku: z.string(),
  name: z.string(),
  brandName: z.string().nullable(),
  categoryName: z.string().nullable(),
  imageUrl: z.string().nullable(),
  unit: z.string(),
  quantity: z.number().positive('Quantity must be more than zero'),
  unitPrice: z.number().nonnegative(),
  discountPercent: z.number().min(0).max(100),
})

export const saleDraftSchema = z.object({
  clientId: z.string().nullable(),
  locationId: z.string().min(1, 'Pick a location'),
  paymentMethod: z.enum(['cash', 'card', 'transfer', 'credit']),
  channel: z.enum(['desk', 'phone', 'online']),
  comment: z.string(),
  paid: z.number().nonnegative(),
  expiresAt: z.string().nullable(),
  lines: z.array(saleLineSchema).min(1, 'Add at least one product'),
})

export type SaleDraft = z.infer<typeof saleDraftSchema>

/**
 * The one step a sale can take from where it is. Driving the detail page's
 * primary action from this keeps the lifecycle in the model rather than
 * scattered through the UI — and there is only ever one next step, which is
 * what makes a single primary button honest.
 */
export function nextStep(status: SaleStatus): { to: SaleStatus; label: string } | null {
  switch (status) {
    case 'open':
    case 'postponed':
    case 'new':
      return { to: 'processed', label: t('Mark as processed') }
    // 'deleted' and 'completed' fall through to null: both are terminal.
    case 'processed':
      return { to: 'completed', label: t('Complete sale') }
    default:
      return null
  }
}

/**
 * When money last came in across a set of sales (client request) — the answer
 * to "when did they last pay us", asked of a driver or of an autopark.
 */
export function lastPaymentAt(sales: Pick<Sale, 'lastPaidAt'>[]): string | null {
  let latest: string | null = null
  for (const sale of sales) {
    if (sale.lastPaidAt && (latest === null || sale.lastPaidAt > latest)) latest = sale.lastPaidAt
  }
  return latest
}
