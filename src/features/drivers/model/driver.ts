import { z } from 'zod'
import type { Id, IsoDate } from '@/shared/types'

/**
 * Drivers.
 *
 * The person who actually walks into the counter on behalf of a haulage
 * company. The company is the client — it holds the account, the debt and the
 * credit limit — but the client record cannot say *who came in*, and for a
 * business selling to fleets that is the missing name.
 *
 * A driver is deliberately **not** a user, an employee or a second kind of
 * client. They buy nothing on their own account; they are a name, a phone
 * number and the truck they turn up in.
 */
export type DriverStatus = 'active' | 'inactive'

export const DRIVER_STATUSES: { value: DriverStatus; label: string }[] = [
  { value: 'active', label: 'Driving' },
  { value: 'inactive', label: 'No longer driving' },
]

export interface Driver {
  id: Id
  fullName: string
  phone: string | null
  /** The company they drive for — a client. Null for an owner-driver. */
  clientId: Id | null
  /** Snapshotted, so renaming the company cannot blank the list. */
  clientName: string | null
  /**
   * The truck they turn up in. One plate, free text: the client asked to see
   * which vehicle a driver is attached to, and a plate is the whole of that.
   * A full vehicle record would be a fleet module, which this is not.
   */
  vehiclePlate: string | null
  licenceNumber: string | null
  comment: string | null
  status: DriverStatus
  createdAt: IsoDate
  updatedAt: IsoDate
}

export const driverSchema = z.object({
  fullName: z.string().min(2, 'A driver needs a name'),
  phone: z.string().nullable(),
  clientId: z.string().nullable(),
  vehiclePlate: z.string().nullable(),
  licenceNumber: z.string().nullable(),
  comment: z.string().nullable(),
  status: z.enum(['active', 'inactive']),
})

export type DriverDraft = z.infer<typeof driverSchema>

export const statusLabel = (status: DriverStatus) =>
  DRIVER_STATUSES.find((entry) => entry.value === status)?.label ?? status

/** "Fura Logistics · 01 A 123 AA" — who they drive for, and what in. */
export function describeDriver(driver: Pick<Driver, 'clientName' | 'vehiclePlate'>): string {
  return [driver.clientName ?? 'Owner-driver', driver.vehiclePlate].filter(Boolean).join(' · ')
}
