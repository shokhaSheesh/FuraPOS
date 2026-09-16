import type { Id, IsoDate } from '@/shared/types'

/**
 * An order somebody placed **with us**.
 *
 * The mirror of a purchase order: `Procurement → Orders` is us asking a
 * supplier for goods, and this is a garage, a fleet or a reseller asking *us*.
 * The two halves of one trade, seen from opposite ends — and the reason this
 * is a module rather than a kind of sale is the middle of it. A sale is a
 * single event: it happens, stock leaves, money is owed. An order placed with
 * us has a life: it arrives, we accept it, we ship it — often in parts, often
 * short — and the other side counts what turned up and tells us.
 *
 * Neither of the existing sales screens can hold that. Offline sales is typed
 * in by us at the counter, and Online sales is a read-only feed from the
 * e-commerce app that we are not allowed to act on.
 */
export type PartnerOrderStatus =
  'new' | 'confirmed' | 'partial' | 'shipped' | 'completed' | 'cancelled'

export const PARTNER_ORDER_STATUSES: {
  value: PartnerOrderStatus
  label: string
  tone: 'neutral' | 'info' | 'warning' | 'success' | 'danger'
  hint: string
}[] = [
  { value: 'new', label: 'New', tone: 'info', hint: 'They have placed it; we have not answered' },
  { value: 'confirmed', label: 'Confirmed', tone: 'info', hint: 'We have accepted it' },
  { value: 'partial', label: 'Part shipped', tone: 'warning', hint: 'Some of it has gone' },
  { value: 'shipped', label: 'Shipped', tone: 'info', hint: 'All of it has gone, not yet counted' },
  {
    value: 'completed',
    label: 'Completed',
    tone: 'success',
    hint: 'They have counted what arrived',
  },
  { value: 'cancelled', label: 'Cancelled', tone: 'danger', hint: 'Closed without shipping' },
]

const meta = (status: PartnerOrderStatus) =>
  PARTNER_ORDER_STATUSES.find((entry) => entry.value === status)!

export const partnerStatusLabel = (status: PartnerOrderStatus) => meta(status).label
export const partnerStatusTone = (status: PartnerOrderStatus) => meta(status).tone

export type Currency = 'USD' | 'UZS'

/**
 * Three quantities, because three different people counted.
 *
 * What they asked for, what we put on the lorry, and what they found in the
 * box. Collapsing any pair of them loses the only thing worth knowing: a
 * shortfall, and which end of the journey it happened at.
 */
export interface PartnerOrderLine {
  id: string
  variationId: Id
  productId: Id
  sku: string
  name: string
  imageUrl: string | null
  unit: string
  /** What they asked for. */
  orderedQuantity: number
  /** What we have sent, across every shipment. */
  shippedQuantity: number
  /** What they have told us arrived. */
  receivedQuantity: number
  /** What they are paying per unit, agreed when the order was accepted. */
  unitPrice: number
  currency: Currency
}

/** One lorry-load. An order is shipped in as many as it takes. */
export interface PartnerShipment {
  id: string
  number: string
  shippedAt: IsoDate
  shippedBy: string
  /** How many of each line went on this one. */
  quantities: Record<string, number>
  note: string | null
}

export interface PartnerOrder {
  id: Id
  number: string
  status: PartnerOrderStatus
  /** The business that placed it — a client of ours, on account. */
  clientId: Id
  clientName: string
  /** The shelf it ships from. Their goods leave from somewhere. */
  locationId: Id
  locationName: string
  /** When they wanted it by. Null when they did not say. */
  wantedBy: IsoDate | null
  lines: PartnerOrderLine[]
  shipments: PartnerShipment[]
  comment: string | null
  placedAt: IsoDate
  confirmedAt: IsoDate | null
  closedAt: IsoDate | null
  updatedAt: IsoDate
}

/* --- arithmetic ---------------------------------------------------------- */

export const toUzs = (amount: number, currency: Currency, usdRate: number) =>
  currency === 'USD' ? amount * usdRate : amount

export const orderedUnits = (order: Pick<PartnerOrder, 'lines'>) =>
  order.lines.reduce((sum, line) => sum + line.orderedQuantity, 0)

export const shippedUnits = (order: Pick<PartnerOrder, 'lines'>) =>
  order.lines.reduce((sum, line) => sum + line.shippedQuantity, 0)

export const receivedUnits = (order: Pick<PartnerOrder, 'lines'>) =>
  order.lines.reduce((sum, line) => sum + line.receivedQuantity, 0)

/** Still to send on one line, never below zero. */
export const lineOutstanding = (line: PartnerOrderLine) =>
  Math.max(0, line.orderedQuantity - line.shippedQuantity)

export const outstandingUnits = (order: Pick<PartnerOrder, 'lines'>) =>
  order.lines.reduce((sum, line) => sum + lineOutstanding(line), 0)

/**
 * What went missing between our shelf and theirs.
 *
 * Only countable once they have told us what arrived, and only on lines we
 * have actually shipped — a line still sitting here is outstanding, not lost,
 * and counting it as a loss would make every part-shipped order look like a
 * disaster.
 */
export const lineShortfall = (line: PartnerOrderLine, confirmed: boolean) =>
  confirmed ? Math.max(0, line.shippedQuantity - line.receivedQuantity) : 0

export const shortfallUnits = (order: Pick<PartnerOrder, 'lines' | 'status'>) =>
  order.status === 'completed'
    ? order.lines.reduce((sum, line) => sum + lineShortfall(line, true), 0)
    : 0

/** What the order is worth, priced at what they agreed to pay. */
export const orderValue = (order: Pick<PartnerOrder, 'lines'>, usdRate: number) =>
  order.lines.reduce(
    (sum, line) => sum + line.orderedQuantity * toUzs(line.unitPrice, line.currency, usdRate),
    0,
  )

/** What we have actually sent them, which is what they owe for. */
export const shippedValue = (order: Pick<PartnerOrder, 'lines'>, usdRate: number) =>
  order.lines.reduce(
    (sum, line) => sum + line.shippedQuantity * toUzs(line.unitPrice, line.currency, usdRate),
    0,
  )

/** How much of it has gone, as a fraction. */
export const shippedRatio = (order: Pick<PartnerOrder, 'lines'>) => {
  const ordered = orderedUnits(order)
  return ordered === 0 ? 0 : shippedUnits(order) / ordered
}

/* --- what happens next --------------------------------------------------- */

/**
 * The one step the order can take from where it is.
 *
 * Shipping is deliberately not among them, for the reason receiving is not a
 * status on a purchase order: it is an event that happens as many times as it
 * takes, not a rung on a ladder. `partial` and `shipped` are *derived* from
 * what has gone, never picked.
 */
export function nextStep(
  status: PartnerOrderStatus,
): { to: PartnerOrderStatus; label: string } | null {
  return status === 'new' ? { to: 'confirmed', label: 'Accept the order' } : null
}

export const canShip = (status: PartnerOrderStatus) =>
  status === 'confirmed' || status === 'partial'

/** Their side of it: they can only count what has actually been sent. */
export const canConfirmDelivery = (status: PartnerOrderStatus) =>
  status === 'partial' || status === 'shipped'

export const canCancel = (status: PartnerOrderStatus) =>
  status !== 'completed' && status !== 'cancelled'

/** Where an order stands once a shipment has gone out. */
export function statusAfterShipping(order: Pick<PartnerOrder, 'lines'>): PartnerOrderStatus {
  return outstandingUnits(order) === 0 ? 'shipped' : 'partial'
}
