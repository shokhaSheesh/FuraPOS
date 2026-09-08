import { describe, expect, it } from 'vitest'
import { quintile, scoreCustomers, segmentOf, type CustomerFacts } from './rfm'

const facts = (over: Partial<CustomerFacts> = {}): CustomerFacts => ({
  clientId: 'c1',
  name: 'Client',
  recencyDays: 5,
  purchases: 5,
  spend: 1_000_000,
  averageCheck: 200_000,
  lastPurchaseAt: new Date().toISOString(),
  firstPurchaseAt: new Date().toISOString(),
  debt: 0,
  cashback: 0,
  ...over,
})

describe('quintiles', () => {
  const list = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

  it('puts the smallest in the bottom fifth and the largest in the top', () => {
    expect(quintile(list, 1)).toBe(1)
    expect(quintile(list, 10)).toBe(5)
  })

  it('spreads the middle across the scale', () => {
    expect(quintile(list, 5)).toBe(3)
    expect(quintile(list, 8)).toBe(4)
  })

  it('gives ties the same score, taking the lowest rank of the group', () => {
    // Two customers who spent exactly the same cannot land in different
    // segments — that is impossible to explain to anybody.
    const tied = [5, 5, 5, 5, 10]
    expect(quintile(tied, 5)).toBe(1)
    expect(quintile(tied, 10)).toBe(5)
  })

  it('always lets the largest value reach the top', () => {
    // A top spender scoring 4 because the base is small would be quietly
    // mis-segmented.
    expect(quintile([1, 2, 3], 3)).toBe(5)
    expect(quintile([42], 42)).toBe(5)
  })

  it('does not fall over on an empty base', () => {
    expect(quintile([], 100)).toBe(3)
  })
})

describe('segments', () => {
  const RECENT = 3
  const LAPSED = 200

  it('calls a recent, frequent, big spender a champion', () => {
    expect(segmentOf({ r: 5, f: 5, m: 5 }, 12, RECENT)).toBe('champions')
  })

  it('puts a big spender who has stopped above everything else', () => {
    // The most expensive silence in the business outranks "at risk", because
    // the money at stake decides who gets rung first.
    expect(segmentOf({ r: 1, f: 5, m: 5 }, 9, LAPSED)).toBe('cantLose')
  })

  it('calls a frequent buyer who has gone quiet at risk', () => {
    expect(segmentOf({ r: 1, f: 4, m: 2 }, 6, LAPSED)).toBe('atRisk')
  })

  it('does not call somebody lapsed just for ranking low on recency', () => {
    // The whole reason for the absolute guard: in a base where everybody
    // bought last week, somebody still scores R=1. They have not gone away.
    expect(segmentOf({ r: 1, f: 5, m: 5 }, 9, RECENT)).not.toBe('cantLose')
    expect(segmentOf({ r: 1, f: 4, m: 2 }, 6, RECENT)).not.toBe('atRisk')
  })

  it('separates a first-time buyer from a returning one', () => {
    expect(segmentOf({ r: 5, f: 1, m: 1 }, 1, RECENT)).toBe('new')
    expect(segmentOf({ r: 5, f: 2, m: 2 }, 3, RECENT)).toBe('promising')
  })

  it('calls somebody who never bought lost, whatever their scores', () => {
    expect(segmentOf({ r: 5, f: 5, m: 5 }, 0, null)).toBe('lost')
  })

  it('calls a lapsed one-off buyer lost', () => {
    expect(segmentOf({ r: 1, f: 1, m: 1 }, 1, LAPSED)).toBe('lost')
  })
})

describe('scoring a base', () => {
  it('scores relative to the base, not to fixed thresholds', () => {
    // The same spend is top-of-the-pile in one business and bottom in another.
    const small = scoreCustomers([
      facts({ clientId: 'a', spend: 100 }),
      facts({ clientId: 'b', spend: 200 }),
      facts({ clientId: 'c', spend: 300 }),
    ])
    expect(small.find((c) => c.clientId === 'c')!.m).toBe(5)

    const large = scoreCustomers([
      facts({ clientId: 'a', spend: 300 }),
      facts({ clientId: 'b', spend: 3_000 }),
      facts({ clientId: 'c', spend: 30_000 }),
    ])
    // The same 300 that topped the small base is now the bottom of this one.
    // Not score 1 — three customers cannot fill five quintiles — but lowest.
    const scores = large.map((c) => c.m)
    expect(large.find((c) => c.clientId === 'a')!.m).toBe(Math.min(...scores))
    expect(large.find((c) => c.clientId === 'c')!.m).toBe(5)
  })

  it('scores buying sooner as better', () => {
    const scored = scoreCustomers([
      facts({ clientId: 'recent', recencyDays: 1 }),
      facts({ clientId: 'old', recencyDays: 400 }),
    ])
    expect(scored.find((c) => c.clientId === 'recent')!.r).toBeGreaterThan(
      scored.find((c) => c.clientId === 'old')!.r,
    )
  })

  it('scores a non-buyer at the bottom without skewing everyone else', () => {
    const scored = scoreCustomers([
      facts({ clientId: 'buyer', purchases: 3, spend: 500 }),
      facts({ clientId: 'never', purchases: 0, spend: 0, recencyDays: null }),
    ])
    const never = scored.find((c) => c.clientId === 'never')!
    expect(never).toMatchObject({ r: 1, f: 1, m: 1, segment: 'lost' })
    // The buyer is still top of a base of one buyer.
    expect(scored.find((c) => c.clientId === 'buyer')!.m).toBe(5)
  })

  it('handles an empty base', () => {
    expect(scoreCustomers([])).toEqual([])
  })
})
