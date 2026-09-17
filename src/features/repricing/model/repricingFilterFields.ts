import type { FieldOverrides } from '@/shared/lib/columnFilterFields'
import {
  averageChange,
  belowCost,
  changedLines,
  loweredCount,
  raisedCount,
  repricingStatusLabel,
  scopeSentence,
  type Repricing,
} from './repricing'

/**
 * The repricing list's search panel: its columns, worked-out figures given a
 * getter. "Up / down" is two numbers in one cell, so it is two fields here.
 */
export const REPRICING_FILTER_OVERRIDES: FieldOverrides<Repricing> = {
  // A sentence written from the rule — its parts are what to filter by, and
  // those are the columns around it.
  rule: { skip: true },
  scope: { type: 'options', get: scopeSentence },
  products: { get: (r) => changedLines(r).length },
  direction: { label: 'Prices raised', get: raisedCount },
  lowered: { label: 'Prices lowered', get: loweredCount },
  average: { unit: '%', get: (r) => Math.round(averageChange(r) * 1000) / 10 },
  risky: { get: (r) => belowCost(r).length },
  status: {
    type: 'options',
    optionLabel: (value) => repricingStatusLabel(value as Repricing['status']),
  },
}
