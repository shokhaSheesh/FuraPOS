import { z } from 'zod'
import type { Id, IsoDate } from '@/shared/types'
import type { ReorderLine, ReorderSettings } from './reorder'

/**
 * A selection is a **run**, saved with its answer.
 *
 * The obvious build is a live screen that recalculates on every visit, and it
 * is wrong for three reasons OX's version makes clear:
 *
 * 1. **The schedule page needs something to schedule.** A recurring job has to
 *    produce an artefact, or there is nothing to come back to on Monday.
 * 2. **A buyer needs to compare.** "What did last month's run say, and did we
 *    act on it?" is unanswerable if the answer is regenerated each time.
 * 3. **Not every source is instant.** Marketplace discovery asks questions and
 *    costs money to run; it cannot happen on page load.
 *
 * So the parameters and the lines are frozen at the moment of calculation, and
 * the document records what was true then rather than what is true now.
 */
export type SelectionSource = 'suppliers' | 'marketplace'

export const SELECTION_SOURCES: { value: SelectionSource; label: string; hint: string }[] = [
  {
    value: 'suppliers',
    label: 'From your suppliers',
    hint: 'Worked out from stock, sales and the supplier’s minimum order',
  },
  {
    value: 'marketplace',
    label: 'From marketplaces',
    hint: 'Finding products you do not sell yet — not built, see the map',
  },
]

export const selectionSourceLabel = (source: SelectionSource) =>
  SELECTION_SOURCES.find((entry) => entry.value === source)?.label ?? source

/**
 * `ready` the moment it is calculated — the maths is instant. The state exists
 * because marketplace runs would not be, and because a scheduled run has to be
 * able to fail without pretending it produced an empty answer.
 */
export type SelectionStatus = 'ready' | 'running' | 'failed' | 'ordered'

export const SELECTION_STATUSES: {
  value: SelectionStatus
  label: string
  tone: 'success' | 'info' | 'danger' | 'neutral'
}[] = [
  { value: 'running', label: 'Calculating', tone: 'info' },
  { value: 'ready', label: 'Ready', tone: 'success' },
  { value: 'ordered', label: 'Ordered', tone: 'neutral' },
  { value: 'failed', label: 'Failed', tone: 'danger' },
]

export const selectionStatusLabel = (status: SelectionStatus) =>
  SELECTION_STATUSES.find((entry) => entry.value === status)?.label ?? status

export const selectionStatusTone = (status: SelectionStatus) =>
  SELECTION_STATUSES.find((entry) => entry.value === status)?.tone ?? 'neutral'

export interface ProductSelection {
  id: Id
  number: string
  source: SelectionSource
  status: SelectionStatus
  /**
   * Required for a supplier run, as in OX: you order from one company at a
   * time, so a suggestion that mixes four of them is not an order anyone can
   * place.
   */
  supplierId: Id | null
  supplierName: string | null
  /** Empty means every location's stock and sales counted. */
  locationIds: Id[]
  locationNames: string[]
  /** Frozen, so the document still explains itself when the defaults change. */
  settings: ReorderSettings
  /** The answer, frozen with it. */
  lines: ReorderLine[]
  comment: string | null
  createdBy: string
  createdAt: IsoDate
  /** Set when a purchase order was raised from this run. */
  orderedAt: IsoDate | null
  failureReason: string | null
}

/** Only the lines worth acting on — what the "Recommendations" count means. */
export const recommendations = (selection: Pick<ProductSelection, 'lines'>) =>
  selection.lines.filter((line) => line.suggested > 0)

export const selectionUnits = (selection: Pick<ProductSelection, 'lines'>) =>
  recommendations(selection).reduce((sum, line) => sum + line.suggested, 0)

export const selectionCost = (selection: Pick<ProductSelection, 'lines'>, usdRate: number) =>
  recommendations(selection).reduce(
    (sum, line) =>
      sum +
      line.suggested * (line.costCurrency === 'USD' ? line.unitCost * usdRate : line.unitCost),
    0,
  )

/* --- validation --------------------------------------------------------- */

export const selectionDraftSchema = z
  .object({
    source: z.enum(['suppliers', 'marketplace']),
    supplierId: z.string(),
    salesWindowDays: z.number().int().positive(),
    leadTimeDays: z.number().int().positive(),
    orderIntervalDays: z.number().int().positive(),
    safetyDays: z.number().int().nonnegative(),
    locationIds: z.array(z.string()),
    comment: z.string(),
  })
  .superRefine((values, ctx) => {
    if (values.source === 'suppliers' && !values.supplierId) {
      ctx.addIssue({
        code: 'custom',
        path: ['supplierId'],
        message: 'Pick who this order would go to',
      })
    }
  })

export type SelectionDraft = z.infer<typeof selectionDraftSchema>
