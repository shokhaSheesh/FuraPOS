import { z } from 'zod'
import type { Id, IsoDate } from '@/shared/types'
import type { ReorderSettings } from './reorder'

/**
 * A standing instruction to work out what to reorder, on a cadence.
 *
 * OX runs the same calculation on chosen days of the month and then **notifies
 * the responsible people**. That is where it stops, and it is a dead end: the
 * buyer still has to open the selection, read it and retype the whole thing as
 * an order.
 *
 * Ours finishes the job. A run leaves a **draft order** sitting in Orders,
 * already priced and addressed to the supplier, for a person to check and send.
 * Nothing is ever sent to a supplier automatically — the schedule does the
 * arithmetic and the typing, a human still makes the commitment.
 *
 * This is also why the schedule survived the removal of Product selection: the
 * arithmetic was never worth a screen of its own, only worth what it produces.
 */
export interface ReorderSchedule {
  id: Id
  /** One order goes to one company, so a schedule is scoped to one supplier. */
  supplierId: Id
  supplierName: string
  /** Where the goods should land, and the stock the run counts. */
  locationId: Id
  locationName: string
  /** Days of the month to run on, 1–31, ascending. */
  daysOfMonth: number[]
  /** Local time of day to run at, as `HH:mm`. */
  timeOfDay: string
  settings: ReorderSettings
  active: boolean
  /** The last run's outcome, kept so the list can show what it actually did. */
  lastRun: ScheduleRun | null
  createdBy: string
  createdAt: IsoDate
  updatedAt: IsoDate
}

export interface ScheduleRun {
  at: IsoDate
  /** Null when the run found nothing worth ordering — a real, useful outcome. */
  orderId: Id | null
  orderNumber: string | null
  products: number
  units: number
  /** Value of the draft order, in UZS. */
  value: number
  /** How it was triggered, because a hand-run and a due run mean different things. */
  trigger: 'schedule' | 'manual'
}

/* --- when it next runs --------------------------------------------------- */

const lastDayOf = (year: number, month: number) => new Date(year, month + 1, 0).getDate()

const [hoursOf, minutesOf] = [
  (time: string) => Number(time.split(':')[0] ?? 0),
  (time: string) => Number(time.split(':')[1] ?? 0),
]

/**
 * The next moment this schedule is due.
 *
 * A day that does not exist in a given month is **clamped to the last day of
 * it**, not skipped: someone who asked for the 31st wants a run at the end of
 * every month, and silently missing February would be the one month they never
 * find out about.
 */
export function nextRunAt(
  schedule: Pick<ReorderSchedule, 'daysOfMonth' | 'timeOfDay' | 'active'>,
  from: Date = new Date(),
): Date | null {
  if (!schedule.active || schedule.daysOfMonth.length === 0) return null

  // Two months is always enough: any day of the month recurs within one.
  for (let ahead = 0; ahead <= 1; ahead += 1) {
    const month = new Date(from.getFullYear(), from.getMonth() + ahead, 1)
    const last = lastDayOf(month.getFullYear(), month.getMonth())

    const days = [...new Set(schedule.daysOfMonth.map((day) => Math.min(day, last)))].sort(
      (a, b) => a - b,
    )

    for (const day of days) {
      const at = new Date(
        month.getFullYear(),
        month.getMonth(),
        day,
        hoursOf(schedule.timeOfDay),
        minutesOf(schedule.timeOfDay),
        0,
        0,
      )
      if (at.getTime() > from.getTime()) return at
    }
  }
  return null
}

/** Is this schedule overdue — due at some point in the past and never run since? */
export function isDue(schedule: ReorderSchedule, now: Date = new Date()): boolean {
  if (!schedule.active) return false
  const since = schedule.lastRun ? new Date(schedule.lastRun.at) : new Date(schedule.createdAt)
  const dueAfter = nextRunAt(schedule, since)
  return dueAfter !== null && dueAfter.getTime() <= now.getTime()
}

/* --- how it reads -------------------------------------------------------- */

const ORDINALS: Record<number, string> = {
  1: 'st',
  2: 'nd',
  3: 'rd',
  21: 'st',
  22: 'nd',
  23: 'rd',
  31: 'st',
}

export const ordinal = (day: number) => `${day}${ORDINALS[day] ?? 'th'}`

/**
 * The days as a person would say them: "the 1st and 15th", "the 1st, 10th and
 * 20th". A row of bare numbers is a list to decode, not a cadence to read.
 */
export function describeDays(days: number[]): string {
  const sorted = [...days].sort((a, b) => a - b).map(ordinal)
  if (sorted.length === 0) return 'never'
  if (sorted.length === 1) return `the ${sorted[0]}`
  return `the ${sorted.slice(0, -1).join(', ')} and ${sorted.at(-1)}`
}

/* --- validation ---------------------------------------------------------- */

export const scheduleDraftSchema = z.object({
  supplierId: z.string().min(1, 'Pick which supplier this orders from'),
  locationId: z.string().min(1, 'Pick where the goods should land'),
  daysOfMonth: z.array(z.number().int().min(1).max(31)).min(1, 'Pick at least one day'),
  timeOfDay: z.string().regex(/^\d{2}:\d{2}$/, 'Use a time like 09:00'),
  salesWindowDays: z.number().int().positive('Judge demand on at least one day'),
  leadTimeDays: z.number().int().nonnegative(),
  orderIntervalDays: z.number().int().positive('An order interval of zero orders forever'),
  safetyDays: z.number().int().nonnegative(),
  active: z.boolean(),
})

export type ScheduleDraft = z.infer<typeof scheduleDraftSchema>
