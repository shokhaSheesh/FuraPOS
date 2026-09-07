import { z } from 'zod'
import type { Id, IsoDate } from '@/shared/types'

/**
 * A transfer is a document, not an instant edit.
 *
 * The states matter because of what sits between them: once a transfer is
 * **sent**, the goods have left the source shelf but have not reached the
 * destination — they are on a truck. Deducting on dispatch and adding on
 * receipt is the only version that never lies about what is on a shelf. The
 * alternative (move both ends at once) would have a warehouse counting stock
 * it cannot physically find.
 */
export type TransferStatus = 'draft' | 'in_transit' | 'received' | 'cancelled'

export const TRANSFER_STATUSES: {
  value: TransferStatus
  label: string
  tone: 'neutral' | 'info' | 'warning' | 'success' | 'danger'
}[] = [
  { value: 'draft', label: 'Draft', tone: 'neutral' },
  { value: 'in_transit', label: 'In transit', tone: 'warning' },
  { value: 'received', label: 'Received', tone: 'success' },
  { value: 'cancelled', label: 'Cancelled', tone: 'danger' },
]

export const transferStatusLabel = (status: TransferStatus) =>
  TRANSFER_STATUSES.find((entry) => entry.value === status)?.label ?? status

export const transferStatusTone = (status: TransferStatus) =>
  TRANSFER_STATUSES.find((entry) => entry.value === status)?.tone ?? 'neutral'

/**
 * One product on a transfer, with **three** quantities rather than one.
 *
 * They are genuinely different numbers and the gaps between them are the whole
 * reason a transfer is a document: a shop asks for 10, the warehouse finds only
 * 7 on the shelf and sends those, and 6 turn up at the far end. Collapsing them
 * into a single figure hides both the shortfall the warehouse could not meet
 * and the one that went missing on the road — the second of which is stock the
 * business has paid for and no longer owns.
 */
export interface TransferLine {
  /** Client-side row id; the same variation can be added twice by mistake. */
  id: string
  variationId: Id
  productId: Id
  /**
   * SKU, name, image and prices are snapshotted, as sale lines are: a transfer
   * is a record of what left the building that day, and renaming or repricing
   * the part later must not rewrite the paperwork.
   */
  sku: string
  name: string
  imageUrl: string | null
  unit: string

  /** What was asked for when the transfer was written. */
  requestedQuantity: number
  /** What actually left the source. Null until it is sent. */
  sentQuantity: number | null
  /** What the destination counted in. Null until it is received. */
  receivedQuantity: number | null

  /** Snapshotted so the document keeps its value when prices move. */
  unitCost: number
  costCurrency: 'USD' | 'UZS'
  unitPrice: number
}

/** What a line is currently worth counting as, at whatever stage it is at. */
export const lineQuantity = (line: TransferLine) =>
  line.receivedQuantity ?? line.sentQuantity ?? line.requestedQuantity

/**
 * Sent but not yet counted in — the units physically on a truck.
 *
 * Nothing is in transit once the far end has counted: whatever did not turn up
 * then is not still travelling, it is `lineShortfall` — a loss. Conflating the
 * two would leave phantom stock riding a truck forever.
 */
export const lineInTransit = (line: TransferLine) =>
  line.receivedQuantity === null ? (line.sentQuantity ?? 0) : 0

/**
 * Sent and never arrived. Not the same as in transit: this is only meaningful
 * once the far end has counted, and at that point it is a loss — the goods left
 * a shelf they will not return to and reached one they never made it onto.
 */
export const lineShortfall = (line: TransferLine) =>
  line.receivedQuantity === null ? 0 : Math.max(0, (line.sentQuantity ?? 0) - line.receivedQuantity)

/** What the warehouse could not meet from what was asked for. */
export const lineUnfulfilled = (line: TransferLine) =>
  line.sentQuantity === null ? 0 : Math.max(0, line.requestedQuantity - line.sentQuantity)

