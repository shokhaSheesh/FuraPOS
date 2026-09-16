import { z } from 'zod'
import type { Id, IsoDate } from '@/shared/types'

/**
 * Goods arriving from a supplier — the only way stock legitimately enters the
 * business. Sales, transfers and corrections can all take it away; this is the
 * document that brings it in, and the one place a cost price is genuinely
 * discovered rather than typed from memory.
 */
export type ReceiptStatus = 'draft' | 'received' | 'cancelled'

/*
  The reference product's three states, kept verbatim: a receipt is either
  still being built (Не завершено), posted into stock (Завершено), or thrown
  away (Удалено). The stored values keep their old names so nothing else in the
  app has to change; only what the user reads is OX's.
*/
export const RECEIPT_STATUSES: {
  value: ReceiptStatus
  label: string
  tone: 'neutral' | 'success' | 'danger'
}[] = [
  { value: 'draft', label: 'Unfinished', tone: 'neutral' },
  { value: 'received', label: 'Completed', tone: 'success' },
  { value: 'cancelled', label: 'Deleted', tone: 'danger' },
]

export const receiptStatusLabel = (status: ReceiptStatus) =>
  RECEIPT_STATUSES.find((entry) => entry.value === status)?.label ?? status

export const receiptStatusTone = (status: ReceiptStatus) =>
  RECEIPT_STATUSES.find((entry) => entry.value === status)?.tone ?? 'neutral'

export type Currency = 'USD' | 'UZS'

export interface ReceiptLine {
  id: string
  variationId: Id
  productId: Id
  sku: string
  name: string
  imageUrl: string | null
  unit: string
  /** What the supplier's invoice says was shipped. */
  orderedQuantity: number
  /** What was actually counted off the truck. Null until the receipt is posted. */
  receivedQuantity: number | null
  /** The supplier's price per unit, before anything else is added. */
  unitCost: number
  costCurrency: Currency
}

/**
 * Money handed to the supplier against this delivery.
 *
 * Separate from the supplier's wallet balance on purpose: the wallet answers
 * "what do we owe them in total", this answers "what is still outstanding on
 * *this* delivery", and the payment step of the receipt is where the second
 * question gets asked.
 */
export interface ReceiptPayment {
  id: string
  paidAt: IsoDate
  /** Who handed the money over — an employee, not the supplier. */
  payerName: string
  /** The account it left: cash desk, bank, card. */
  accountName: string
  amount: number
  currency: Currency
  note: string | null
}

/**
 * How the landed cost on the review step is worked out. Both choices are the
 * reference product's, and both change only what is *shown* until the receipt
 * is posted — at which point the shown figure is the one written to the
 * catalogue.
 */
export interface CostSettings {
  /** Show it in UZS, or in whatever currency the supplier invoiced. */
  currency: 'uzs' | 'supplier'
  /** Spread the costs over what actually turned up, or over what was expected. */
  basis: 'actual' | 'expected'
}

export const DEFAULT_COST_SETTINGS: CostSettings = { currency: 'supplier', basis: 'actual' }

/**
 * Freight, customs duty, broker fees — everything that makes a part cost more
 * than the supplier charged for it. For an importer these are not a rounding
 * error, and a cost price that ignores them makes every margin on every screen
 * optimistic.
 */
export interface AdditionalCost {
  id: string
  label: string
  amount: number
  currency: Currency
}

export interface GoodsReceipt {
  id: Id
  number: string
  status: ReceiptStatus
  supplierId: Id | null
  supplierName: string | null
  /** The purchase order this delivery came against, when there was one. */
  orderId: Id | null
  orderNumber: string | null
  /** The supplier's own document number, for matching against their paperwork. */
  invoiceNumber: string | null
  locationId: Id
  locationName: string
  /**
   * The country or customs zone the goods come from, as the reference product
   * asks for it on the very first screen. It is the supplier's zone by default
   * but is asked separately, because a supplier can ship from more than one.
   */
  zone: string | null
  /**
   * The USD rate agreed for *this* delivery. Frozen on the document rather
   * than read live, because a receipt posted in March must not re-price itself
   * when the rate moves in April.
   */
  usdRate: number
  /** Count the shelf as part of posting, rather than trusting the paperwork. */
  stocktakeOnPost: boolean
  /** Land everything at one location, then move it on with a transfer. */
  distributeByTransfer: boolean
  lines: ReceiptLine[]
  additionalCosts: AdditionalCost[]
  payments: ReceiptPayment[]
  costSettings: CostSettings
  comment: string | null
  createdBy: string
  receivedBy: string | null
  createdAt: IsoDate
  receivedAt: IsoDate | null
  updatedAt: IsoDate
}

/* --- money --------------------------------------------------------------- */

export const toUzs = (amount: number, currency: Currency, usdRate: number) =>
  currency === 'USD' ? amount * usdRate : amount

/** The quantity that counts: what arrived if known, otherwise what was ordered. */
export const lineQuantity = (line: ReceiptLine) => line.receivedQuantity ?? line.orderedQuantity

