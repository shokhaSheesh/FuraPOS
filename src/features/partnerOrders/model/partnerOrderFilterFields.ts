import type { FieldOverrides } from '@/shared/lib/columnFilterFields'
import { USD_RATE } from '@/data/seed'
import {
  orderValue,
  orderedUnits,
  outstandingUnits,
  partnerStatusLabel,
  shippedRatio,
  type PartnerOrder,
} from './partnerOrder'

/** The partner orders list's search panel: its columns, worked-out figures given a getter. */
export const PARTNER_ORDER_FILTER_OVERRIDES: FieldOverrides<PartnerOrder> = {
  status: {
    type: 'options',
    optionLabel: (value) => partnerStatusLabel(value as PartnerOrder['status']),
  },
  ordered: { get: orderedUnits },
  shipped: { unit: '%', get: (o) => Math.round(shippedRatio(o) * 100) },
  outstanding: { get: (o) => (o.status === 'cancelled' ? null : outstandingUnits(o)) },
  value: { get: (o) => Math.round(orderValue(o, USD_RATE)) },
  wantedBy: { type: 'date' },
}
