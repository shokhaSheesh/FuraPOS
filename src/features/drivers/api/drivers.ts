import { useMemo } from 'react'
import { useDataStore } from '@/data/store'
import { matches } from '@/data/query'
import { inSection, type Driver, type DriverDraft, type DriverStatus } from '../model/driver'

export function useDrivers(
  filters: { search?: unknown; section?: unknown; status?: unknown } = {},
) {
  const drivers = useDataStore((s) => s.drivers)

  return useMemo(() => {
    const items = drivers
      .filter((driver) => {
        if (filters.status && driver.status !== filters.status) return false
        if (filters.section && !inSection(driver, filters.section as 'independent' | 'autopark')) {
          return false
        }
        // Plates are searched too: at the counter people know the truck
        // before they know the name.
        return matches(
          [
            driver.fullName,
            driver.code,
            driver.phone,
            driver.autoparkName,
            ...driver.ownTrucks.flatMap((truck) => [truck.plate, truck.make, truck.model]),
            driver.autoparkTruck?.plate ?? null,
            driver.autoparkTruck?.make ?? null,
            driver.autoparkTruck?.model ?? null,
          ],
          filters.search as string | undefined,
        )
      })
      .sort((a, b) => a.fullName.localeCompare(b.fullName))

    return { data: { items, total: items.length }, isLoading: false }
  }, [drivers, filters.section, filters.status, filters.search])
}

/**
 * Counts for the two tabs.
 *
 * These **deliberately overlap**: a driver who owns a truck and also drives
 * for an autopark is counted in both, because he buys in both capacities.
 * There is no total, because adding them would produce a number that means
 * nothing.
 */
export function useDriverCounts(): Record<'independent' | 'autopark', number> {
  const drivers = useDataStore((s) => s.drivers)
  return useMemo(
    () => ({
      independent: drivers.filter((driver) => inSection(driver, 'independent')).length,
      autopark: drivers.filter((driver) => inSection(driver, 'autopark')).length,
    }),
    [drivers],
  )
}

/** Active drivers only — the counter never sells to somebody who has left. */
export function useActiveDrivers(
  search: string,
  /** Narrow to one kind. The till picks the kind first, then the man. */
  section?: 'independent' | 'autopark',
) {
  const drivers = useDataStore((s) => s.drivers)
  return useMemo(
    () =>
      drivers
        .filter((driver) => driver.status === 'active')
        .filter((driver) => (section ? inSection(driver, section) : true))
        .filter((driver) =>
          matches(
            [
              driver.fullName,
              driver.code,
              driver.phone,
              driver.autoparkName,
              ...driver.ownTrucks.flatMap((truck) => [truck.plate, truck.make, truck.model]),
              driver.autoparkTruck?.plate ?? null,
              driver.autoparkTruck?.make ?? null,
              driver.autoparkTruck?.model ?? null,
            ],
            search,
          ),
        )
        .slice(0, 50),
    [drivers, search, section],
  )
}

export function useDriver(id: string | undefined) {
  const drivers = useDataStore((s) => s.drivers)
  return useMemo(
    () => ({ data: drivers.find((driver) => driver.id === id), isLoading: false }),
    [drivers, id],
  )
}

/** What he has collected, newest first. */
export function useDriverSales(id: string | undefined) {
  const sales = useDataStore((s) => s.sales)
  return useMemo(
    () =>
      id
        ? sales
            .filter((sale) => sale.driverId === id && sale.status !== 'deleted')
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        : [],
    [sales, id],
  )
}

export function useDriverActions() {
  const create = useDataStore((s) => s.createDriver)
  const update = useDataStore((s) => s.updateDriver)
  const remove = useDataStore((s) => s.deleteDriver)

  return useMemo(
    () => ({
      create: (input: DriverDraft) => create(input),
      update: (id: string, input: DriverDraft) => update(id, input),
      remove,
      isPending: false,
    }),
    [create, update, remove],
  )
}

export type { Driver, DriverStatus }