/** What the supplier is owed for one line, in UZS. */
export const lineSupplierValue = (line: ReceiptLine, usdRate: number) =>
  lineQuantity(line) * toUzs(line.unitCost, line.costCurrency, usdRate)

/** What the supplier is owed for the whole receipt. */
export const supplierTotal = (receipt: Pick<GoodsReceipt, 'lines'>, usdRate: number) =>
  receipt.lines.reduce((sum, line) => sum + lineSupplierValue(line, usdRate), 0)

/**
 * What the supplier *invoiced*, whatever turned up — the figure a debt is built
 * from.
 *
 * Deliberately not `supplierTotal`, which counts what arrived: a short delivery
 * is a claim to settle with the supplier, not a discount they have agreed to.
 * Charging the counted quantity would forgive every shortfall silently, and the
 * business would never see the gap it is owed.
 */
export const supplierInvoicedTotal = (receipt: Pick<GoodsReceipt, 'lines'>, usdRate: number) =>
  receipt.lines.reduce(
    (sum, line) => sum + line.orderedQuantity * toUzs(line.unitCost, line.costCurrency, usdRate),
    0,
  )

/** What has actually been handed over against this delivery, in UZS. */
export const paidTotal = (receipt: Pick<GoodsReceipt, 'payments'>, usdRate: number) =>
  receipt.payments.reduce((sum, p) => sum + toUzs(p.amount, p.currency, usdRate), 0)

/**
 * What is still owed on this delivery: invoiced less paid, never below zero.
 * Built from the invoiced total for the reason `supplierInvoicedTotal` gives —
 * a short delivery is a claim to settle, not a discount already agreed.
 */
export const receiptDebt = (receipt: Pick<GoodsReceipt, 'lines' | 'payments'>, usdRate: number) =>
  Math.max(0, supplierInvoicedTotal(receipt, usdRate) - paidTotal(receipt, usdRate))

/** Freight, duty and the rest, in UZS. */
export const extraCostsTotal = (receipt: Pick<GoodsReceipt, 'additionalCosts'>, usdRate: number) =>
  receipt.additionalCosts.reduce((sum, cost) => sum + toUzs(cost.amount, cost.currency, usdRate), 0)

/** What the goods actually cost once they are on the shelf. */
export const landedTotal = (
  receipt: Pick<GoodsReceipt, 'lines' | 'additionalCosts'>,
  usdRate: number,
) => supplierTotal(receipt, usdRate) + extraCostsTotal(receipt, usdRate)

/**
 * How much the extras add, as a fraction of the supplier's price. The number an
 * importer actually wants: "everything costs 18% more than the invoice says".
 */
export const landedUplift = (
  receipt: Pick<GoodsReceipt, 'lines' | 'additionalCosts'>,
  usdRate: number,
) => {
  const goods = supplierTotal(receipt, usdRate)
  return goods === 0 ? 0 : extraCostsTotal(receipt, usdRate) / goods
}

/**
 * The landed cost of one unit of one line, in UZS.
 *
 * Extras are spread **in proportion to each line's value**, which is the
 * ordinary method and the only one that works with the data we have: freight is
 * really a function of weight or volume, but not every part carries a weight,
 * and a rule that silently skips half the lines is worse than one that
 * approximates all of them. (Recorded in docs/OX-NAVIGATION-MAP.md as a
 * question for the client — by weight would be more accurate if the catalogue's
 * cargo weights can be relied on.)
 */
export function landedUnitCost(
  line: ReceiptLine,
  receipt: Pick<GoodsReceipt, 'lines' | 'additionalCosts'>,
  usdRate: number,
): number {
  const quantity = lineQuantity(line)
  if (quantity === 0) return 0

  const supplierUnit = toUzs(line.unitCost, line.costCurrency, usdRate)
  const goods = supplierTotal(receipt, usdRate)
  if (goods === 0) return supplierUnit

  const share = lineSupplierValue(line, usdRate) / goods
  return supplierUnit + (extraCostsTotal(receipt, usdRate) * share) / quantity
}

/**
 * The quantity the review step's cost settings say to price on: what turned up
 * (the default) or what the paperwork expected. Spreading freight over
 * expected quantities is what you want while a delivery is still being
 * counted — the per-unit figure then stops jumping with every line typed.
 */
export const basisQuantity = (line: ReceiptLine, basis: CostSettings['basis']) =>
  basis === 'expected' ? line.orderedQuantity : lineQuantity(line)

/** `landedUnitCost`, but honouring the review step's basis. */
export function landedUnitCostOn(
  line: ReceiptLine,
  receipt: Pick<GoodsReceipt, 'lines' | 'additionalCosts'>,
  usdRate: number,
  basis: CostSettings['basis'],
): number {
  if (basis === 'actual') return landedUnitCost(line, receipt, usdRate)

  const quantity = line.orderedQuantity
  if (quantity === 0) return 0
  const supplierUnit = toUzs(line.unitCost, line.costCurrency, usdRate)
  const goods = receipt.lines.reduce(
    (sum, l) => sum + l.orderedQuantity * toUzs(l.unitCost, l.costCurrency, usdRate),
    0,
  )
  if (goods === 0) return supplierUnit
  const share = (quantity * supplierUnit) / goods
  return supplierUnit + (extraCostsTotal(receipt, usdRate) * share) / quantity
}

