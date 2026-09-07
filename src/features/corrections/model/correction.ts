import { z } from 'zod'
import type { Id, IsoDate } from '@/shared/types'

/**
 * Why a number changed when nothing was sold, received or moved.
 *
 * The reason is the entire point of the document. "Stock went from 9 to 7" is
 * not information; "two were dropped" is, and it is the difference between a
 * warehouse that can be improved and one that merely leaks.
 */
export type CorrectionReason =
  'damaged' | 'expired' | 'theft' | 'lost' | 'found' | 'miscount' | 'other'

export const CORRECTION_REASONS: {
  value: CorrectionReason
  label: string
  /** Which way this reason usually goes; used only to order and explain. */
  direction: 'down' | 'up' | 'either'
}[] = [
  { value: 'damaged', label: 'Damaged', direction: 'down' },
  { value: 'expired', label: 'Expired', direction: 'down' },
  { value: 'theft', label: 'Theft or shrinkage', direction: 'down' },
  { value: 'lost', label: 'Lost', direction: 'down' },
  { value: 'found', label: 'Found', direction: 'up' },
  { value: 'miscount', label: 'Recount', direction: 'either' },
  { value: 'other', label: 'Other', direction: 'either' },
]

export const correctionReasonLabel = (reason: CorrectionReason) =>
  CORRECTION_REASONS.find((entry) => entry.value === reason)?.label ?? reason

/**
 * `applied` the moment it is saved — whoever counts, records. A review step
 * would slot in as a third state before `applied` without changing any of the
 * arithmetic below, because stock moves on the transition into `applied` and
 * nowhere else. Left open pending the client's answer on whether write-offs
 * need a second signature.
 */
export type CorrectionStatus = 'applied' | 'cancelled'

export const CORRECTION_STATUSES: {
  value: CorrectionStatus
  label: string
  tone: 'success' | 'danger' | 'neutral'
}[] = [
  { value: 'applied', label: 'Applied', tone: 'success' },
  { value: 'cancelled', label: 'Cancelled', tone: 'neutral' },
]

export const correctionStatusTone = (status: CorrectionStatus) =>
  CORRECTION_STATUSES.find((entry) => entry.value === status)?.tone ?? 'neutral'

export const correctionStatusLabel = (status: CorrectionStatus) =>
  CORRECTION_STATUSES.find((entry) => entry.value === status)?.label ?? status

export interface CorrectionLine {
  id: string
  variationId: Id
  productId: Id
  sku: string
  name: string
  imageUrl: string | null
  unit: string
  /**
   * What the system believed at the moment the correction was applied, kept so
   * the document still reads truthfully once the number has moved on.
   */
  countedBefore: number
  /** What is actually on the shelf. The user types this, never the difference. */
  countedAfter: number
  /** Snapshotted, so a write-off keeps the value it had on the day. */
  unitCost: number
  costCurrency: 'USD' | 'UZS'
}

export interface Correction {
  id: Id
  number: string
  status: CorrectionStatus
  /** A correction is always against one shelf; two shelves are two documents. */
  locationId: Id
  locationName: string
  reason: CorrectionReason
  lines: CorrectionLine[]
  /**
   * Where it came from. A stocktake commits its variances as a correction
   * rather than moving stock itself, so this ledger stays the single answer to
   * "why is this number what it is".
   */
  source: 'manual' | 'stocktake'
  sourceRef: Id | null
  comment: string | null
  createdBy: string
  createdAt: IsoDate
  updatedAt: IsoDate
}

/* --- arithmetic ---------------------------------------------------------- */

/** Negative when stock was written off, positive when it was found. */
export const lineDelta = (line: CorrectionLine) => line.countedAfter - line.countedBefore

const sumBy = (correction: Pick<Correction, 'lines'>, pick: (line: CorrectionLine) => number) =>
  correction.lines.reduce((sum, line) => sum + pick(line), 0)

/** Units that disappeared, as a positive number. */
export const writtenOff = (c: Pick<Correction, 'lines'>) =>
  sumBy(c, (line) => Math.max(0, -lineDelta(line)))

/** Units that turned up, as a positive number. */
export const writtenOn = (c: Pick<Correction, 'lines'>) =>
  sumBy(c, (line) => Math.max(0, lineDelta(line)))

/**
 * The net effect in units. Kept separate from the two above because a
 * correction that writes off five and finds five is not the same event as one
 * that changes nothing, and a single net figure would hide that.
 */
export const netUnits = (c: Pick<Correction, 'lines'>) => sumBy(c, lineDelta)

const inUzs = (line: CorrectionLine, usdRate: number) =>
  line.costCurrency === 'USD' ? line.unitCost * usdRate : line.unitCost

/** What the change is worth at cost. Negative is money written off. */
export const netCostValue = (c: Pick<Correction, 'lines'>, usdRate: number) =>
  sumBy(c, (line) => lineDelta(line) * inUzs(line, usdRate))

/** A line the user opened but did not actually change. */
export const isNoOp = (line: CorrectionLine) => lineDelta(line) === 0

/* --- validation --------------------------------------------------------- */

export const correctionLineSchema = z.object({
  id: z.string(),
  variationId: z.string(),
  productId: z.string(),
  sku: z.string(),
  name: z.string(),
  imageUrl: z.string().nullable(),
  unit: z.string(),
  countedBefore: z.number().nonnegative(),
  countedAfter: z.number().int().nonnegative('A shelf cannot hold less than nothing'),
  unitCost: z.number().nonnegative(),
  costCurrency: z.enum(['USD', 'UZS']),
})

export const correctionDraftSchema = z
  .object({
    locationId: z.string().min(1, 'Pick the location being corrected'),
    reason: z.enum(['damaged', 'expired', 'theft', 'lost', 'found', 'miscount', 'other']),
    comment: z.string(),
    lines: z.array(correctionLineSchema).min(1, 'Add at least one product'),
  })
  .superRefine((values, ctx) => {
    // A correction where every count matches is a document that says nothing
    // happened, which is worse than no document: it looks like a decision.
    if (
      values.lines.length &&
      values.lines.every((line) => line.countedAfter === line.countedBefore)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['lines'],
        message: 'Nothing has changed — every count matches what the system already says',
      })
    }
  })

export type CorrectionDraft = z.infer<typeof correctionDraftSchema>
