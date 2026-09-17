import type { FieldOverrides } from '@/shared/lib/columnFilterFields'
import {
  DELIVERY_LABEL,
  PAYMENT_STATUS_META,
  onlineStatusMeta,
  orderTotal,
  unitsOf,
  type OnlineSale,
} from './onlineSale'

/** The online sales list's search panel: its columns, worked-out figures given a getter. */
export const ONLINE_SALE_FILTER_OVERRIDES: FieldOverrides<OnlineSale> = {
  items: { get: unitsOf },
  total: { get: orderTotal },
  payment: {
    type: 'options',
    get: (s) => s.paymentStatus,
    optionLabel: (value) =>
      PAYMENT_STATUS_META[value as OnlineSale['paymentStatus']]?.label ?? value,
  },
  delivery: {
    type: 'options',
    get: (s) => s.deliveryMethod,
    optionLabel: (value) => DELIVERY_LABEL[value as OnlineSale['deliveryMethod']] ?? value,
  },
  status: {
    type: 'options',
    optionLabel: (value) => onlineStatusMeta(value as OnlineSale['status']).label,
  },
  // Not a column, but the date every other sales list filters by.
  createdAt: { label: 'Placed', type: 'date', get: (s) => s.createdAt },
}