export interface Transfer {
  id: Id
  number: string
  status: TransferStatus
  fromLocationId: Id
  fromLocationName: string
  toLocationId: Id
  toLocationName: string
  lines: TransferLine[]
  comment: string | null
  /**
   * Who did what, at each hand-off. A transfer is a chain of custody, so the
   * person who dispatched and the person who counted it in are the two names
   * that matter when the numbers disagree — the creator alone cannot answer
   * "who says only six arrived?".
   */
  createdBy: string
  sentBy: string | null
  receivedBy: string | null
  createdAt: IsoDate
  /** When the goods left the source. Null while still a draft. */
  sentAt: IsoDate | null
  /** When the destination counted them in. Null until received. */
  receivedAt: IsoDate | null
  updatedAt: IsoDate
}

/** Units moved, which is the figure a warehouse actually cares about. */
export const transferQuantity = (transfer: Pick<Transfer, 'lines'>) =>
  transfer.lines.reduce((sum, line) => sum + lineQuantity(line), 0)

const sumBy = (transfer: Pick<Transfer, 'lines'>, pick: (line: TransferLine) => number) =>
  transfer.lines.reduce((sum, line) => sum + pick(line), 0)

export const transferRequested = (t: Pick<Transfer, 'lines'>) =>
  sumBy(t, (line) => line.requestedQuantity)
export const transferSent = (t: Pick<Transfer, 'lines'>) =>
  sumBy(t, (line) => line.sentQuantity ?? 0)
export const transferReceived = (t: Pick<Transfer, 'lines'>) =>
  sumBy(t, (line) => line.receivedQuantity ?? 0)
export const transferInTransit = (t: Pick<Transfer, 'lines'>) => sumBy(t, lineInTransit)
export const transferShortfall = (t: Pick<Transfer, 'lines'>) => sumBy(t, lineShortfall)

/**
 * What is on the truck, valued two ways.
 *
 * OX shows three totals (supplier, cost, sale). We show two, because we have
 * two real numbers: what the supplier invoiced and what we sell it for. A third
 * would be the same figure as the first until landed costs exist as their own
 * concept — see the note in docs/OX-NAVIGATION-MAP.md.
 */
export const transferCostValue = (t: Pick<Transfer, 'lines'>, usdRate: number) =>
  sumBy(
    t,
    (line) =>
      lineQuantity(line) * (line.costCurrency === 'USD' ? line.unitCost * usdRate : line.unitCost),
  )

export const transferSaleValue = (t: Pick<Transfer, 'lines'>) =>
  sumBy(t, (line) => lineQuantity(line) * line.unitPrice)

/**
 * The one step a transfer can take from where it is, mirroring `nextStep` on a
 * sale: the lifecycle lives in the model, so the detail page has exactly one
 * primary button and never has to decide what it means.
 */
export function nextStep(status: TransferStatus): { to: TransferStatus; label: string } | null {
  switch (status) {
    case 'draft':
      return { to: 'in_transit', label: 'Send' }
    case 'in_transit':
      return { to: 'received', label: 'Confirm receipt' }
    // 'received' and 'cancelled' are terminal.
    default:
      return null
  }
}

/** Cancelling is only honest before the goods are counted in at the far end. */
export const canCancel = (status: TransferStatus) => status === 'draft' || status === 'in_transit'

/* --- validation --------------------------------------------------------- */

export const transferLineSchema = z.object({
  id: z.string(),
  variationId: z.string(),
  productId: z.string(),
  sku: z.string(),
  name: z.string(),
  imageUrl: z.string().nullable(),
  unit: z.string(),
  requestedQuantity: z.number().positive('Move at least one'),
  sentQuantity: z.number().nonnegative().nullable(),
  receivedQuantity: z.number().nonnegative().nullable(),
  unitCost: z.number().nonnegative(),
  costCurrency: z.enum(['USD', 'UZS']),
  unitPrice: z.number().nonnegative(),
})

export const transferDraftSchema = z
  .object({
    fromLocationId: z.string().min(1, 'Pick where it leaves from'),
    toLocationId: z.string().min(1, 'Pick where it goes'),
    comment: z.string(),
    lines: z.array(transferLineSchema).min(1, 'Add at least one product'),
  })
  .superRefine((values, ctx) => {
    // A transfer to the same place is a no-op that would still deduct and add
    // stock, so it is rejected rather than silently allowed.
    if (values.fromLocationId && values.fromLocationId === values.toLocationId) {
      ctx.addIssue({
        code: 'custom',
        path: ['toLocationId'],
        message: 'Somewhere other than where it starts',
      })
    }
  })

export type TransferDraft = z.infer<typeof transferDraftSchema>
