import { describe, expect, it } from 'vitest'
import { formatMoney } from '@/shared/lib/format'
import {
  appliesToClient,
  bestPromotion,
  describeAudience,
  describeScope,
  covers,
  daysRemaining,
  describe as describePromotion,
  discountFor,
  isLive,
  promotionStatus,
  type PromotableLine,
  type Promotion,
} from './promotion'

const day = 86_400_000
const NOW = new Date('2026-09-08T12:00:00Z')

const promo = (over: Partial<Promotion> = {}): Promotion =>
  ({
    id: 'promo-1',
    name: 'Autumn brakes',
    kind: 'percentage',
    value: 10,
    scope: 'all',
    scopeIds: [],
    scopeNames: [],
    audience: 'everyone',
    clientIds: [],
    clientNames: [],
    startsAt: new Date(NOW.getTime() - 5 * day).toISOString(),
    endsAt: new Date(NOW.getTime() + 5 * day).toISOString(),
    paused: false,
    minimumSale: null,
    ...over,
  }) as Promotion

const line = (over: Partial<PromotableLine> = {}): PromotableLine => ({
  variationId: 'v1',
  productId: 'prd-1',
  categoryId: 'cat-1',
  quantity: 2,
  unitPrice: 100_000,
  ...over,
})

describe('when a promotion is on', () => {
  it('is running between its dates', () => {
    expect(promotionStatus(promo(), NOW)).toBe('running')
    expect(isLive(promo(), NOW)).toBe(true)
  })

  it('is scheduled before it starts', () => {
    const future = promo({ startsAt: new Date(NOW.getTime() + day).toISOString() })
    expect(promotionStatus(future, NOW)).toBe('scheduled')
  })

  it('is finished once the end date has passed', () => {
    // Derived, not stored — a stored status goes stale exactly when a finished
    // promotion would otherwise keep discounting.
    const past = promo({ endsAt: new Date(NOW.getTime() - day).toISOString() })
    expect(promotionStatus(past, NOW)).toBe('finished')
  })

  it('runs forever with no end date', () => {
    expect(promotionStatus(promo({ endsAt: null }), NOW)).toBe('running')
  })

  it('is paused regardless of its dates, and keeps them', () => {
    const paused = promo({ paused: true })
    expect(promotionStatus(paused, NOW)).toBe('paused')
    expect(promotionStatus({ ...paused, paused: false }, NOW)).toBe('running')
  })

  it('counts the days left only while running', () => {
    expect(daysRemaining(promo(), NOW)).toBe(5)
    expect(daysRemaining(promo({ endsAt: null }), NOW)).toBeNull()
    expect(daysRemaining(promo({ paused: true }), NOW)).toBeNull()
  })
})

describe('what it covers', () => {
  it('covers everything when scoped to all', () => {
    expect(covers(promo(), line())).toBe(true)
  })

  it('covers only the named categories', () => {
    const p = promo({ scope: 'category', scopeIds: ['cat-1', 'cat-3'] })
    expect(covers(p, line({ categoryId: 'cat-1' }))).toBe(true)
    expect(covers(p, line({ categoryId: 'cat-3' }))).toBe(true)
    expect(covers(p, line({ categoryId: 'cat-2' }))).toBe(false)
  })

  it('covers nothing when the scope is empty', () => {
    // An unfinished promotion must not silently discount the whole catalogue.
    expect(covers(promo({ scope: 'category', scopeIds: [] }), line())).toBe(false)
  })

  it('covers only the named product, across all its variations', () => {
    // An offer on a part covers its left and right sides alike.
    const p = promo({ scope: 'product', scopeIds: ['prd-1'] })
    expect(covers(p, line({ productId: 'prd-1', variationId: 'v1' }))).toBe(true)
    expect(covers(p, line({ productId: 'prd-1', variationId: 'v2' }))).toBe(true)
    expect(covers(p, line({ productId: 'prd-9' }))).toBe(false)
  })
})

describe('what it takes off', () => {
  it('takes a percentage of the whole basket', () => {
    // 2 × 100 000 = 200 000, 10% = 20 000.
    expect(discountFor(promo(), [line()], NOW)).toBe(20_000)
  })

  it('takes a percentage of the covered lines only', () => {
    const p = promo({ scope: 'category', scopeIds: ['cat-1'], value: 50 })
    const lines = [line({ categoryId: 'cat-1' }), line({ categoryId: 'cat-2' })]
    // Half of the 200 000 that is covered, not of the 400 000 basket.
    expect(discountFor(p, lines, NOW)).toBe(100_000)
  })

  it('takes a fixed amount off the sale', () => {
    expect(discountFor(promo({ kind: 'fixed', value: 50_000 }), [line()], NOW)).toBe(50_000)
  })

  it('never discounts more than the goods are worth', () => {
    // A promotion must not turn a sale into a payment to the customer.
    const p = promo({ kind: 'fixed', value: 900_000 })
    expect(discountFor(p, [line()], NOW)).toBe(200_000)
  })

  it('does nothing when nothing is covered', () => {
    const p = promo({ scope: 'product', scopeIds: ['prd-9'] })
    expect(discountFor(p, [line()], NOW)).toBe(0)
  })

  it('does nothing below the minimum sale', () => {
    const p = promo({ minimumSale: 500_000 })
    expect(discountFor(p, [line()], NOW)).toBe(0)
    expect(discountFor(p, [line({ quantity: 6 })], NOW)).toBe(60_000)
  })

  it('does nothing when it is not running', () => {
    expect(discountFor(promo({ paused: true }), [line()], NOW)).toBe(0)
    const future = promo({ startsAt: new Date(NOW.getTime() + day).toISOString() })
    expect(discountFor(future, [line()], NOW)).toBe(0)
  })

  it('does nothing to an empty basket', () => {
    expect(discountFor(promo(), [], NOW)).toBe(0)
  })
})

