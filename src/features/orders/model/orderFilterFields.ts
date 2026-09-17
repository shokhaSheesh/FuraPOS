import type { FieldOverrides } from '@/shared/lib/columnFilterFields'
import { USD_RATE } from '@/data/seed'
import {
  daysLate,
  deliveredRatio,
  orderSource,
  orderStatusLabel,
  orderValue,
  outstandingUnits,
  type PurchaseOrder,
} from './order'

/** The orders list's search panel: its columns, worked-out figures given a getter. */
export const ORDER_FILTER_OVERRIDES: FieldOverrides<PurchaseOrder> = {
  supplierName: { type: 'options', get: orderSource },
  expected: { type: 'date', get: (o) => o.expectedAt },
  // How late, in days, so "late by more than a week" is one filter.
  late: { label: 'Days late', get: (o) => daysLate(o) },
  delivered: { unit: '%', get: (o) => Math.round(deliveredRatio(o) * 100) },
  outstanding: { get: outstandingUnits },
  value: { get: (o) => Math.round(orderValue(o, USD_RATE)) },
  status: {
    type: 'options',
    optionLabel: (value) => orderStatusLabel(value as PurchaseOrder['status']),
  },
}
