import { z } from 'zod'
import type { Id, IsoDate } from '@/shared/types'

/**
 * Cash registers and cash shifts.
 *
 * The client asked for «Касса» and «Кассовые смены». This is the honest
 * version of that request for a product with no till: nobody rings anything up
 * here, sales are still typed by hand on New sale. What this adds is the
 * accountability a drawer needs — who had it, what went in and out, and
 * whether it balanced at the end of the day.
 *
 * The whole feature earns its keep through one number: **variance**, the
 * difference between the cash the system expected and the cash a person
 * counted. Everything else exists to make that number mean something.
 */
export interface CashRegister {
  id: Id
  name: string
  locationId: Id
  locationName: string
  active: boolean
}

export type ShiftStatus = 'open' | 'closed'

/** Why money moved in or out of the drawer other than by a sale. */
export type MovementKind = 'in' | 'out'

export const MOVEMENT_REASONS: { value: string; label: string; kind: MovementKind }[] = [
  { value: 'float', label: 'Extra float added', kind: 'in' },
  { value: 'refund', label: 'Refund to a customer', kind: 'out' },
  { value: 'supplier', label: 'Paid a supplier in cash', kind: 'out' },
  { value: 'expense', label: 'Petty expense', kind: 'out' },
  { value: 'collection', label: 'Collected to the safe', kind: 'out' },
  { value: 'other', label: 'Something else', kind: 'in' },
]

export interface CashMovement {
  id: Id
  kind: MovementKind
  reason: string
  amount: number
  comment: string | null
  at: IsoDate
  by: string
}

export interface CashShift {
  id: Id
  number: string
  registerId: Id
  registerName: string
  locationId: Id
  locationName: string
  /** Who opened it, and is answerable for the drawer. */
  employeeId: Id
  employeeName: string
  status: ShiftStatus
  openedAt: IsoDate
  closedAt: IsoDate | null
  /** Cash in the drawer at the start. */
  openingFloat: number
  movements: CashMovement[]
  /**
   * What a person counted at the end. Null while the shift is open — an
   * uncounted drawer must never read as a drawer counted at zero.
   */
  countedCash: number | null
  closingComment: string | null
}

/* --- the arithmetic ------------------------------------------------------ */

export interface ShiftSaleTotals {
  /** Cash sales only — the drawer never sees a card payment. */
  cash: number
  /** Everything else taken during the shift, for the summary. */
  card: number
  transfer: number
  credit: number
  count: number
}

export const movementsIn = (shift: Pick<CashShift, 'movements'>) =>
  shift.movements.filter((m) => m.kind === 'in').reduce((sum, m) => sum + m.amount, 0)

export const movementsOut = (shift: Pick<CashShift, 'movements'>) =>
  shift.movements.filter((m) => m.kind === 'out').reduce((sum, m) => sum + m.amount, 0)

/**
 * What should be in the drawer right now.
 *
 * Float, plus cash taken, plus anything paid in, less anything paid out. Card
 * and transfer deliberately do not appear: they never touch the drawer, and
 * counting them here is the classic way a cash-up stops balancing.
 */
export function expectedCash(
  shift: Pick<CashShift, 'openingFloat' | 'movements'>,
  cashSales: number,
) {
  return shift.openingFloat + cashSales + movementsIn(shift) - movementsOut(shift)
}

/**
 * Counted less expected. Positive means more cash than the system thought,
 * which is not "good" — it usually means a sale went unrecorded.
 */
export function variance(
  shift: Pick<CashShift, 'openingFloat' | 'movements' | 'countedCash'>,
  cashSales: number,
): number | null {
  if (shift.countedCash === null) return null
  return shift.countedCash - expectedCash(shift, cashSales)
}

/**
 * Small differences are life; large ones are a problem. The threshold is a
 * business judgement, so it lives here as one named constant rather than
 * scattered through the screens.
 */
export const VARIANCE_TOLERANCE = 5_000

export type VarianceVerdict = 'exact' | 'short' | 'over' | 'within'

export function verdictOf(difference: number | null): VarianceVerdict | null {
  if (difference === null) return null
  if (difference === 0) return 'exact'
  if (Math.abs(difference) <= VARIANCE_TOLERANCE) return 'within'
  return difference < 0 ? 'short' : 'over'
}

export const VERDICT_LABEL: Record<VarianceVerdict, string> = {
  exact: 'Balanced',
  within: 'Close enough',
  short: 'Short',
  over: 'Over',
}

/** How long the shift ran, in hours, for the list column. */
export function shiftHours(shift: Pick<CashShift, 'openedAt' | 'closedAt'>, now = Date.now()) {
  const end = shift.closedAt ? new Date(shift.closedAt).getTime() : now
  return Math.max(0, (end - new Date(shift.openedAt).getTime()) / 3_600_000)
}

/* --- rules --------------------------------------------------------------- */

/**
 * The rule that makes every number above trustworthy: cash cannot be taken
 * when no drawer is open. Without it a variance means nothing, because the
 * cash it is compared against was never attributable to anybody.
 */
export function cashSaleBlocked(paymentMethod: string, openShiftAtLocation: boolean): boolean {
  return paymentMethod === 'cash' && !openShiftAtLocation
}

export const openShiftFor = (shifts: CashShift[], locationId: string) =>
  shifts.find((shift) => shift.status === 'open' && shift.locationId === locationId) ?? null

export const openShiftForRegister = (shifts: CashShift[], registerId: string) =>
  shifts.find((shift) => shift.status === 'open' && shift.registerId === registerId) ?? null

/* --- forms --------------------------------------------------------------- */

export const openShiftSchema = z.object({
  registerId: z.string().min(1, 'Choose a register'),
  employeeId: z.string().min(1, 'Somebody has to be answerable for the drawer'),
  openingFloat: z.number().min(0, 'A float cannot be negative'),
})

export const closeShiftSchema = z.object({
  countedCash: z.number().min(0, 'Count the drawer before closing it'),
  closingComment: z.string().nullable(),
})

export const movementSchema = z.object({
  reason: z.string().min(1, 'Say why'),
  amount: z.number().positive('An amount is required'),
  comment: z.string().nullable(),
})

export const registerSchema = z.object({
  name: z.string().min(2, 'Give the register a name'),
  locationId: z.string().min(1, 'A register belongs to one location'),
  active: z.boolean(),
})

export type OpenShiftDraft = z.infer<typeof openShiftSchema>
export type CloseShiftDraft = z.infer<typeof closeShiftSchema>
export type MovementDraft = z.infer<typeof movementSchema>
export type RegisterDraft = z.infer<typeof registerSchema>

export const reasonLabel = (value: string) =>
  MOVEMENT_REASONS.find((reason) => reason.value === value)?.label ?? value
