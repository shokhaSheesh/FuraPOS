import { z } from 'zod'
import type { Id, IsoDate } from '@/shared/types'
import { formatMoney } from '@/shared/lib/format'

/**
 * A promotion: a discount rule with a reason and an end date.
 *
 * Without this screen a discount is a number somebody typed into a sale, and
 * six weeks later nobody can say whether the March campaign made any money —
 * only that margin fell. A promotion is the same discount **recorded as a
 * decision**, so it can be pointed at afterwards.
 *
 * That makes it two things at once, and both matter:
 *
 *   1. **A rule the New sale screen applies**, so the seller does not have to
 *      remember what this week's offer is or work the percentage out by hand.
 *   2. **A label on the sales it produced**, so its cost is measurable rather
 *      than absorbed into general discounting.
 */
export type PromotionKind = 'percentage' | 'fixed'

export const PROMOTION_KINDS: { value: PromotionKind; label: string; hint: string }[] = [
  { value: 'percentage', label: 'Percentage off', hint: 'e.g. 15% off every matching line' },
  { value: 'fixed', label: 'Fixed amount off', hint: 'e.g. 50 000 UZS off the sale' },
]

/**
 * What the promotion applies to.
 *
 * A product, not a variation: an offer on "Brake pad set X30" means the whole
 * part, and nobody sets up a promotion that covers the left side and not the
 * right.
 */
export type PromotionScope = 'all' | 'category' | 'product'

export const PROMOTION_SCOPES: { value: PromotionScope; label: string }[] = [
  { value: 'all', label: 'Everything' },
  { value: 'category', label: 'One category' },
  { value: 'product', label: 'One product' },
]

export type PromotionStatus = 'scheduled' | 'running' | 'finished' | 'paused'

export const PROMOTION_STATUSES: {
  value: PromotionStatus
  label: string
  tone: 'info' | 'success' | 'neutral' | 'warning'
}[] = [
  { value: 'scheduled', label: 'Scheduled', tone: 'info' },
  { value: 'running', label: 'Running', tone: 'success' },
  { value: 'paused', label: 'Paused', tone: 'warning' },
  { value: 'finished', label: 'Finished', tone: 'neutral' },
]

export const promotionStatusLabel = (status: PromotionStatus) =>
  PROMOTION_STATUSES.find((entry) => entry.value === status)?.label ?? status

export const promotionStatusTone = (status: PromotionStatus) =>
  PROMOTION_STATUSES.find((entry) => entry.value === status)?.tone ?? 'neutral'

export interface Promotion {
  id: Id
  name: string
  kind: PromotionKind
  /** Percent when `kind` is percentage, UZS when fixed. */
  value: number
  scope: PromotionScope
  /** Set when scope is category or brand. */
  scopeId: Id | null
  scopeName: string | null
  startsAt: IsoDate
  /** Null means it runs until somebody stops it. */
  endsAt: IsoDate | null
  /**
   * Paused by hand. Kept separate from the dates so pausing does not destroy
   * the schedule someone set — un-pausing puts it straight back.
   */
  paused: boolean
  /**
   * Smallest sale it applies to. A promotion meant to lift basket size should
   * not fire on a single wiper blade.
   */
  minimumSale: number | null
  comment: string | null
  createdBy: string
  createdAt: IsoDate
  updatedAt: IsoDate
}

/* --- when it is on ------------------------------------------------------- */

/**
 * Status is **derived from the dates**, never stored.
 *
 * A stored status is a status that goes stale the moment the end date passes
 * and nobody opens the screen — which is exactly when a promotion is quietly
 * still discounting things.
 */
export function promotionStatus(
  promotion: Pick<Promotion, 'startsAt' | 'endsAt' | 'paused'>,
  now: Date = new Date(),
): PromotionStatus {
  if (promotion.paused) return 'paused'
  const at = now.getTime()
  if (new Date(promotion.startsAt).getTime() > at) return 'scheduled'
  if (promotion.endsAt && new Date(promotion.endsAt).getTime() < at) return 'finished'
  return 'running'
}

export const isLive = (promotion: Promotion, now: Date = new Date()) =>
  promotionStatus(promotion, now) === 'running'