describe('choosing between promotions', () => {
  it('takes the best one for the customer, not both', () => {
    // Stacking two overlapping offers is how a shop sells below cost by
    // accident; "the better of the two" is a rule a seller can explain.
    const ten = promo({ id: 'a', value: 10 })
    const twenty = promo({ id: 'b', value: 20 })
    const best = bestPromotion([ten, twenty], [line()], NOW)
    expect(best?.promotion.id).toBe('b')
    expect(best?.discount).toBe(40_000)
  })

  it('ignores ones that do not apply', () => {
    const dead = promo({ id: 'a', paused: true, value: 90 })
    const live = promo({ id: 'b', value: 5 })
    expect(bestPromotion([dead, live], [line()], NOW)?.promotion.id).toBe('b')
  })

  it('returns nothing when none apply', () => {
    expect(bestPromotion([promo({ paused: true })], [line()], NOW)).toBeNull()
    expect(bestPromotion([], [line()], NOW)).toBeNull()
  })
})

describe('how it reads', () => {
  it('names one or two things, then counts them', () => {
    expect(describeScope(promo())).toBe('everything')
    expect(describeScope(promo({ scope: 'category', scopeNames: ['Brakes'] }))).toBe('Brakes')
    expect(describeScope(promo({ scope: 'category', scopeNames: ['Brakes', 'Filters'] }))).toBe(
      'Brakes and Filters',
    )
    // Four truncated labels are less readable than the count.
    expect(describeScope(promo({ scope: 'product', scopeNames: ['A', 'B', 'C', 'D'] }))).toBe(
      '4 products',
    )
    expect(describeScope(promo({ scope: 'category', scopeNames: [] }))).toBe('nothing yet')
  })

  it('says the rule in a sentence', () => {
    expect(describePromotion(promo())).toBe('10% off everything')
    expect(
      describePromotion(
        promo({
          kind: 'fixed',
          value: 50_000,
          scope: 'product',
          scopeNames: ['Brake pad set X30'],
        }),
      ),
    ).toBe(`${formatMoney(50_000)} off Brake pad set X30`)
  })
})

describe('appliesToClient', () => {
  const targeted = promo({
    audience: 'clients',
    clientIds: ['cl-1', 'cl-2'],
    clientNames: ['Fura Logistics', "Yo'l Trans"],
  })

  it('lets an everyone promotion reach anybody, named or not', () => {
    expect(appliesToClient(promo(), 'cl-9')).toBe(true)
    expect(appliesToClient(promo(), null)).toBe(true)
  })

  it('reaches a client on the list', () => {
    expect(appliesToClient(targeted, 'cl-2')).toBe(true)
  })

  it('does not reach a client who is not on it', () => {
    expect(appliesToClient(targeted, 'cl-9')).toBe(false)
  })

  it('never reaches a walk-in — a targeted offer nobody can be traced to is untraceable', () => {
    expect(appliesToClient(targeted, null)).toBe(false)
  })

  it('applies to everyone when the field is missing entirely', () => {
    // A promotion made before audiences existed must not quietly stop working.
    const legacy = { clientIds: [] } as unknown as Promotion
    expect(appliesToClient(legacy, null)).toBe(true)
  })
})

describe('discountFor with an audience', () => {
  const targeted = promo({ audience: 'clients', clientIds: ['cl-1'], clientNames: ['Fura'] })
  const lines = [line({ quantity: 2, unitPrice: 100_000 })]

  it('discounts for the client it is aimed at', () => {
    expect(discountFor(targeted, lines, NOW, 'cl-1')).toBe(20_000)
  })

  it('discounts nothing for anybody else', () => {
    expect(discountFor(targeted, lines, NOW, 'cl-2')).toBe(0)
    expect(discountFor(targeted, lines, NOW, null)).toBe(0)
  })
})

describe('bestPromotion with an audience', () => {
  const lines = [line({ quantity: 1, unitPrice: 1_000_000 })]
  const general = promo({ id: 'p-general', value: 5 })
  const forFura = promo({
    id: 'p-fura',
    value: 12,
    audience: 'clients',
    clientIds: ['cl-1'],
    clientNames: ['Fura'],
  })

  it('gives a targeted client the better, targeted offer', () => {
    expect(bestPromotion([general, forFura], lines, NOW, 'cl-1')?.promotion.id).toBe('p-fura')
  })

  it('falls back to the general offer for everybody else', () => {
    expect(bestPromotion([general, forFura], lines, NOW, 'cl-2')?.promotion.id).toBe('p-general')
  })

  it('still gives one discount, never both', () => {
    // The rule this screen has always had: the better of the two, not the sum.
    expect(bestPromotion([general, forFura], lines, NOW, 'cl-1')?.discount).toBe(120_000)
  })
})

describe('describeAudience', () => {
  it('says everyone', () => {
    expect(describeAudience(promo())).toBe('everyone')
  })

  it('names one or two clients', () => {
    expect(describeAudience({ audience: 'clients', clientNames: ['Fura', 'Trans'] })).toBe(
      'Fura and Trans',
    )
  })

  it('counts more than two', () => {
    expect(describeAudience({ audience: 'clients', clientNames: ['A', 'B', 'C'] })).toBe(
      '3 clients',
    )
  })

  it('says so when nobody is chosen yet', () => {
    expect(describeAudience({ audience: 'clients', clientNames: [] })).toBe('nobody yet')
  })
})
