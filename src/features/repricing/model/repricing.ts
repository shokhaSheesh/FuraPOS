import { z } from 'zod'
import type { Id, IsoDate } from '@/shared/types'

/**
 * Changing what things sell for, as a document rather than an edit.
 *
 * Two reasons it is not just the price field on a product. A price change needs
 * to be answerable later — *when* did this go up, and who decided — and it is
 * almost never one price: the som slides against the dollar, or a supplier
 * raises everything eight per cent, and two hundred parts are wrong at once.
 *
 * **It never touches cost.** Cost is discovered at goods receipt — what was
 * actually paid, freight included. Price is decided. A screen that could edit
 * both would let someone invent a margin by moving the wrong number.
 */
export type RepricingStatus = 'draft' | 'applied' | 'reverted'

export const REPRICING_STATUSES: {
  value: RepricingStatus
  label: string
  tone: 'neutral' | 'success' | 'danger'
}[] = [
  { value: 'draft', label: 'Draft', tone: 'neutral' },
  { value: 'applied', label: 'Applied', tone: 'success' },
  { value: 'reverted', label: 'Reverted', tone: 'danger' },
]

export const repricingStatusLabel = (status: RepricingStatus) =>
  REPRICING_STATUSES.find((entry) => entry.value === status)?.label ?? status

export const repricingStatusTone = (status: RepricingStatus) =>
  REPRICING_STATUSES.find((entry) => entry.value === status)?.tone ?? 'neutral'

/** How the new price is worked out from the old one. */
export type RuleKind = 'percent' | 'amount' | 'margin' | 'manual'

export const RULE_KINDS: { value: RuleKind; label: string; hint: string }[] = [
  {
    value: 'percent',
    label: 'Change by a percentage',
    hint: 'The usual one when the exchange rate moves — everything up or down together',
  },
  {
    value: 'amount',
    label: 'Change by a fixed amount',
    hint: 'Adds or subtracts the same sum from every price',
  },
  {
    value: 'margin',
    label: 'Set a target margin',
    hint: 'Works the price back from what each part actually cost, so thin margins are fixed',
  },
  {
    value: 'manual',
    label: 'Type each price myself',
    hint: 'Starts from current prices, unchanged',
  },
]

/**
 * A sensible starting value for each rule. Carrying the last one over is worse
 * than it sounds: "5" means five per cent under one rule and a five-hundred
 * per cent margin under another, which silently computes nothing at all.
 */
export const defaultRuleValue = (kind: RuleKind) =>
  kind === 'percent' ? 5 : kind === 'margin' ? 0.3 : 0

export interface RepricingRule {
  kind: RuleKind
  /** Percent for `percent`, money for `amount`, a fraction 0–1 for `margin`. */
  value: number
  /**
   * Round the result to this multiple. Bulk arithmetic produces prices like
   * 2 340 671, which no one would ever print on a shelf label.
   */
  roundTo: number
}

export const ROUNDING_OPTIONS = [
  { value: '1', label: 'No rounding' },
  { value: '100', label: 'Nearest 100' },
  { value: '1000', label: 'Nearest 1 000' },
  { value: '5000', label: 'Nearest 5 000' },
]

export interface RepricingLine {
  id: string
  variationId: Id
  productId: Id
  sku: string
  name: string
  imageUrl: string | null
  categoryName: string
  /** Landed cost in UZS when the sheet was prepared, for the margin columns. */
  costAtTime: number
  /** Snapshotted so revert restores exactly what was there. */
  oldPrice: number
  newPrice: number
  oldDiscountPrice: number | null
  newDiscountPrice: number | null
}

export interface Repricing {
  id: Id
  number: string
  status: RepricingStatus
  rule: RepricingRule
  categoryId: Id | null
  categoryName: string | null
  brandId: Id | null
  brandName: string | null
  lines: RepricingLine[]
  comment: string | null
  createdBy: string
  createdAt: IsoDate
  appliedAt: IsoDate | null
  revertedAt: IsoDate | null
  updatedAt: IsoDate
}

/* --- the arithmetic ------------------------------------------------------ */

export const roundPrice = (value: number, roundTo: number) =>
  roundTo <= 1 ? Math.round(value) : Math.round(value / roundTo) * roundTo

/**
 * What a line's price becomes under a rule.
 *
 * `margin` works backwards from cost: a target margin of 30% means cost is 70%
 * of the price, so price = cost / 0.7. That is the only rule that can *lower* a
 * price it was told to raise — a part already selling far above its cost gets
 * corrected downwards — which is the point of having it.
 */
export function priceUnder(
  rule: RepricingRule,
  line: Pick<RepricingLine, 'oldPrice' | 'costAtTime'>,
): number {
  switch (rule.kind) {
    case 'percent':
      return Math.max(0, roundPrice(line.oldPrice * (1 + rule.value / 100), rule.roundTo))
    case 'amount':
      return Math.max(0, roundPrice(line.oldPrice + rule.value, rule.roundTo))
    case 'margin': {
      // A margin of 100% or more is unreachable: it would need an infinite
      // price. Guarded so a typo cannot produce Infinity.
      const share = 1 - rule.value
      if (share <= 0 || line.costAtTime <= 0) return line.oldPrice
      return Math.max(0, roundPrice(line.costAtTime / share, rule.roundTo))
    }
    case 'manual':
      return line.oldPrice
  }
}

/** Margin on a price, matching how the catalogue computes it. */
export const marginOf = (price: number, cost: number) => (price <= 0 ? 0 : (price - cost) / price)

export const lineChange = (line: RepricingLine) => line.newPrice - line.oldPrice

export const changedLines = (r: Pick<Repricing, 'lines'>) =>
  r.lines.filter((line) => lineChange(line) !== 0)

export const raisedCount = (r: Pick<Repricing, 'lines'>) =>
  r.lines.filter((line) => lineChange(line) > 0).length

export const loweredCount = (r: Pick<Repricing, 'lines'>) =>
  r.lines.filter((line) => lineChange(line) < 0).length

/** Average percentage move across lines that actually changed. */
export function averageChange(r: Pick<Repricing, 'lines'>) {
  const changed = changedLines(r)
  if (changed.length === 0) return 0
  const total = changed.reduce(
    (sum, line) => sum + (line.oldPrice === 0 ? 0 : lineChange(line) / line.oldPrice),
    0,
  )
  return total / changed.length
}

/** Margin before and after, weighted by nothing — the plain average. */
export function marginShift(r: Pick<Repricing, 'lines'>) {
  const usable = r.lines.filter((line) => line.costAtTime > 0)
  if (usable.length === 0) return { before: 0, after: 0 }
  const before = usable.reduce((s, l) => s + marginOf(l.oldPrice, l.costAtTime), 0) / usable.length
  const after = usable.reduce((s, l) => s + marginOf(l.newPrice, l.costAtTime), 0) / usable.length
  return { before, after }
}

/** A line priced below what it cost. The thing to catch before applying. */
export const belowCost = (r: Pick<Repricing, 'lines'>) =>
  r.lines.filter((line) => line.costAtTime > 0 && line.newPrice < line.costAtTime)

export const canApply = (status: RepricingStatus) => status === 'draft'
export const canRevert = (status: RepricingStatus) => status === 'applied'

/* --- validation --------------------------------------------------------- */

export const repricingDraftSchema = z.object({
  kind: z.enum(['percent', 'amount', 'margin', 'manual']),
  value: z.number(),
  roundTo: z.number().positive(),
  categoryId: z.string(),
  brandId: z.string(),
  comment: z.string(),
})

export type RepricingDraft = z.infer<typeof repricingDraftSchema>
