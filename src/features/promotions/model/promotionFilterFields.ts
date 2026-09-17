import type { FieldOverrides } from '@/shared/lib/columnFilterFields'
import type { PromotionRow } from '../api/promotions'
import { promotionStatusLabel, type PromotionStatus } from './promotion'

/** The promotions list's search panel: its columns, worked-out figures given a getter. */
export const PROMOTION_FILTER_OVERRIDES: FieldOverrides<PromotionRow> = {
  name: { type: 'text' },
  status: {
    type: 'options',
    optionLabel: (value) => promotionStatusLabel(value as PromotionStatus),
  },
  runs: { label: 'Starts', type: 'date', get: (p) => p.startsAt },
  endsAt: { label: 'Ends', type: 'date', get: (p) => p.endsAt },
  daysLeft: { label: 'Days left', type: 'range', get: (p) => p.daysLeft },
  applies: {
    type: 'options',
    get: (p) => (p.scope === 'all' ? ['Everything'] : p.scopeNames),
  },
  audience: {
    type: 'options',
    get: (p) => (p.audience === 'everyone' ? ['Everyone'] : [...p.clientNames, ...p.driverNames]),
  },
  minimum: { get: (p) => p.minimumSale },
}
