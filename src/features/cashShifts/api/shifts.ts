import { useMemo } from 'react'
import { useDataStore } from '@/data/store'
import { matches } from '@/data/query'
import {
  expectedCash,
  openShiftFor,
  variance,
  verdictOf,
  type CashShift,
  type ShiftSaleTotals,
  type ShiftStatus,
} from '../model/shift'

/**
 * A shift plus everything derived from the sales inside it.
 *
 * The totals are computed, never stored: a shift's cash is the sales that
 * point at it, so the two can never drift apart the way a cached figure would.
 */
export interface ShiftRow extends CashShift {
  totals: ShiftSaleTotals
  expected: number
  difference: number | null
  verdict: ReturnType<typeof verdictOf>
}

function totalsFor(sales: ReturnType<typeof useDataStore.getState>['sales'], shiftId: string) {
  // A deleted sale never happened, so its cash cannot be expected in the
  // drawer — the same rule the sales ledger applies to revenue.
  const mine = sales.filter((sale) => sale.shiftId === shiftId && sale.status !== 'deleted')
  const sum = (method: string) =>
    mine
      .filter((sale) => sale.paymentMethod === method)
      .reduce((total, sale) => total + sale.paid, 0)

  return {
    cash: sum('cash'),
    card: sum('card'),
    transfer: sum('transfer'),
    credit: sum('credit'),
    count: mine.length,
  }
}

export function useCashShifts(filters: { search?: unknown; status?: unknown } = {}) {
  const shifts = useDataStore((s) => s.cashShifts)
  const sales = useDataStore((s) => s.sales)

  return useMemo(() => {
    const items: ShiftRow[] = shifts
      .filter((shift) => {
        if (filters.status && shift.status !== filters.status) return false
        return matches(
          [shift.number, shift.registerName, shift.employeeName, shift.locationName],
          filters.search as string | undefined,
        )
      })
      .map((shift) => {
        const totals = totalsFor(sales, shift.id)
        const expected = expectedCash(shift, totals.cash)
        const difference = variance(shift, totals.cash)
        return { ...shift, totals, expected, difference, verdict: verdictOf(difference) }
      })
      // Open drawers first — they are the ones somebody has to act on.
      .sort((a, b) => {
        const byOpen = Number(b.status === 'open') - Number(a.status === 'open')
        return byOpen !== 0 ? byOpen : b.openedAt.localeCompare(a.openedAt)
      })

    return { data: { items, total: items.length }, isLoading: false }
  }, [shifts, sales, filters.status, filters.search])
}

export function useCashShift(id: string | undefined) {
  const { data } = useCashShifts()
  return useMemo(
    () => ({ data: data.items.find((shift) => shift.id === id), isLoading: false }),
    [data.items, id],
  )
}

export function useShiftCounts(): Record<string, number> {
  const shifts = useDataStore((s) => s.cashShifts)
  return useMemo(() => {
    const counts: Record<string, number> = { all: shifts.length }
    for (const status of ['open', 'closed'] as ShiftStatus[]) {
      counts[status] = shifts.filter((shift) => shift.status === status).length
    }
    return counts
  }, [shifts])
}

/**
 * The open drawer at a location, if there is one. New sale asks this before
 * it will take cash.
 */
export function useOpenShiftAt(locationId: string | null) {
  const shifts = useDataStore((s) => s.cashShifts)
  return useMemo(() => (locationId ? openShiftFor(shifts, locationId) : null), [shifts, locationId])
}

export function useShiftActions() {
  const open = useDataStore((s) => s.openShift)
  const close = useDataStore((s) => s.closeShift)
  const move = useDataStore((s) => s.addCashMovement)
  return useMemo(() => ({ open, close, move, isPending: false }), [open, close, move])
}

export function useCashRegisters() {
  const registers = useDataStore((s) => s.cashRegisters)
  return { data: registers, isLoading: false }
}

export function useRegisterActions() {
  const create = useDataStore((s) => s.createCashRegister)
  const update = useDataStore((s) => s.updateCashRegister)
  const remove = useDataStore((s) => s.deleteCashRegister)
  return useMemo(() => ({ create, update, remove }), [create, update, remove])
}
