import type { Id, IsoDate } from '@/shared/types'

/**
 * RFM: who your customers are, and what to do about each of them.
 *
 * Three questions, scored 1–5 each:
 *   **R**ecency — how long since they last bought
 *   **F**requency — how often they buy
 *   **M**onetary — how much they spend
 *
 * Scoring is by **quintile against your own customer base**, not against fixed
 * thresholds. "Spends a lot" only means anything relative to everyone else, and
 * a threshold that works for a parts wholesaler is nonsense for a corner shop.
 *
 * OX's version of this screen promises «что с ними делать» — what to do with
 * them — in its subtitle and then never says. Every segment here carries the
 * action, because a segment nobody can act on is a label.
 */
/** How long without a purchase before somebody counts as slipping away. */
export const AT_RISK_DAYS = 90

export type RfmSegment =
  'champions' | 'loyal' | 'promising' | 'new' | 'needAttention' | 'atRisk' | 'cantLose' | 'lost'

export const RFM_SEGMENTS: {
  value: RfmSegment
  label: string
  /** What it means, in one line. */
  meaning: string
  /** What to do about it. The reason the segment exists. */
  action: string
  tone: 'success' | 'info' | 'warning' | 'danger' | 'neutral'
}[] = [
  {
    value: 'champions',
    label: 'Champions',
    meaning: 'Bought recently, buy often, spend the most',
    action: 'Keep them. Early access, best terms — losing one costs more than winning two.',
    tone: 'success',
  },
  {
    value: 'loyal',
    label: 'Loyal',
    meaning: 'Buy regularly and spend well',
    action: 'Ask them for referrals. They already like you.',
    tone: 'success',
  },
  {
    value: 'promising',
    label: 'Promising',
    meaning: 'Bought recently, not yet often',
    action: 'Give them a reason to come back a third time — that is where habits form.',
    tone: 'info',
  },
  {
    value: 'new',
    label: 'New',
    meaning: 'First purchase, recently',
    action: 'Make the second purchase easy. Most customers are lost after the first.',
    tone: 'info',
  },
  {
    value: 'needAttention',
    label: 'Need attention',
    meaning: 'Were regular, have started to drift',
    action: 'Ring them before they stop entirely. Something has usually changed.',
    tone: 'warning',
  },
  {
    value: 'atRisk',
    label: 'At risk',
    meaning: 'Used to buy often, have gone quiet',
    action: 'Ring them now. A competitor is the usual explanation.',
    tone: 'warning',
  },
  {
    value: 'cantLose',
    label: 'Cannot lose',
    meaning: 'Your biggest spenders, and they have stopped',
    action: 'The most urgent list on this screen. Whatever it takes.',
    tone: 'danger',
  },
  {
    value: 'lost',
    label: 'Lost',
    meaning: 'Bought once or twice, long ago',
    action: 'Worth one cheap approach. Do not spend real money here.',
    tone: 'neutral',
  },
]

export const segmentLabel = (segment: RfmSegment) =>
  RFM_SEGMENTS.find((entry) => entry.value === segment)?.label ?? segment

export const segmentTone = (segment: RfmSegment) =>
  RFM_SEGMENTS.find((entry) => entry.value === segment)?.tone ?? 'neutral'

export const segmentAction = (segment: RfmSegment) =>
  RFM_SEGMENTS.find((entry) => entry.value === segment)?.action ?? ''

export interface CustomerFacts {
  clientId: Id
  name: string
  /** Days since their last purchase. Null when they never bought. */
  recencyDays: number | null
  /** How many sales they have made in the window. */
  purchases: number
  /** What they have spent in the window — the "lifetime value" of the column. */
  spend: number
  averageCheck: number
  lastPurchaseAt: IsoDate | null
  firstPurchaseAt: IsoDate | null
  debt: number
  cashback: number
}

export interface RfmScores {
  r: number
  f: number
  m: number
}

export interface ScoredCustomer extends CustomerFacts, RfmScores {
  segment: RfmSegment
}

/**
 * Quintile rank, 1–5, of a value within a sorted ascending list.
 *
 * Rank-based rather than proportion-based, so the largest value always reaches
 * 5 — a top spender who scored 4 because the base was small would be quietly
 * mis-segmented.
 *
 * **Ties take the lowest rank of the group**, so two customers who spent
 * exactly the same always score the same. Landing them in different segments
 * would be impossible to explain to anybody.
 *
 * A base smaller than five cannot fill five quintiles, so small bases compress
 * towards the middle. That is honest: with three customers there is no
 * meaningful "bottom fifth".
 */
export function quintile(sortedAscending: number[], value: number): number {
  const size = sortedAscending.length
  if (size === 0) return 3
  const rank = sortedAscending.filter((entry) => entry < value).length + 1
  return Math.min(5, Math.max(1, Math.ceil((rank / size) * 5)))
}

/**
 * The segment for a set of scores.
 *
 * Ordered most-specific first: a customer can satisfy several of these, and the
 * first match is the one worth acting on. "Cannot lose" outranks "at risk"
 * because the money at stake is what decides who gets rung first.
 *
 * **The lapsing segments need an absolute recency guard, not just a rank.**
 * Scores are quintiles against the rest of the base, so in a business where
 * everybody bought last week somebody still scores R=1 — and calling them
 * "your biggest spender, and they have stopped" when they bought nine days ago
 * is simply false. Ranking says who is *relatively* quiet; only the calendar
 * says who has actually gone away.
 */
export function segmentOf(
  { r, f, m }: RfmScores,
  purchases: number,
  recencyDays: number | null,
): RfmSegment {
  if (purchases === 0) return 'lost'

  const lapsing = recencyDays !== null && recencyDays >= AT_RISK_DAYS

  // Big spender who has stopped: the most expensive silence in the business.
  if (lapsing && m >= 4) return 'cantLose'
  if (lapsing && f >= 3) return 'atRisk'
  if (r >= 4 && f >= 4 && m >= 4) return 'champions'
  if (r >= 3 && f >= 4) return 'loyal'
  if (lapsing) return 'lost'
  // Slipping relative to everyone else, but not yet actually away.
  if (r <= 2 && f >= 2) return 'needAttention'
  // Recent but not yet a habit. One purchase is "new", more is "promising".
  return purchases <= 1 ? 'new' : 'promising'
}

/** Scores a whole base together, because quintiles only exist relative to it. */
export function scoreCustomers(facts: CustomerFacts[]): ScoredCustomer[] {
  const buyers = facts.filter((entry) => entry.purchases > 0)

  // Recency is inverted: fewer days since buying is a better score.
  const recencies = buyers
    .map((entry) => -(entry.recencyDays ?? Number.MAX_SAFE_INTEGER))
    .sort((a, b) => a - b)
  const frequencies = buyers.map((entry) => entry.purchases).sort((a, b) => a - b)
  const spends = buyers.map((entry) => entry.spend).sort((a, b) => a - b)

  return facts.map((entry) => {
    const scores: RfmScores =
      entry.purchases === 0
        ? { r: 1, f: 1, m: 1 }
        : {
            r: quintile(recencies, -(entry.recencyDays ?? Number.MAX_SAFE_INTEGER)),
            f: quintile(frequencies, entry.purchases),
            m: quintile(spends, entry.spend),
          }
    return {
      ...entry,
      ...scores,
      segment: segmentOf(scores, entry.purchases, entry.recencyDays),
    }
  })
}
