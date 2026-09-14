import type { Id, IsoDate } from '@/shared/types'

/**
 * An order placed in the e-commerce app.
 *
 * **Read-only here.** The order is created, paid for and moved through its
 * statuses by the e-commerce side (its own superadmin); this back office only
 * needs to *see* it — because it takes stock off our shelves, and because it is
 * revenue. So there is no status control, no cancel and no editing, and
 * anything the superadmin shows that exists only to run the app (gateway
 * metadata, "scheduled at", an empty seller field) is left out.
 *
 * Kept apart from `Sale` rather than squeezed into it: an online order has a
 * courier, a pickup point, cashback and payment transactions, and a sale typed
 * in at the counter has none of those.
 */
export type OnlineSaleStatus =
  'new' | 'preparing' | 'ready' | 'delivering' | 'delivered' | 'cancelled'

export const ONLINE_SALE_STATUSES: {
  value: OnlineSaleStatus
  label: string
  tone: 'neutral' | 'info' | 'warning' | 'success' | 'danger'
}[] = [
  { value: 'new', label: 'New', tone: 'info' },
  { value: 'preparing', label: 'Being prepared', tone: 'warning' },
  { value: 'ready', label: 'Ready for pickup', tone: 'info' },
  { value: 'delivering', label: 'In delivery', tone: 'info' },
  { value: 'delivered', label: 'Delivered', tone: 'success' },
  { value: 'cancelled', label: 'Cancelled', tone: 'danger' },
]

export const onlineStatusMeta = (status: OnlineSaleStatus) =>
  ONLINE_SALE_STATUSES.find((entry) => entry.value === status)!

export type PaymentStatus = 'paid' | 'unpaid' | 'refunded'

export const PAYMENT_STATUS_META: Record<
  PaymentStatus,
  { label: string; tone: 'success' | 'warning' | 'neutral' }
> = {
  paid: { label: 'Paid', tone: 'success' },
  unpaid: { label: 'Unpaid', tone: 'warning' },
  refunded: { label: 'Refunded', tone: 'neutral' },
}

export type PaymentProvider = 'payme' | 'click' | 'uzum' | 'cash'

export const PROVIDER_LABEL: Record<PaymentProvider, string> = {
  payme: 'Payme',
  click: 'Click',
  uzum: 'Uzum',
  cash: 'Cash on delivery',
}

export type DeliveryMethod = 'emu' | 'pickup' | 'courier'

export const DELIVERY_LABEL: Record<DeliveryMethod, string> = {
  emu: 'EMU courier',
  pickup: 'Pickup from our shop',
  courier: 'Our courier',
}

export interface OnlineSaleLine {
  id: Id
  variationId: Id
  productId: Id
  sku: string
  name: string
  imageUrl: string | null
  quantity: number
  unitPrice: number
}

export interface PaymentTransaction {
  id: Id
  provider: PaymentProvider
  /** The provider's own reference, for matching their statement. */
  reference: string
  status: 'success' | 'pending' | 'failed' | 'refunded'
  amount: number
  createdAt: IsoDate
}

export interface OnlineSale {
  id: Id
  /** The e-commerce app's number, kept as it is so the two systems agree. */
  number: string
  status: OnlineSaleStatus
  paymentStatus: PaymentStatus
  paymentProvider: PaymentProvider

  customerName: string
  customerPhone: string
  customerAddress: string | null
  customerNote: string | null
  /** The driver this customer is in our records, when they are one. */
  driverId: Id | null

  /** Our shop or warehouse the parts were picked from — where stock comes off. */
  locationId: Id
  locationName: string
  /** Who is preparing it on our side. */
  employeeName: string | null

  deliveryMethod: DeliveryMethod
  express: boolean
  /** An EMU pickup point, when the customer collects from one. */
  pickupPoint: string | null
  /** EMU's own status and order id, for chasing a parcel with them. */
  courierStatus: string | null
  courierOrderId: string | null
  estimatedDeliveryAt: IsoDate | null
  deliveredAt: IsoDate | null

  lines: OnlineSaleLine[]
  deliveryFee: number
  discount: number
  /** Paid for with the customer's cashback balance rather than money. */
  cashbackUsed: number

  transactions: PaymentTransaction[]
  createdAt: IsoDate
  updatedAt: IsoDate
}

/* --- money -------------------------------------------------------------- */

export const productsTotal = (sale: Pick<OnlineSale, 'lines'>) =>
  sale.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0)

/** What the order came to before cashback: products, plus delivery, less discount. */
export const orderTotal = (sale: Pick<OnlineSale, 'lines' | 'deliveryFee' | 'discount'>) =>
  productsTotal(sale) + sale.deliveryFee - sale.discount

/** What had to be paid in money once cashback was spent. Never below zero. */
export const payable = (
  sale: Pick<OnlineSale, 'lines' | 'deliveryFee' | 'discount' | 'cashbackUsed'>,
) => Math.max(0, orderTotal(sale) - sale.cashbackUsed)

/** Money actually received — successful transactions less refunds. */
export const amountPaid = (sale: Pick<OnlineSale, 'transactions'>) =>
  sale.transactions.reduce(
    (sum, t) => sum + (t.status === 'success' ? t.amount : t.status === 'refunded' ? -t.amount : 0),
    0,
  )

export const unitsOf = (sale: Pick<OnlineSale, 'lines'>) =>
  sale.lines.reduce((sum, line) => sum + line.quantity, 0)

/**
 * Whether the order holds stock. Everything but a cancellation does: parts
 * are set aside the moment an order is placed, and a cancelled one gives them
 * back. This is the rule the product log and stock both follow.
 */
export const takesStock = (sale: Pick<OnlineSale, 'status'>) => sale.status !== 'cancelled'
