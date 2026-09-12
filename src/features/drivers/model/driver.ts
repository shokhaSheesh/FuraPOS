import { z } from 'zod'
import type { Id, IsoDate } from '@/shared/types'

/**
 * Drivers.
 *
 * The person who collects parts at the counter. Fura's customers are haulage
 * companies and owner-drivers, and this record is what turns an anonymous
 * counter sale into one that belongs to somebody — which is what the two
 * customer-facing apps read:
 *
 *   - the **e-commerce app** shows the driver his own purchases, offline ones
 *     included, under "My orders";
 *   - the **autopark owner's app** hangs the purchase on the truck it was for.
 *
 * Neither app is built here. This system is the source of both facts, so a
 * sale has to carry the driver *and* the truck, or neither app has anything
 * to show.
 */
export type DriverStatus = 'active' | 'inactive'

export const DRIVER_STATUSES: { value: DriverStatus; label: string }[] = [
  { value: 'active', label: 'Driving' },
  { value: 'inactive', label: 'No longer driving' },
]

/**
 * Who a purchase is for.
 *
 * A driver can own a truck *and* drive for an autopark, and the two are
 * different customers: one pays for himself, the other is buying on the
 * company's contract. The choice decides whose account the sale lands in,
 * which truck collects the history, and whether the autopark's promotion
 * applies — so it is asked at the till, not stored on the driver.
 */
export type DriverCapacity = 'own' | 'autopark'

export interface Driver {
  id: Id
  /**
   * What his QR code carries. Printed on his card and scanned at the counter;
   * typed by hand when the scanner is not to hand, which is why it is short
   * and readable rather than a UUID.
   */
  code: string
  fullName: string
  phone: string | null
  licenceNumber: string | null

  /** His own truck. Null when he only ever drives for an autopark. */
  ownTruckPlate: string | null

  /** The haulage company he drives for — a client. Null for an owner-driver. */
  autoparkId: Id | null
  /** Snapshotted, so renaming the company cannot blank the list. */
  autoparkName: string | null
  /**
   * The truck that autopark assigned him. Required once there is an autopark:
   * without it the owner's app has no truck to hang the purchase on, which is
   * the whole reason the company signed the contract.
   */
  autoparkTruckPlate: string | null

  comment: string | null
  status: DriverStatus
  createdAt: IsoDate
  updatedAt: IsoDate
}

/* --- capacities ---------------------------------------------------------- */

export const hasOwnTruck = (driver: Pick<Driver, 'ownTruckPlate'>) => driver.ownTruckPlate !== null

export const drivesForAutopark = (driver: Pick<Driver, 'autoparkId'>) => driver.autoparkId !== null

/** What this driver can buy as. Never empty — the form refuses a driver who is neither. */
export function capacitiesOf(
  driver: Pick<Driver, 'ownTruckPlate' | 'autoparkId'>,
): DriverCapacity[] {
  const capacities: DriverCapacity[] = []
  if (hasOwnTruck(driver)) capacities.push('own')
  if (drivesForAutopark(driver)) capacities.push('autopark')
  return capacities
}

/**
 * The truck a purchase in this capacity belongs to.
 *
 * One truck each way — his own, or the autopark's — so choosing the capacity
 * settles the truck and the seller is never asked to pick one.
 */
export function truckFor(
  driver: Pick<Driver, 'ownTruckPlate' | 'autoparkTruckPlate'>,
  capacity: DriverCapacity,
): string | null {
  return capacity === 'own' ? driver.ownTruckPlate : driver.autoparkTruckPlate
}

/**
 * The only capacity he has, when there is only one.
 *
 * Null when he has both, which is the single case where the counter has to
 * ask. Asking a driver with one capacity which of his one capacity he means
 * is the kind of question that makes people stop reading dialogs.
 */
export function soleCapacity(
  driver: Pick<Driver, 'ownTruckPlate' | 'autoparkId'>,
): DriverCapacity | null {
  const capacities = capacitiesOf(driver)
  return capacities.length === 1 ? (capacities[0] ?? null) : null
}

export type DriverKind = 'independent' | 'autopark' | 'both'

export function kindOf(driver: Pick<Driver, 'ownTruckPlate' | 'autoparkId'>): DriverKind {
  const capacities = capacitiesOf(driver)
  if (capacities.length === 2) return 'both'
  return capacities[0] === 'autopark' ? 'autopark' : 'independent'
}

export const KIND_LABEL: Record<DriverKind, string> = {
  independent: 'Owner-driver',
  autopark: 'Autopark',
  both: 'Both',
}

/** The two tabs the list is split into. */
export const DRIVER_SECTIONS: { value: 'independent' | 'autopark'; label: string }[] = [
  { value: 'independent', label: 'Owner-drivers' },
  { value: 'autopark', label: 'Autopark drivers' },
]

/**
 * The two sections the list splits into.
 *
 * A driver who is both belongs in **both** of them — he is a real customer
 * twice over, and hiding him from either list would hide half his purchases.
 * So the counts deliberately overlap, and the list says why with a badge.
 */
export function inSection(
  driver: Pick<Driver, 'ownTruckPlate' | 'autoparkId'>,
  section: 'independent' | 'autopark',
): boolean {
  return section === 'independent' ? hasOwnTruck(driver) : drivesForAutopark(driver)
}

/* --- validation ---------------------------------------------------------- */

export const driverSchema = z
  .object({
    fullName: z.string().min(2, 'A driver needs a name'),
    phone: z.string().nullable(),
    licenceNumber: z.string().nullable(),
    ownTruckPlate: z.string().nullable(),
    autoparkId: z.string().nullable(),
    autoparkTruckPlate: z.string().nullable(),
    comment: z.string().nullable(),
    status: z.enum(['active', 'inactive']),
  })
  // A driver with no truck of his own and no company cannot buy as anybody.
  .refine((draft) => draft.ownTruckPlate !== null || draft.autoparkId !== null, {
    message: 'Give him his own truck, an autopark, or both',
    path: ['ownTruckPlate'],
  })
  .refine((draft) => draft.autoparkId === null || draft.autoparkTruckPlate !== null, {
    message: 'Which of their trucks does he drive?',
    path: ['autoparkTruckPlate'],
  })

export type DriverDraft = z.infer<typeof driverSchema>

export const statusLabel = (status: DriverStatus) =>
  DRIVER_STATUSES.find((entry) => entry.value === status)?.label ?? status

/** "Trans Logistik · 01 A 123 AA" — who he buys for, and in what. */
export function describeCapacity(
  driver: Pick<Driver, 'autoparkName' | 'ownTruckPlate' | 'autoparkTruckPlate'>,
  capacity: DriverCapacity,
): string {
  return capacity === 'own'
    ? ['Himself', driver.ownTruckPlate].filter(Boolean).join(' · ')
    : [driver.autoparkName, driver.autoparkTruckPlate].filter(Boolean).join(' · ')
}
