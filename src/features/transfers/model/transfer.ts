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

export interface TransferLine {
  /** Client-side row id; the same variation can be added twice by mistake. */
  id: string
  variationId: Id
  productId: Id
  /**
   * SKU, name and image are snapshotted, as sale lines are: a transfer is a
   * record of what left the building that day, and renaming the part later
   * must not rewrite the paperwork.
   */
  sku: string
  name: string
  imageUrl: string | null
  unit: string
  quantity: number
}

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
  createdBy: string
  createdAt: IsoDate
  /** When the goods left the source. Null while still a draft. */
  sentAt: IsoDate | null
  /** When the destination counted them in. Null until received. */
  receivedAt: IsoDate | null
  updatedAt: IsoDate
}

/** Units moved, which is the figure a warehouse actually cares about. */
export const transferQuantity = (transfer: Pick<Transfer, 'lines'>) =>
  transfer.lines.reduce((sum, line) => sum + line.quantity, 0)

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
  quantity: z.number().positive('Move at least one'),
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
