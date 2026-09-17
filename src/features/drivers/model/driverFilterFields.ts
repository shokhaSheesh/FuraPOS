import type { FieldOverrides } from '@/shared/lib/columnFilterFields'
import type { Driver } from './driver'

/** Every truck a driver is known by, whichever capacity he drives it in. */
const trucks = (d: Driver) => [...d.ownTrucks, ...(d.autoparkTruck ? [d.autoparkTruck] : [])]

/** The drivers list's search panel: its columns, the truck columns read across every truck. */
export const DRIVER_FILTER_OVERRIDES: FieldOverrides<Driver> = {
  fullName: { type: 'text' },
  autopark: { type: 'options', get: (d) => d.autoparkName },
  trucks: { label: 'Plate', type: 'text', get: (d) => trucks(d).map((t) => t.plate) },
  make: { type: 'options', get: (d) => trucks(d).map((t) => t.make) },
  model: { type: 'options', get: (d) => trucks(d).map((t) => t.model) },
  status: {
    type: 'options',
    optionLabel: (value) => (value === 'active' ? 'Driving' : 'No longer driving'),
  },
  phone: { label: 'Phone', type: 'text', get: (d) => d.phone },
  code: { label: 'Code', type: 'text', get: (d) => d.code },
}
