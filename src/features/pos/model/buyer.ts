import type { Client } from '@/features/sales/api/sales'
import type { Driver, DriverCapacity, Truck } from '@/features/drivers/model/driver'

/**
 * Who is buying, settled in two steps (client request):
 *
 *   1. find the driver — owner-drivers and autopark drivers in one search;
 *   2. pick the truck.
 *
 * The truck is what decides whose purchase it is. A driver who owns a lorry
 * *and* drives for an autopark is offered both kinds of truck, and choosing the
 * autopark's puts the sale on the autopark's account — which is also what
 * makes its contract discount apply. With only one truck to choose from, it is
 * chosen for him.
 */

/** Who was found in step 1. Null is a walk-in. */
export type Party = { kind: 'driver'; driver: Driver } | null

/** A truck on offer in step 2, and whose it is. */
export interface TruckOption {
  truck: Truck
  capacity: DriverCapacity
  /** The autopark it belongs to, for an autopark truck. */
  autoparkId: string | null
  autoparkName: string | null
}

/** Everything a sale needs to know about its buyer. */
export interface TillBuyer {
  party: Party
  /** Whose account the sale lands on. Null: a walk-in, or a driver buying for himself. */
  client: Client | null
  /** Who collected the parts. */
  driver: Driver | null
  truck: TruckOption | null
  /** How many trucks there are to choose from. */
  truckChoices: number
}

export const WALK_IN: TillBuyer = {
  party: null,
  client: null,
  driver: null,
  truck: null,
  truckChoices: 0,
}

/** A driver's trucks: his own first, then the one his autopark assigned him. */
export function trucksOfDriver(driver: Driver): TruckOption[] {
  const own = driver.ownTrucks.map((truck): TruckOption => ({
    truck,
    capacity: 'own',
    autoparkId: null,
    autoparkName: null,
  }))
  const fleet: TruckOption[] = driver.autoparkTruck
    ? [
        {
          truck: driver.autoparkTruck,
          capacity: 'autopark',
          autoparkId: driver.autoparkId,
          autoparkName: driver.autoparkName,
        },
      ]
    : []
  return [...own, ...fleet]
}

/** The trucks step 2 offers for the driver found in step 1. */
export function trucksOf(party: Party): TruckOption[] {
  return party ? trucksOfDriver(party.driver) : []
}

/**
 * The buyer, once the party and (maybe) the truck are known. A single truck
 * is taken without asking; an autopark truck puts the sale on the autopark.
 */
export function resolveBuyer(
  party: Party,
  chosen: TruckOption | null,
  clients: Client[],
): TillBuyer {
  if (!party) return WALK_IN
  const options = trucksOf(party)
  const truck = chosen ?? (options.length === 1 ? options[0]! : null)

  const autopark =
    truck?.capacity === 'autopark'
      ? (clients.find((client) => client.id === truck.autoparkId) ?? null)
      : null
  return { party, client: autopark, driver: party.driver, truck, truckChoices: options.length }
}

/**
 * A driver with several trucks has to say which one before paying: the
 * purchase lands on a truck's history, and on an account the truck decides.
 */
export const needsTruck = (buyer: TillBuyer) =>
  buyer.party !== null && buyer.truckChoices > 1 && buyer.truck === null
