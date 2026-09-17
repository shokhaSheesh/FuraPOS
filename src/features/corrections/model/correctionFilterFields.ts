import type { FieldOverrides } from '@/shared/lib/columnFilterFields'
import { USD_RATE } from '@/data/seed'
import {
  correctionReasonLabel,
  correctionStatusLabel,
  netCostValue,
  netUnits,
  writtenOff,
  writtenOn,
  type Correction,
} from './correction'

/** The corrections list's search panel: its columns, worked-out figures given a getter. */
export const CORRECTION_FILTER_OVERRIDES: FieldOverrides<Correction> = {
  reason: {
    type: 'options',
    optionLabel: (value) => correctionReasonLabel(value as Correction['reason']),
  },
  items: { get: (c) => c.lines.length },
  net: { get: netUnits },
  writtenOff: { get: writtenOff },
  writtenOn: { get: writtenOn },
  value: { get: (c) => netCostValue(c, USD_RATE) },
  status: {
    type: 'options',
    optionLabel: (value) => correctionStatusLabel(value as Correction['status']),
  },
}