/** Days until it ends. Null when it has no end or has already finished. */
export function daysRemaining(
  promotion: Pick<Promotion, 'startsAt' | 'endsAt' | 'paused'>,
  now: Date = new Date(),
): number | null {
  if (!promotion.endsAt) return null
  if (promotionStatus(promotion, now) !== 'running') return null
  const days = Math.ceil((new Date(promotion.endsAt).getTime() - now.getTime()) / 86_400_000)
  return days >= 0 ? days : null
}

/* --- what it does to a sale ---------------------------------------------- */

export interface PromotableLine {
  variationId: Id
  productId: Id
  categoryId: Id | null
  quantity: number
  unitPrice: number
}

export const lineGross = (line: PromotableLine) => line.quantity * line.unitPrice

/** Whether a single line is inside the promotion's scope. */
export function covers(promotion: Promotion, line: PromotableLine): boolean {
  if (promotion.scope === 'all') return true
  if (promotion.scope === 'category') return line.categoryId === promotion.scopeId
  return line.productId === promotion.scopeId
}

/**
 * What a promotion takes off a basket.
 *
 * A percentage applies **only to the lines it covers**; a fixed amount applies
 * to the sale as a whole and is capped at the covered value, because a
 * promotion must never turn a sale into a payment to the customer.
 */
export function discountFor(
  promotion: Promotion,
  lines: PromotableLine[],
  now: Date = new Date(),
): number {
  if (!isLive(promotion, now)) return 0

  const covered = lines.filter((line) => covers(promotion, line))
  const coveredValue = covered.reduce((sum, line) => sum + lineGross(line), 0)
  if (coveredValue <= 0) return 0

  const saleValue = lines.reduce((sum, line) => sum + lineGross(line), 0)
  if (promotion.minimumSale !== null && saleValue < promotion.minimumSale) return 0

  return promotion.kind === 'percentage'
    ? Math.round((coveredValue * promotion.value) / 100)
    : Math.min(promotion.value, coveredValue)
}

/**
 * The best single promotion for a basket.
 *
 * Deliberately one, not all of them stacked: two overlapping offers that both
 * fire is how a shop accidentally sells below cost, and "the customer gets the
 * better of the two" is a rule a seller can explain at the counter.
 */
export function bestPromotion(
  promotions: Promotion[],
  lines: PromotableLine[],
  now: Date = new Date(),
): { promotion: Promotion; discount: number } | null {
  let best: { promotion: Promotion; discount: number } | null = null
  for (const promotion of promotions) {
    const discount = discountFor(promotion, lines, now)
    if (discount > 0 && (!best || discount > best.discount)) best = { promotion, discount }
  }
  return best
}

/** How the rule reads in a sentence, for the list and the sale screen. */
export function describe(promotion: Promotion): string {
  const amount =
    promotion.kind === 'percentage'
      ? `${promotion.value}% off`
      : `${formatMoney(promotion.value)} off`
  const scope = promotion.scope === 'all' ? 'everything' : (promotion.scopeName ?? 'a selection')
  return `${amount} ${scope}`
}

/* --- validation ---------------------------------------------------------- */

export const promotionDraftSchema = z
  .object({
    name: z.string().min(2, 'Name it after the offer'),
    kind: z.enum(['percentage', 'fixed']),
    value: z.number().positive('A discount of nothing is not a promotion'),
    scope: z.enum(['all', 'category', 'product']),
    scopeId: z.string().nullable(),
    startsAt: z.string(),
    endsAt: z.string().nullable(),
    paused: z.boolean(),
    minimumSale: z.number().nonnegative().nullable(),
    comment: z.string().nullable(),
  })
  .refine((draft) => draft.kind !== 'percentage' || draft.value <= 100, {
    message: 'A percentage cannot be over 100',
    path: ['value'],
  })
  .refine((draft) => draft.scope === 'all' || Boolean(draft.scopeId), {
    message: 'Choose what it applies to',
    path: ['scopeId'],
  })
  .refine(
    (draft) =>
      !draft.endsAt || new Date(draft.endsAt).getTime() > new Date(draft.startsAt).getTime(),
    { message: 'It has to end after it starts', path: ['endsAt'] },
  )

export type PromotionDraft = z.infer<typeof promotionDraftSchema>
