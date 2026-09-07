import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SETTINGS,
  dailyRate,
  daysOfCover,
  needsOrdering,
  reorderPoint,
  suggestedQuantity,
  urgencyOf,
} from './reorder'

const settings = { leadTimeDays: 30, coverDays: 45, historyDays: 90 }

describe('how fast it sells', () => {
  it('averages the window', () => {
    expect(dailyRate(90, 90)).toBe(1)
    expect(dailyRate(45, 90)).toBe(0.5)
    expect(dailyRate(0, 90)).toBe(0)
  })

  it('says nothing rather than infinity when a part never sells', () => {
    // "Lasts forever" and "we have no idea" are the same number, and neither
    // should sort alongside real figures.
    expect(daysOfCover(50, 0)).toBeNull()
    expect(daysOfCover(50, 1)).toBe(50)
  })
})

describe('when to order', () => {
  it('triggers at a delivery’s worth of demand', () => {
    // Sells one a day, delivery takes 30 days: below 30 on the shelf and it
    // runs out before anything can arrive.
    expect(reorderPoint(1, settings)).toBe(30)
    expect(reorderPoint(0.5, settings)).toBe(15)
  })

  it('rounds the trigger up, never down', () => {
    // 0.7 × 30 = 21 exactly; 0.71 × 30 = 21.3 must become 22, not 21.
    expect(reorderPoint(0.71, settings)).toBe(22)
  })
})

describe('how many to order', () => {
  it('covers the wait plus the period after it, less what is on the shelf', () => {
    // 1/day × (30 + 45) = 75 wanted, 20 on hand → 55.
    expect(suggestedQuantity(20, 1, null, settings)).toEqual({ shortfall: 55, suggested: 55 })
  })

  it('orders nothing when there is already enough', () => {
    expect(suggestedQuantity(200, 1, null, settings)).toEqual({ shortfall: 0, suggested: 0 })
  })

  it('rounds up to a whole supplier minimum', () => {
    // Needs 55, supplier ships in 12s → 60, not 55, because 55 is an order
    // nobody can place.
    expect(suggestedQuantity(20, 1, 12, settings)).toEqual({ shortfall: 55, suggested: 60 })
  })

  it('still orders one whole minimum for a small shortfall', () => {
    expect(suggestedQuantity(74, 1, 12, settings)).toEqual({ shortfall: 1, suggested: 12 })
  })

  it('ignores a meaningless minimum', () => {
    expect(suggestedQuantity(20, 1, 1, settings).suggested).toBe(55)
    expect(suggestedQuantity(20, 1, 0, settings).suggested).toBe(55)
  })

  it('never suggests a negative order', () => {
    expect(suggestedQuantity(5000, 1, null, settings).suggested).toBe(0)
  })
})

describe('urgency', () => {
  const cover = (onHand: number, rate: number) =>
    urgencyOf(onHand, rate, daysOfCover(onHand, rate), settings)

  it('is about time, not about quantity', () => {
    // Ten units is comfortable at one a month and an emergency at one a day.
    expect(cover(10, 1 / 30)).toBe('ok')
    expect(cover(10, 1)).toBe('critical')
  })

  it('calls it out of stock only when something actually sells', () => {
    expect(cover(0, 1)).toBe('out')
    // An empty shelf of something nobody buys is not an emergency, and saying
    // so would bury the parts that matter.
    expect(cover(0, 0)).toBe('idle')
  })

  it('warns before the shelf empties, not after', () => {
    // 40 days of cover, 30-day lead time: it will not run out, but ordering
    // has to start now to keep the buffer.
    expect(cover(40, 1)).toBe('soon')
    expect(cover(100, 1)).toBe('ok')
  })

  it('only flags what is worth acting on', () => {
    expect(needsOrdering({ urgency: 'critical', suggested: 10 })).toBe(true)
    expect(needsOrdering({ urgency: 'ok', suggested: 10 })).toBe(false)
    // Nothing to order is nothing to do, whatever the state says.
    expect(needsOrdering({ urgency: 'out', suggested: 0 })).toBe(false)
  })
})

describe('the defaults', () => {
  it('assume a container, not a courier', () => {
    // An importer's delivery is weeks away; a default of 7 days would make
    // every suggestion wrong on the first screen.
    expect(DEFAULT_SETTINGS.leadTimeDays).toBeGreaterThanOrEqual(14)
    expect(DEFAULT_SETTINGS.coverDays).toBeGreaterThan(0)
    expect(DEFAULT_SETTINGS.historyDays).toBeGreaterThanOrEqual(30)
  })
})
