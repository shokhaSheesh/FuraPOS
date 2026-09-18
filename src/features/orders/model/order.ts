import { z } from 'zod'
import type { Id, IsoDate, ProcurementKind } from '@/shared/types'
import { procurementSource } from '@/shared/types'
import { t } from '@/shared/i18n'

/**
 * A purchase order: what we asked a supplier to send, before it arrives.
 *
 * Until now goods receipts appeared from nowhere — stock turned up and someone
 * typed what was in the box. An order is the other half: the commitment made
 * weeks earlier, which is what makes "where is it" and "is it late" answerable
 * at all, and what a delivery gets checked *against* rather than merely
 * recorded.
 */
export type OrderStatus = 'draft' | 'sent' | 'confirmed' | 'partial' | 'received' | 'cancelled'

/**
 * Where the goods come from, which decides how the order is put together.
 * Shared with goods receipt — see `ProcurementKind` — because an order placed
 * with the bazaar has to arrive as a receipt from the bazaar.
 *
 *   - **supplier** — a company we trade with. The order is built from *their*
 *     catalogue and sent to them.
 *   - **market** — bought off the bazaar, from nobody we have an account with.
 *     There is no supplier to send it to and no catalogue of theirs, so it is
 *     built from ours, and it works as the shopping list for the market run.
 *     It is still received like any other order when the goods come back.
 *   - **china** — made to order by a factory in China. Also built from our
 *     catalogue, but each line carries how urgently it is needed, and the whole
 *     order is handed over as a PDF the factory can work from.
 */
export type OrderKind = ProcurementKind

/** Prices are agreed in USD as often as in UZS, so a line carries its own. */
export type Currency = 'USD' | 'UZS'

/** The order module's own wording for the three; the values are shared. */
export const ORDER_KINDS: { value: OrderKind; label: string; hint: string }[] = [
  {
    value: 'supplier',
    label: 'From a supplier',
    hint: 'Pick from their catalogue and send it to them',
  },
  {
    value: 'market',
    label: 'From the market',
    hint: 'Bought at the bazaar — pick from our catalogue, or add what we do not carry yet',
  },
  {
    value: 'china',
    // Named for where the goods come from, like the other two, rather than for
    // where the paperwork goes. A buyer thinks in deliveries, not in post.
    label: 'From China',
    hint: 'Made to order by a factory — picked from our catalogue, and handed over as a PDF',
  },
]

export const ORDER_STATUSES: {
  value: OrderStatus
  label: string
  tone: 'neutral' | 'info' | 'warning' | 'success' | 'danger'
}[] = [
  // «Незавершённый» — the client's word, as on transfers and goods receipts.
  { value: 'draft', label: 'Unfinished', tone: 'neutral' },
  { value: 'sent', label: 'Sent', tone: 'info' },
  { value: 'confirmed', label: 'Confirmed', tone: 'info' },
  { value: 'partial', label: 'Part delivered', tone: 'warning' },
  { value: 'received', label: 'Delivered', tone: 'success' },
  { value: 'cancelled', label: 'Cancelled', tone: 'danger' },
]

export const orderStatusLabel = (status: OrderStatus) =>
  t(ORDER_STATUSES.find((entry) => entry.value === status)?.label ?? status)

export const orderStatusTone = (status: OrderStatus) =>
  ORDER_STATUSES.find((entry) => entry.value === status)?.tone ?? 'neutral'

export interface OrderLine {
  id: string
  variationId: Id
  productId: Id
  sku: string
  name: string
  imageUrl: string | null
  unit: string
  /** What we asked for. */
  orderedQuantity: number
  /**
   * How much has actually turned up, summed across every delivery against this
   * order. Not typed here — it is written by the receipts, so the order can
   * never claim more arrived than a receipt recorded.
   */
  receivedQuantity: number
  /** The agreed price, which is the point of having an order at all. */
  unitCost: number
  costCurrency: 'USD' | 'UZS'
}

export interface PurchaseOrder {
  id: Id
  number: string
  status: OrderStatus
  kind: OrderKind
  supplierId: Id | null
  supplierName: string | null
  /** Who or where a market purchase was made — "Jomiy bozori, row 4". Null for a supplier order. */
  boughtFrom: string | null
  /** Where the goods are expected to land. */
  locationId: Id
  locationName: string
  /** When the supplier said it would arrive. Null when nothing was promised. */
  expectedAt: IsoDate | null
  lines: OrderLine[]
  comment: string | null
  /** Every delivery booked against this order, in order. */
  receiptIds: Id[]
  createdBy: string
  createdAt: IsoDate
  sentAt: IsoDate | null
  closedAt: IsoDate | null
  updatedAt: IsoDate
}

/** Who the order is with, in one phrase, whichever kind it is. */
export const orderSource = (order: Pick<PurchaseOrder, 'kind' | 'supplierName' | 'boughtFrom'>) =>
  procurementSource(order)

