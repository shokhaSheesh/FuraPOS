import type { FieldOverrides } from '@/shared/lib/columnFilterFields'
import type { ClientRow } from '../api/clients'
import { clientStatusLabel, type ClientStatus } from './client'

/** The clients list's search panel: its columns, worked-out figures given a getter. */
export const CLIENT_FILTER_OVERRIDES: FieldOverrides<ClientRow> = {
  name: { type: 'text' },
  debt: { get: (c) => c.debt },
  creditLimit: { get: (c) => c.creditLimit },
  bought: { label: 'Bought (UZS)', get: (c) => Math.round(c.stats.revenue) },
  sales: { label: 'Number of sales', get: (c) => c.stats.sales },
  lastSale: { type: 'date', get: (c) => c.stats.lastSaleAt },
  cashback: { get: (c) => c.cashback },
  status: {
    type: 'options',
    optionLabel: (value) => clientStatusLabel(value as ClientStatus),
  },
  phone: { label: 'Phone', type: 'text', get: (c) => c.phone },
}