/** Units on the document, for the list's quantity columns. */
export const receiptOrdered = (r: Pick<GoodsReceipt, 'lines'>) =>
  r.lines.reduce((sum, line) => sum + line.orderedQuantity, 0)

export const receiptReceived = (r: Pick<GoodsReceipt, 'lines'>) =>
  r.lines.reduce((sum, line) => sum + (line.receivedQuantity ?? 0), 0)

/** Invoiced but never turned up — a claim against the supplier, not a loss. */
export const receiptShortfall = (r: Pick<GoodsReceipt, 'lines'>) =>
  r.lines.reduce(
    (sum, line) =>
      line.receivedQuantity === null
        ? sum
        : sum + Math.max(0, line.orderedQuantity - line.receivedQuantity),
    0,
  )

/** What the whole delivery is worth at the price we sell it for. */
export const retailValue = (
  r: Pick<GoodsReceipt, 'lines'>,
  salePriceOf: (variationId: Id) => number,
) => r.lines.reduce((sum, line) => sum + lineQuantity(line) * salePriceOf(line.variationId), 0)

/**
 * How much of a delivery has sold through — OX's `Реализовано`, and the most
 * interesting number on its screen: it says whether a container was a good buy,
 * not merely that it arrived.
 *
 * **This is an estimate, and knowingly so.** Doing it exactly needs lot
 * tracking — every sale line remembering which delivery it drew from — which
 * this build does not have. Instead: whatever of a line is still on the shelf
 * it landed on is assumed to be from this delivery, and the rest is assumed
 * sold. That is right when a part is delivered and sold before the next
 * delivery of it, which is the ordinary case, and it **understates** sell-
 * through when a later delivery has restocked the shelf in the meantime.
 *
 * Never present it as an exact figure. See docs/OX-NAVIGATION-MAP.md.
 */
export function soldThrough(
  receipt: Pick<GoodsReceipt, 'lines' | 'locationId' | 'status'>,
  stockAt: (variationId: Id, locationId: Id) => number,
): { received: number; sold: number; ratio: number } {
  if (receipt.status !== 'received') return { received: 0, sold: 0, ratio: 0 }

  let received = 0
  let sold = 0
  for (const line of receipt.lines) {
    const landed = line.receivedQuantity ?? 0
    received += landed
    const stillHere = Math.min(stockAt(line.variationId, receipt.locationId), landed)
    sold += landed - stillHere
  }
  return { received, sold, ratio: received === 0 ? 0 : sold / received }
}

/** The one step a receipt can take from where it is. */
export function nextStep(status: ReceiptStatus): { to: ReceiptStatus; label: string } | null {
  return status === 'draft' ? { to: 'received', label: 'Post receipt' } : null
}

export const canCancel = (status: ReceiptStatus) => status !== 'cancelled'

/* --- validation --------------------------------------------------------- */

export const receiptLineSchema = z.object({
  id: z.string(),
  variationId: z.string(),
  productId: z.string(),
  sku: z.string(),
  name: z.string(),
  imageUrl: z.string().nullable(),
  unit: z.string(),
  orderedQuantity: z.number().positive('Receive at least one'),
  receivedQuantity: z.number().nonnegative().nullable(),
  unitCost: z.number().nonnegative(),
  costCurrency: z.enum(['USD', 'UZS']),
})

export const additionalCostSchema = z.object({
  id: z.string(),
  label: z.string().min(1, 'Name this cost'),
  amount: z.number().nonnegative(),
  currency: z.enum(['USD', 'UZS']),
})

export const receiptPaymentSchema = z.object({
  payerName: z.string().min(1, 'Who paid?'),
  accountName: z.string().min(1, 'Which account did it leave?'),
  amount: z.number().positive('Enter an amount'),
  currency: z.enum(['USD', 'UZS']),
  note: z.string(),
})

export type ReceiptPaymentDraft = z.infer<typeof receiptPaymentSchema>

export const receiptDraftSchema = z.object({
  supplierId: z.string().nullable(),
  invoiceNumber: z.string(),
  locationId: z.string().min(1, 'Pick where the goods land'),
  comment: z.string(),
  lines: z.array(receiptLineSchema).min(1, 'Add at least one product'),
  additionalCosts: z.array(additionalCostSchema),
})

export type ReceiptDraft = z.infer<typeof receiptDraftSchema>

/**
 * The questions the reference product asks before a receipt exists at all.
 * Answering them creates an empty, unfinished receipt; products are added to
 * it afterwards, on its own screen.
 */
export const newReceiptSchema = z.object({
  zone: z.string().min(1, 'Where are the goods coming from?'),
  locationId: z.string().min(1, 'Pick where the goods land'),
  usdRate: z.number().positive('Enter the rate agreed for this delivery'),
  stocktakeOnPost: z.boolean(),
  supplierId: z.string().nullable(),
  distributeByTransfer: z.boolean(),
  comment: z.string(),
})

export type NewReceiptDraft = z.infer<typeof newReceiptSchema>
