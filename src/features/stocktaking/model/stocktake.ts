import { z } from 'zod'
import type { Id, IsoDate } from '@/shared/types'

/**
 * A planned count of a shelf, as a session rather than an edit.
 *
 * This is what makes it a different thing from a correction. A correction is
 * instantaneous and reactive — "this box arrived crushed". A stocktake runs
 * over hours or days, most of its lines have no variance at all, and the point
 * is not to fix one number but to prove all of them.
 *
 * And it is the only document where **not counted is different from counted
 * zero**. A part nobody got to must not be written off; a part someone checked
 * and found none of must be. A correction cannot express that distinction —
 * a line you do not add is simply absent — which is why this exists.
 */
export type StocktakeStatus = 'counting' | 'applied' | 'cancelled'

export const STOCKTAKE_STATUSES: {
  value: StocktakeStatus
  label: string
  tone: 'info' | 'success' | 'neutral'
}[] = [
  { value: 'counting', label: 'Counting', tone: 'info' },
  { value: 'applied', label: 'Applied', tone: 'success' },
  { value: 'cancelled', label: 'Cancelled', tone: 'neutral' },
]

export const stocktakeStatusLabel = (status: StocktakeStatus) =>
  STOCKTAKE_STATUSES.find((entry) => entry.value === status)?.label ?? status

export const stocktakeStatusTone = (status: StocktakeStatus) =>
  STOCKTAKE_STATUSES.find((entry) => entry.value === status)?.tone ?? 'neutral'

export interface StocktakeLine {
  id: string
  variationId: Id
  productId: Id
  sku: string
  name: string
  imageUrl: string | null
  unit: string
  categoryId: Id
  categoryName: string
  shelfAddress: string | null
  /**
   * What the system said when counting started — frozen, because it is what the
   * person walking the aisle was measured against. Comparing their count to a
   * figure that moved underneath them would blame them for a sale.
   */
  expected: number
  /** What was actually on the shelf. **Null means nobody has counted it yet.** */
  counted: number | null
  unitCost: number
  costCurrency: 'USD' | 'UZS'
}

export interface Stocktake {
  id: Id
  number: string
  status: StocktakeStatus
  locationId: Id
  locationName: string
  /** Null when the whole location is in scope. */
  categoryId: Id | null
  categoryName: string | null
  lines: StocktakeLine[]
  comment: string | null
  createdBy: string
  createdAt: IsoDate
  /** When the differences were committed. Null until then. */
  appliedAt: IsoDate | null
  /** The correction this produced, so one ledger holds every adjustment. */
  correctionId: Id | null
  updatedAt: IsoDate
}

/* --- progress and variance ----------------------------------------------- */

export const isCounted = (line: StocktakeLine) => line.counted !== null

export const countedLines = (s: Pick<Stocktake, 'lines'>) => s.lines.filter(isCounted)

/** How far through the count someone is — the number they check twice a day. */
export function progress(s: Pick<Stocktake, 'lines'>) {
  const done = countedLines(s).length
  return { done, total: s.lines.length, ratio: s.lines.length === 0 ? 0 : done / s.lines.length }
}

/** Variance for one line, or null while it is uncounted. */
export const lineVariance = (line: StocktakeLine) =>
  line.counted === null ? null : line.counted - line.expected

/** Lines that were counted and disagreed with the system. */
export const discrepancies = (s: Pick<Stocktake, 'lines'>) =>
  s.lines.filter((line) => {
    const variance = lineVariance(line)
    return variance !== null && variance !== 0
  })

/** Units missing, as a positive number. The shrinkage figure. */
export const shortUnits = (s: Pick<Stocktake, 'lines'>) =>
  s.lines.reduce((sum, line) => sum + Math.max(0, -(lineVariance(line) ?? 0)), 0)

/** Units found beyond what the system expected. */
export const surplusUnits = (s: Pick<Stocktake, 'lines'>) =>
  s.lines.reduce((sum, line) => sum + Math.max(0, lineVariance(line) ?? 0), 0)

export const netUnits = (s: Pick<Stocktake, 'lines'>) =>
  s.lines.reduce((sum, line) => sum + (lineVariance(line) ?? 0), 0)

const inUzs = (line: StocktakeLine, usdRate: number) =>
  line.costCurrency === 'USD' ? line.unitCost * usdRate : line.unitCost

/** What the variance is worth at cost. Negative is money that has gone. */
export const netCostValue = (s: Pick<Stocktake, 'lines'>, usdRate: number) =>
  s.lines.reduce((sum, line) => sum + (lineVariance(line) ?? 0) * inUzs(line, usdRate), 0)

/**
 * **Accuracy: the number a stocktake exists to produce.** Of everything
 * counted, how much of it the system already had right. A warehouse running at
 * 99% is healthy; one at 80% cannot trust any figure on any other screen.
 */
export function accuracy(s: Pick<Stocktake, 'lines'>) {
  const counted = countedLines(s)
  if (counted.length === 0) return 1
  const exact = counted.filter((line) => lineVariance(line) === 0).length
  return exact / counted.length
}

export const canCount = (status: StocktakeStatus) => status === 'counting'

/* --- validation --------------------------------------------------------- */

export const stocktakeDraftSchema = z.object({
  locationId: z.string().min(1, 'Pick the location being counted'),
  /** Empty string means the whole location. */
  categoryId: z.string(),
  comment: z.string(),
})

export type StocktakeDraft = z.infer<typeof stocktakeDraftSchema>
