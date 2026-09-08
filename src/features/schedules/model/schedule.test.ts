import { describe, expect, it } from 'vitest'
import { useDataStore } from '@/data/store'
import { describeDays, isDue, nextRunAt, type ReorderSchedule } from './schedule'

const cadence = (daysOfMonth: number[], timeOfDay = '09:00', active = true) => ({
  daysOfMonth,
  timeOfDay,
  active,
})

describe('when a schedule next runs', () => {
  it('finds the next day this month', () => {
    const from = new Date(2026, 2, 3, 12, 0) // 3 March, midday
    expect(nextRunAt(cadence([1, 15]), from)).toEqual(new Date(2026, 2, 15, 9, 0))
  })

  it('rolls into next month once the days here have passed', () => {
    const from = new Date(2026, 2, 20, 12, 0)
    expect(nextRunAt(cadence([1, 15]), from)).toEqual(new Date(2026, 3, 1, 9, 0))
  })

  it('does not count a run time that has already passed today', () => {
    const from = new Date(2026, 2, 15, 10, 0) // 15th, an hour after 09:00
    expect(nextRunAt(cadence([15]), from)).toEqual(new Date(2026, 3, 15, 9, 0))
  })

  it('still runs today when the time has not come round yet', () => {
    const from = new Date(2026, 2, 15, 8, 0)
    expect(nextRunAt(cadence([15]), from)).toEqual(new Date(2026, 2, 15, 9, 0))
  })

  it('clamps a day the month does not have to its last day', () => {
    // The 31st in February means the end of February, not "skip February".
    const from = new Date(2026, 1, 2, 12, 0)
    expect(nextRunAt(cadence([31]), from)).toEqual(new Date(2026, 1, 28, 9, 0))
  })

  it('does not run a paused schedule', () => {
    expect(nextRunAt(cadence([1], '09:00', false), new Date(2026, 2, 3))).toBeNull()
  })

  it('does not run a schedule with no days', () => {
    expect(nextRunAt(cadence([]), new Date(2026, 2, 3))).toBeNull()
  })
})

describe('overdue', () => {
  const schedule = (over: Partial<ReorderSchedule>): ReorderSchedule =>
    ({
      daysOfMonth: [1],
      timeOfDay: '09:00',
      active: true,
      createdAt: new Date(2026, 0, 1).toISOString(),
      lastRun: null,
      ...over,
    }) as ReorderSchedule

  it('is due when a run time has passed since the last run', () => {
    const s = schedule({
      lastRun: { at: new Date(2026, 1, 2).toISOString() } as ReorderSchedule['lastRun'],
    })
    expect(isDue(s, new Date(2026, 2, 5))).toBe(true)
  })

  it('is not due when the last run is more recent than any due time', () => {
    const s = schedule({
      lastRun: { at: new Date(2026, 2, 1, 10, 0).toISOString() } as ReorderSchedule['lastRun'],
    })
    expect(isDue(s, new Date(2026, 2, 5))).toBe(false)
  })

  it('is never due while paused', () => {
    expect(isDue(schedule({ active: false }), new Date(2027, 0, 1))).toBe(false)
  })
})

describe('reading a cadence back', () => {
  it('says the days the way a person would', () => {
    expect(describeDays([1])).toBe('the 1st')
    expect(describeDays([15, 1])).toBe('the 1st and 15th')
    expect(describeDays([1, 10, 20])).toBe('the 1st, 10th and 20th')
    expect(describeDays([2, 3, 22, 31])).toBe('the 2nd, 3rd, 22nd and 31st')
  })
})

describe('running a schedule', () => {
  const first = () => useDataStore.getState().schedules[0]!

  /**
   * Widens the horizon so a shortfall is certain.
   *
   * Without this the test depends on the seed happening to leave that supplier
   * short — which is luck, not behaviour, and broke the moment the seed's
   * random sequence shifted.
   */
  const guaranteeShortfall = () =>
    useDataStore.getState().updateSchedule(first().id, {
      supplierId: first().supplierId,
      locationId: first().locationId,
      daysOfMonth: first().daysOfMonth,
      timeOfDay: first().timeOfDay,
      settings: { salesWindowDays: 90, leadTimeDays: 180, orderIntervalDays: 90, safetyDays: 60 },
      active: true,
    })

  it('leaves a draft order, never a sent one', () => {
    guaranteeShortfall()
    const before = useDataStore.getState().orders.length
    const result = useDataStore.getState().runSchedule(first().id, 'manual')
    expect(result.ok).toBe(true)
    if (!result.ok || !result.orderId) throw new Error('expected an order')

    const order = useDataStore.getState().orders.find((o) => o.id === result.orderId)!
    // Committing money to a supplier stays a human decision.
    expect(order.status).toBe('draft')
    expect(order.supplierId).toBe(first().supplierId)
    expect(order.lines.length).toBeGreaterThan(0)
    expect(useDataStore.getState().orders).toHaveLength(before + 1)
  })

  it('only orders what is actually short', () => {
    guaranteeShortfall()
    const result = useDataStore.getState().runSchedule(first().id, 'manual')
    if (!result.ok || !result.orderId) throw new Error('expected an order')
    const order = useDataStore.getState().orders.find((o) => o.id === result.orderId)!
    for (const line of order.lines) expect(line.orderedQuantity).toBeGreaterThan(0)
  })

  it('records what the run did, so the list can show it', () => {
    guaranteeShortfall()
    const id = first().id
    useDataStore.getState().runSchedule(id, 'manual')
    const run = useDataStore.getState().schedules.find((s) => s.id === id)!.lastRun!
    expect(run.trigger).toBe('manual')
    expect(run.products).toBeGreaterThan(0)
    expect(run.units).toBeGreaterThan(0)
    expect(run.orderNumber).toMatch(/^PO-/)
  })

  it('records a run that found nothing rather than creating an empty order', () => {
    const id = first().id
    // A supplier who has never delivered anything is linked to no product, so
    // a run against them has nothing to suggest. Setting a schedule up before
    // the first delivery is an ordinary thing to do.
    useDataStore.getState().updateSchedule(id, {
      supplierId: 'sup-never-delivered',
      locationId: first().locationId,
      daysOfMonth: [1],
      timeOfDay: '09:00',
      settings: first().settings,
      active: true,
    })
    const before = useDataStore.getState().orders.length
    const result = useDataStore.getState().runSchedule(id, 'schedule')

    expect(result).toEqual({ ok: true, orderId: null })
    expect(useDataStore.getState().orders).toHaveLength(before)
    const run = useDataStore.getState().schedules.find((s) => s.id === id)!.lastRun!
    expect(run.orderId).toBeNull()
    expect(run.products).toBe(0)
    expect(run.trigger).toBe('schedule')
  })

  it('refuses a schedule that no longer exists', () => {
    expect(useDataStore.getState().runSchedule('nope', 'manual').ok).toBe(false)
  })
})
