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
 * A truck.
 *
 * The make and model are not decoration in a parts business: they are what
 * decides which part fits. A counter hand who can see "MAN TGX" beside the
 * plate is answering half the question before it is asked.
 */
export interface Truck {
  plate: string
  make: string | null
  model: string | null
}

/** "MAN TGX 18.440", or just the make, or nothing worth printing. */
export const describeTruck = (truck: Pick<Truck, 'make' | 'model'>) =>
  [truck.make, truck.model].filter(Boolean).join(' ')

/**
 * Who a purchase is for.
 *
 * A driver can own trucks *and* drive for an autopark, and the two are
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

  /**
   * The trucks he owns. Several is normal — an owner-driver who does well
   * buys a second lorry and puts a nephew in it.
   */
  ownTrucks: Truck[]

  /** The haulage company he drives for — a client. Null for an owner-driver. */
  autoparkId: Id | null
  /** Snapshotted, so renaming the company cannot blank the list. */
  autoparkName: string | null
  /**
   * The one truck that autopark assigned him. Required once there is an
   * autopark: without it the owner's app has no truck to hang the purchase
   * on, which is the whole reason the company signed the contract.
   */
  autoparkTruck: Truck | null

  comment: string | null
  status: DriverStatus
  createdAt: IsoDate
  updatedAt: IsoDate
}

/* --- capacities ---------------------------------------------------------- */

export const hasOwnTruck = (driver: Pick<Driver, 'ownTrucks'>) => driver.ownTrucks.length > 0

export const drivesForAutopark = (driver: Pick<Driver, 'autoparkId'>) => driver.autoparkId !== null

/** What this driver can buy as. Never empty — the form refuses a driver who is neither. */
export function capacitiesOf(driver: Pick<Driver, 'ownTrucks' | 'autoparkId'>): DriverCapacity[] {
  const capacities: DriverCapacity[] = []
  if (hasOwnTruck(driver)) capacities.push('own')
  if (drivesForAutopark(driver)) capacities.push('autopark')
  return capacities
}

/**
 * The trucks a purchase in this capacity could belong to.
 *
 * Kept strictly separate: his own trucks are his, the autopark's truck is
 * theirs, and neither list ever shows the other. A purchase attributed to the
 * wrong side would put a part on a stranger's truck in the owner's app.
 */
export function trucksFor(
  driver: Pick<Driver, 'ownTrucks' | 'autoparkTruck'>,
  capacity: DriverCapacity,
): Truck[] {
  if (capacity === 'own') return driver.ownTrucks
  return driver.autoparkTruck ? [driver.autoparkTruck] : []
}

/**
 * The truck, when there is only one it could be.
 *
 * Null when he owns several and the counter has to ask which he came in.
 * An autopark capacity is always one truck, so it never asks.
 */
export function soleTruckFor(
  driver: Pick<Driver, 'ownTrucks' | 'autoparkTruck'>,
  capacity: DriverCapacity,
): Truck | null {
  const trucks = trucksFor(driver, capacity)
  return trucks.length === 1 ? (trucks[0] ?? null) : null
}

/**
 * The only capacity he has, when there is only one.
 *
 * Null when he has both, which is the single case where the counter has to
 * ask. Asking a driver with one capacity which of his one capacity he means
 * is the kind of question that makes people stop reading dialogs.
 */
export function soleCapacity(
  driver: Pick<Driver, 'ownTrucks' | 'autoparkId'>,
): DriverCapacity | null {
  const capacities = capacitiesOf(driver)
  return capacities.length === 1 ? (capacities[0] ?? null) : null
}

export type DriverKind = 'independent' | 'autopark' | 'both'

export function kindOf(driver: Pick<Driver, 'ownTrucks' | 'autoparkId'>): DriverKind {
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
 * Each tab then shows only the trucks belonging to that side of him.
 */
export function inSection(
  driver: Pick<Driver, 'ownTrucks' | 'autoparkId'>,
  section: 'independent' | 'autopark',
): boolean {
  return section === 'independent' ? hasOwnTruck(driver) : drivesForAutopark(driver)
}

/** The capacity a section corresponds to — what the list should show there. */
export const capacityOfSection = (section: 'independent' | 'autopark'): DriverCapacity =>
  section === 'independent' ? 'own' : 'autopark'

/* --- validation ---------------------------------------------------------- */

export const truckSchema = z.object({
  plate: z.string().min(1, 'A truck needs a number plate'),
  make: z.string().nullable(),
  model: z.string().nullable(),
})

export const driverSchema = z
  .object({
    fullName: z.string().min(2, 'A driver needs a name'),
    phone: z.string().nullable(),
    ownTrucks: z.array(truckSchema),
    autoparkId: z.string().nullable(),
    autoparkTruck: truckSchema.nullable(),
    comment: z.string().nullable(),
    status: z.enum(['active', 'inactive']),
  })
  // A driver with no truck of his own and no company cannot buy as anybody.
  .refine((draft) => draft.ownTrucks.length > 0 || draft.autoparkId !== null, {
    message: 'Give him a truck of his own, an autopark, or both',
    path: ['ownTrucks'],
  })
  .refine((draft) => draft.autoparkId === null || draft.autoparkTruck !== null, {
    message: 'Which of their trucks does he drive?',
    path: ['autoparkTruck'],
  })

export type DriverDraft = z.infer<typeof driverSchema>

export const statusLabel = (status: DriverStatus) =>
  DRIVER_STATUSES.find((entry) => entry.value === status)?.label ?? status

/**
 * How the capacity reads on the "Buying for" choice.
 *
 * The plate is named only when there is one of it; with several, the truck is
 * a separate question and promising one here would be a lie.
 */
export function describeCapacity(
  driver: Pick<Driver, 'autoparkName' | 'ownTrucks' | 'autoparkTruck'>,
  capacity: DriverCapacity,
): string {
  if (capacity === 'own') {
    const only = soleTruckFor(driver, 'own')
    return only ? `Himself · ${only.plate}` : 'Himself'
  }
  return [driver.autoparkName, driver.autoparkTruck?.plate].filter(Boolean).join(' · ')
}
