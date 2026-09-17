import type { FieldOverrides } from '@/shared/lib/columnFilterFields'
import { USD_RATE } from '@/data/seed'
import {
  accuracy,
  discrepancies,
  netCostValue,
  progress,
  scopeType,
  shortUnits,
  stocktakeStatusLabel,
  surplusUnits,
  type Stocktake,
} from './stocktake'

/** The stocktaking list's search panel: its columns, worked-out figures given a getter. */
export const STOCKTAKE_FILTER_OVERRIDES: FieldOverrides<Stocktake> = {
  scopeType: { type: 'options', get: scopeType },
  progress: { label: 'Lines counted', get: (s) => progress(s).done },
  // As a percentage, the way the column reads it.
  accuracy: {
    unit: '%',
    get: (s) => (progress(s).done === 0 ? null : Math.round(accuracy(s) * 100)),
  },
  differs: { get: (s) => discrepancies(s).length },
  missing: { get: shortUnits },
  found: { get: surplusUnits },
  value: { get: (s) => netCostValue(s, USD_RATE) },
  status: {
    type: 'options',
    optionLabel: (value) => stocktakeStatusLabel(value as Stocktake['status']),
  },
}
