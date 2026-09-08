import type { Id } from '@/shared/types'

/**
 * Did a promotion make money?
 *
 * A promotion costs the discount it gave away. It earns whatever extra people
 * bought because of it. Everything on this screen exists to compare those two
 * numbers, because "revenue went up during a 20% off week" is not a finding —
 * revenue nearly always goes up during a 20% off week, and the question is
 * whether it went up by more than the 20% cost.
 *
 * OX shows thirteen tiles including «Эффект» and «Uplift %». Those two are the
 * answer and the other eleven are the workings, so here the answer leads.
 */
export type PromotionVerdict = 'paid' | 'lost' | 'flat' | 'unused' | 'tooEarly' | 'noBaseline'

export const VERDICTS: {
  value: PromotionVerdict
  label: string
  tone: 'success' | 'danger' | 'warning' | 'neutral'
  meaning: string
}[] = [
  {
    value: 'paid',
    label: 'Paid for itself',
    tone: 'success',
    meaning: 'The extra margin it brought in was worth more than the discount it gave away',
  },
  {
    value: 'lost',
    label: 'Cost more than it earned',
    tone: 'danger',
    meaning: 'The discount given away was worth more than the extra margin it brought in',
  },
  {
    value: 'flat',
    label: 'About even',
    tone: 'warning',
    meaning: 'Within a tenth of breaking even — it moved stock without making money',
  },
  {
    value: 'unused',
    label: 'Nobody used it',
    tone: 'warning',
    // Worth its own verdict: a promotion nobody applied is not a promotion
    // that failed, it is one the counter never heard about.
    meaning: 'It was running, but no sale was ever put through with it',
  },
  {
    value: 'tooEarly',
    label: 'Too early to tell',
    tone: 'neutral',
    meaning: 'Not enough days or sales yet to say anything honest',
  },
  {
    value: 'noBaseline',
    label: 'Nothing to compare with',
    tone: 'neutral',
    meaning: 'No trading in the matching period before it started',
  },
]

export const verdictLabel = (verdict: PromotionVerdict) =>
  VERDICTS.find((entry) => entry.value === verdict)?.label ?? verdict

export const verdictTone = (verdict: PromotionVerdict) =>
  VERDICTS.find((entry) => entry.value === verdict)?.tone ?? 'neutral'

export const verdictMeaning = (verdict: PromotionVerdict) =>
  VERDICTS.find((entry) => entry.value === verdict)?.meaning ?? ''

/** A window's trading figures, for the promotion period or the one before it. */
export interface WindowFigures {
  revenue: number
  margin: number
  sales: number
  units: number
  clients: number
}

export const EMPTY_WINDOW: WindowFigures = {
  revenue: 0,
  margin: 0,
  sales: 0,
  units: 0,
  clients: 0,
}

export interface PromotionResult {
  promotionId: Id
  name: string
  /** How many days it has actually been running or ran. */
  days: number

  /** Sales that carried this promotion. */
  uses: number
  /** What it gave away. */
  discountGiven: number
  unitsDiscounted: number

  /** Everything traded while it ran, on the products it covered. */
  during: WindowFigures
  /** The same length of time immediately before, for comparison. */
  before: WindowFigures

  /** Extra revenue against the baseline, as a ratio. Null without a baseline. */
  upliftRatio: number | null
  /**
   * Extra margin against the baseline, in money — the whole answer.
   *
   * The discount is **already inside this**: margin is revenue-after-discount
   * less cost, so a campaign that gave away more than it brought in shows as a
   * smaller margin than the period before. `discountGiven` is shown beside it
   * as the size of the bet, never subtracted from it again.
   */
  marginGained: number
  /** Same number, named for what it means: positive paid for itself. */
  netEffect: number
  verdict: PromotionVerdict
}

/** Below this, a window is too thin to draw a conclusion from. */
export const MIN_DAYS = 3
export const MIN_SALES = 5

/**
 * The verdict.
 *
 * Deliberately conservative: "too early" and "nothing to compare with" are
 * real answers, and a screen that always produces a confident verdict from
 * three sales is worse than one that admits it cannot tell.
 */
export function verdictFor(result: {
  days: number
  uses: number
  during: WindowFigures
  before: WindowFigures
  netEffect: number
  discountGiven: number
}): PromotionVerdict {
  if (result.days < MIN_DAYS) return 'tooEarly'
  // It ran and nothing was ever sold under it. That is a finding about the
  // counter, not about the offer, and judging the offer on it would be wrong.
  if (result.uses === 0) return 'unused'
  if (result.during.sales < MIN_SALES) return 'tooEarly'
  if (result.before.sales === 0) return 'noBaseline'

  // "About even" is a band, not a point. A promotion that came out 2% ahead
  // did not really beat the noise in a fortnight of trading.
  const scale = Math.max(result.discountGiven, 1)
  if (Math.abs(result.netEffect) / scale < 0.1) return 'flat'
  return result.netEffect > 0 ? 'paid' : 'lost'
}

export const upliftOf = (during: WindowFigures, before: WindowFigures) =>
  before.revenue === 0 ? null : (during.revenue - before.revenue) / before.revenue
