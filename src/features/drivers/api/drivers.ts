import { useMemo } from 'react'
import { useDataStore } from '@/data/store'
import { matches } from '@/data/query'
import type { Driver, DriverDraft, DriverStatus } from '../model/driver'

export function useDrivers(filters: { search?: unknown; status?: unknown } = {}) {
  const drivers = useDataStore((s) => s.drivers)

  return useMemo(() => {
    const items = drivers
      .filter((driver) => {
        if (filters.status && driver.status !== filters.status) return false
        return matches(
          [driver.fullName, driver.phone, driver.clientName, driver.vehiclePlate],
          filters.search as string | undefined,
        )
      })
      .sort((a, b) => a.fullName.localeCompare(b.fullName))

    return { data: { items, total: items.length }, isLoading: false }
  }, [drivers, filters.status, filters.search])
}

export function useDriverCounts(): Record<string, number> {
  const drivers = useDataStore((s) => s.drivers)
  return useMemo(() => {
    const counts: Record<string, number> = { all: drivers.length }
    for (const status of ['active', 'inactive'] as DriverStatus[]) {
      counts[status] = drivers.filter((driver) => driver.status === status).length
    }
    return counts
  }, [drivers])
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

export type { Driver }
