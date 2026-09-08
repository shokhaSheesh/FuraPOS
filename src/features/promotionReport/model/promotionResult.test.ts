import { describe, expect, it } from 'vitest'
import { EMPTY_WINDOW, upliftOf, verdictFor, type WindowFigures } from './promotionResult'

const win = (over: Partial<WindowFigures> = {}): WindowFigures => ({
  ...EMPTY_WINDOW,
  revenue: 1_000_000,
  margin: 300_000,
  sales: 20,
  units: 40,
  clients: 8,
  ...over,
})

const base = {
  days: 14,
  uses: 30,
  during: win(),
  before: win(),
  netEffect: 0,
  discountGiven: 100_000,
}

describe('the verdict', () => {
  it('says it paid when the extra margin clears the noise', () => {
    expect(verdictFor({ ...base, netEffect: 80_000 })).toBe('paid')
  })

  it('says it lost when margin fell against the baseline', () => {
    expect(verdictFor({ ...base, netEffect: -80_000 })).toBe('lost')
  })

  it('calls a small difference about even, not a win', () => {
    // A promotion 2% ahead did not beat the noise in a fortnight of trading,
    // and calling that a success is how a shop keeps repeating a bad offer.
    expect(verdictFor({ ...base, netEffect: 2_000 })).toBe('flat')
    expect(verdictFor({ ...base, netEffect: -2_000 })).toBe('flat')
  })

  it('refuses to judge a promotion that has barely run', () => {
    expect(verdictFor({ ...base, days: 1, netEffect: 500_000 })).toBe('tooEarly')
  })

  it('refuses to judge on too few sales', () => {
    expect(verdictFor({ ...base, during: win({ sales: 2 }), netEffect: 500_000 })).toBe('tooEarly')
  })

  it('separates "nobody used it" from "it did not work"', () => {
    // A finding about the counter, not about the offer.
    expect(verdictFor({ ...base, uses: 0, netEffect: 500_000 })).toBe('unused')
  })

  it('says so when there is nothing to compare against', () => {
    expect(verdictFor({ ...base, before: win({ sales: 0, revenue: 0 }), netEffect: 1 })).toBe(
      'noBaseline',
    )
  })

  it('checks the calendar before anything else', () => {
    // A one-day-old promotion with no uses is too early, not unused.
    expect(verdictFor({ ...base, days: 0, uses: 0 })).toBe('tooEarly')
  })
})

describe('uplift', () => {
  it('is the revenue change against the baseline', () => {
    expect(upliftOf(win({ revenue: 150 }), win({ revenue: 100 }))).toBeCloseTo(0.5)
    expect(upliftOf(win({ revenue: 50 }), win({ revenue: 100 }))).toBeCloseTo(-0.5)
  })

  it('is null rather than infinite without a baseline', () => {
    expect(upliftOf(win({ revenue: 100 }), win({ revenue: 0 }))).toBeNull()
  })
})
