import { z } from 'zod'
import type { Id, IsoDate } from '@/shared/types'

/**
 * Who works here.
 *
 * An employee record is two things at once, and the screen has to serve both
 * without pretending they are the same:
 *
 *   1. **A key.** Who can sign in, as what role, at which location. This is the
 *      half that Access & roles governs.
 *   2. **A performance record.** Every sale already carries who made it, so the
 *      question "how is this person doing" is answerable from data that exists
 *      — and it is the only question a manager actually opens this screen with.
 *
 * A staff list that is only names and phone numbers is an address book. The
 * columns here are the ones that change a decision: what they sell, whether
 * they are still signing in, and what the company owes them.
 */
export type EmployeeStatus = 'active' | 'suspended' | 'archived'

export const EMPLOYEE_STATUSES: {
  value: EmployeeStatus
  label: string
  tone: 'success' | 'warning' | 'neutral'
  hint: string
}[] = [
  { value: 'active', label: 'Active', tone: 'success', hint: 'Works here and can sign in' },
  {
    value: 'suspended',
    label: 'Suspended',
    tone: 'warning',
    // Deliberately reversible and deliberately not deletion: someone on leave,
    // or under investigation, still has sales history worth keeping intact.
    hint: 'Still employed, cannot sign in',
  },
  { value: 'archived', label: 'Archived', tone: 'neutral', hint: 'Has left. History is kept' },
]

export const employeeStatusLabel = (status: EmployeeStatus) =>
  EMPLOYEE_STATUSES.find((entry) => entry.value === status)?.label ?? status

export const employeeStatusTone = (status: EmployeeStatus) =>
  EMPLOYEE_STATUSES.find((entry) => entry.value === status)?.tone ?? 'neutral'

export interface Employee {
  id: Id
  fullName: string
  /** What they are called on the sales floor, and on a sale record. */
  phone: string | null
  email: string | null
  avatarUrl: string | null
  roleId: Id
  roleName: string
  /** Where they work. Null means they are not tied to one shop. */
  locationId: Id | null
  locationName: string | null
  status: EmployeeStatus
  hiredAt: IsoDate
  /** Last time they signed in. Null when they never have. */
  lastActiveAt: IsoDate | null
  /** Monthly base pay, before anything Seller motivation adds. */
  salary: number | null
  comment: string | null
  createdAt: IsoDate
  updatedAt: IsoDate
}

/**
 * What the sales ledger says about someone. Derived on read, never stored — a
 * stored total is a total that goes stale, and the sales are right there.
 */
export interface EmployeeStats {
  /** Completed revenue attributed to them, all time and this month. */
  revenue: number
  revenueThisMonth: number
  sales: number
  salesThisMonth: number
  units: number
  /** Revenue ÷ sales. The number a manager actually compares people on. */
  averageCheck: number
  /** Gross margin they brought in, which is not the same as what they sold. */
  margin: number
  marginRatio: number
  lastSaleAt: IsoDate | null
}

export const EMPTY_STATS: EmployeeStats = {
  revenue: 0,
  revenueThisMonth: 0,
  sales: 0,
  salesThisMonth: 0,
  units: 0,
  averageCheck: 0,
  margin: 0,
  marginRatio: 0,
  lastSaleAt: null,
}

/**
 * How long since they last signed in, in days. Null when they never have.
 *
 * This is the column that finds the account nobody remembered to close: a
 * "seller" who has not signed in for four months is either gone or is a login
 * somebody else is using.
 */
export function daysSinceActive(employee: Pick<Employee, 'lastActiveAt'>): number | null {
  if (!employee.lastActiveAt) return null
  return Math.floor((Date.now() - new Date(employee.lastActiveAt).getTime()) / 86_400_000)
}

/** An active account that has gone quiet for long enough to be worth a look. */
export const DORMANT_DAYS = 30

export const isDormant = (employee: Employee) => {
  if (employee.status !== 'active') return false
  const days = daysSinceActive(employee)
  return days === null || days >= DORMANT_DAYS
}

export const initials = (fullName: string) =>
  fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')

/* --- validation ---------------------------------------------------------- */

export const employeeDraftSchema = z.object({
  fullName: z.string().min(2, 'Give them a name'),
  phone: z.string().nullable(),
  email: z.string().email('That is not an email address').or(z.literal('')).nullable(),
  roleId: z.string().min(1, 'Every account needs a role'),
  locationId: z.string().nullable(),
  status: z.enum(['active', 'suspended', 'archived']),
  hiredAt: z.string(),
  salary: z.number().nonnegative().nullable(),
  comment: z.string().nullable(),
})

export type EmployeeDraft = z.infer<typeof employeeDraftSchema>