/* --- what is still coming ------------------------------------------------ */

export const lineOutstanding = (line: OrderLine) =>
  Math.max(0, line.orderedQuantity - line.receivedQuantity)

export const orderedUnits = (order: Pick<PurchaseOrder, 'lines'>) =>
  order.lines.reduce((sum, line) => sum + line.orderedQuantity, 0)

export const receivedUnits = (order: Pick<PurchaseOrder, 'lines'>) =>
  order.lines.reduce((sum, line) => sum + line.receivedQuantity, 0)

export const outstandingUnits = (order: Pick<PurchaseOrder, 'lines'>) =>
  order.lines.reduce((sum, line) => sum + lineOutstanding(line), 0)

/** How much of the order has landed, for the progress bar. */
export function deliveredRatio(order: Pick<PurchaseOrder, 'lines'>) {
  const ordered = orderedUnits(order)
  return ordered === 0 ? 0 : Math.min(1, receivedUnits(order) / ordered)
}

export const toUzs = (amount: number, currency: 'USD' | 'UZS', usdRate: number) =>
  currency === 'USD' ? amount * usdRate : amount

/** What the whole order is worth at the agreed prices. */
export const orderValue = (order: Pick<PurchaseOrder, 'lines'>, usdRate: number) =>
  order.lines.reduce(
    (sum, line) => sum + line.orderedQuantity * toUzs(line.unitCost, line.costCurrency, usdRate),
    0,
  )

/** What is still to come, in money — the exposure on an open order. */
export const outstandingValue = (order: Pick<PurchaseOrder, 'lines'>, usdRate: number) =>
  order.lines.reduce(
    (sum, line) => sum + lineOutstanding(line) * toUzs(line.unitCost, line.costCurrency, usdRate),
    0,
  )

/**
 * Days past the date the supplier promised. Null when nothing is outstanding or
 * no date was given — an order is not late until someone said when it was due,
 * and a delivered order cannot be late at all.
 */
export function daysLate(
  order: Pick<PurchaseOrder, 'expectedAt' | 'lines' | 'status'>,
): number | null {
  if (!order.expectedAt) return null
  if (order.status === 'received' || order.status === 'cancelled') return null
  if (outstandingUnits(order) === 0) return null
  const over = Math.floor((Date.now() - new Date(order.expectedAt).getTime()) / 86_400_000)
  return over > 0 ? over : null
}

/** An order still waiting on goods. */
export const isOpen = (status: OrderStatus) =>
  status === 'sent' || status === 'confirmed' || status === 'partial'

/**
 * The one step an order takes from where it is. Receiving is deliberately not
 * here: it is not a status change but a delivery, and it happens as many times
 * as the supplier ships.
 */
export function nextStep(
  status: OrderStatus,
  kind: OrderKind = 'supplier',
): { to: OrderStatus; label: string } | null {
  switch (status) {
    case 'draft':
      // Nobody to send a market list to — it is simply agreed and goes out.
      return kind === 'market'
        ? { to: 'confirmed', label: t('Confirm purchase') }
        : kind === 'china'
          ? { to: 'sent', label: t('Send to factory') }
          : { to: 'sent', label: t('Send to supplier') }
    case 'sent':
      return { to: 'confirmed', label: t('Mark as confirmed') }
    default:
      return null
  }
}

export const canReceive = (status: OrderStatus) =>
  status === 'sent' || status === 'confirmed' || status === 'partial'

export const canCancel = (status: OrderStatus) => status !== 'received' && status !== 'cancelled'

/* --- validation --------------------------------------------------------- */

export const orderLineSchema = z.object({
  id: z.string(),
  variationId: z.string(),
  productId: z.string(),
  sku: z.string(),
  name: z.string(),
  imageUrl: z.string().nullable(),
  unit: z.string(),
  orderedQuantity: z.number().positive('Order at least one'),
  receivedQuantity: z.number().nonnegative(),
  unitCost: z.number().nonnegative(),
  costCurrency: z.enum(['USD', 'UZS']),
})

export const orderDraftSchema = z
  .object({
    kind: z.enum(['supplier', 'market', 'china']),
    supplierId: z.string(),
    boughtFrom: z.string(),
    locationId: z.string().min(1, 'Pick where it should land'),
    expectedAt: z.string().nullable(),
    comment: z.string(),
    lines: z.array(orderLineSchema).min(1, 'Add at least one product'),
  })
  .superRefine((values, ctx) => {
    // Only a supplier order has somebody to send it to.
    if (values.kind === 'supplier' && !values.supplierId) {
      ctx.addIssue({ code: 'custom', path: ['supplierId'], message: 'Pick who this order goes to' })
    }
  })

export type OrderDraft = z.infer<typeof orderDraftSchema>
