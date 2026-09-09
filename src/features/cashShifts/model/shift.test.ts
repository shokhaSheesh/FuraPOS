import { describe, expect, it } from 'vitest'
import {
  cashSaleBlocked,
  expectedCash,
  movementsIn,
  movementsOut,
  openShiftFor,
  shiftHours,
  variance,
  verdictOf,
  type CashShift,
} from './shift'

const shift: CashShift = {
  id: 'sh-1',
  number: 'CS-00001',
  registerId: 'reg-1',
  registerName: 'Main desk',
  locationId: 'loc-1',
  locationName: 'Main warehouse',
  employeeId: 'emp-1',
  employeeName: 'Akhmet',
  status: 'open',
  openedAt: '2026-09-08T08:00:00.000Z',
  closedAt: null,
  openingFloat: 200_000,
  movements: [
    { id: 'm1', kind: 'in', reason: 'float', amount: 50_000, comment: null, at: '', by: 'A' },
    { id: 'm2', kind: 'out', reason: 'expense', amount: 30_000, comment: null, at: '', by: 'A' },
  ],
  countedCash: null,
  closingComment: null,
}

describe('movement totals', () => {
  it('adds up each direction separately', () => {
    expect(movementsIn(shift)).toBe(50_000)
    expect(movementsOut(shift)).toBe(30_000)
  })
})

describe('expectedCash', () => {
  it('is float plus cash sales plus ins less outs', () => {
    expect(expectedCash(shift, 1_000_000)).toBe(1_220_000)
  })

  it('ignores card and transfer entirely — they never touch the drawer', () => {
    // Only cash sales are ever passed in; this is the guard against somebody
    // "fixing" a cash-up by adding card takings to it.
    expect(expectedCash(shift, 0)).toBe(220_000)
  })
})

describe('variance', () => {
  it('is null while the drawer is uncounted, never zero', () => {
    expect(variance(shift, 1_000_000)).toBeNull()
  })

  it('is negative when the drawer is short', () => {
    expect(variance({ ...shift, countedCash: 1_200_000 }, 1_000_000)).toBe(-20_000)
  })

  it('is positive when there is more cash than expected', () => {
    expect(variance({ ...shift, countedCash: 1_250_000 }, 1_000_000)).toBe(30_000)
  })
})

describe('verdictOf', () => {
  it('calls an exact match balanced', () => {
    expect(verdictOf(0)).toBe('exact')
  })

  it('tolerates small differences either way', () => {
    expect(verdictOf(-3_000)).toBe('within')
    expect(verdictOf(3_000)).toBe('within')
  })

  it('calls a big shortfall short and a big surplus over', () => {
    expect(verdictOf(-40_000)).toBe('short')
    expect(verdictOf(40_000)).toBe('over')
  })

  it('says nothing about an uncounted drawer', () => {
    expect(verdictOf(null)).toBeNull()
  })
})

describe('cashSaleBlocked', () => {
  it('blocks a cash sale when no drawer is open', () => {
    expect(cashSaleBlocked('cash', false)).toBe(true)
  })

  it('allows a cash sale once a shift is open', () => {
    expect(cashSaleBlocked('cash', true)).toBe(false)
  })

  it('never blocks card, transfer or credit — they do not touch a drawer', () => {
    expect(cashSaleBlocked('card', false)).toBe(false)
    expect(cashSaleBlocked('transfer', false)).toBe(false)
    expect(cashSaleBlocked('credit', false)).toBe(false)
  })
})

describe('openShiftFor', () => {
  const closed: CashShift = { ...shift, id: 'sh-0', status: 'closed', countedCash: 0 }

  it('finds the open shift at a location', () => {
    expect(openShiftFor([closed, shift], 'loc-1')?.id).toBe('sh-1')
  })

  it('ignores closed shifts', () => {
    expect(openShiftFor([closed], 'loc-1')).toBeNull()
  })

  it('ignores a shift open somewhere else', () => {
    expect(openShiftFor([shift], 'loc-2')).toBeNull()
  })
})

describe('shiftHours', () => {
  it('measures an open shift up to now', () => {
    const now = new Date('2026-09-08T14:00:00.000Z').getTime()
    expect(shiftHours(shift, now)).toBe(6)
  })

  it('measures a closed shift to its close, not to now', () => {
    const closed = { ...shift, closedAt: '2026-09-08T17:00:00.000Z' }
    expect(shiftHours(closed, Date.now())).toBe(9)
  })
})
