import type { FieldOverrides } from '@/shared/lib/columnFilterFields'
import type { ShiftRow } from '../api/shifts'

/** The cash shifts list's search panel: its columns, worked-out figures given a getter. */
export const SHIFT_FILTER_OVERRIDES: FieldOverrides<ShiftRow> = {
  number: { type: 'text' },
  sales: { label: 'Cash sales', get: (s) => s.totals.cash },
  expected: { get: (s) => s.expected },
  counted: { get: (s) => s.countedCash },
  variance: { get: (s) => s.difference },
  status: {
    type: 'options',
    optionLabel: (value) => (value === 'open' ? 'Open' : 'Closed'),
  },
  registerName: { label: 'Register', get: (s) => s.registerName },
  locationName: { label: 'Location', type: 'options', get: (s) => s.locationName },
}
