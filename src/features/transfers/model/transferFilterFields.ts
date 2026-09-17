import type { FieldOverrides } from '@/shared/lib/columnFilterFields'
import { USD_RATE } from '@/data/seed'
import { useDataStore } from '@/data/store'
import {
  transferCostValue,
  transferInTransit,
  transferReceived,
  transferRequested,
  transferSaleValue,
  transferSent,
  transferSoldThrough,
  transferStatusLabel,
  type Transfer,
  type TransferStatus,
} from './transfer'

/**
 * The transfers list's search panel: its columns, with worked-out figures given
 * a getter. Two columns share a heading with a date ("Sent", "Received"), so
 * the panel names each by what it holds.
 */
export const TRANSFER_FILTER_OVERRIDES: FieldOverrides<Transfer> = {
  route: {
    type: 'options',
    get: (t) => [t.fromLocationName, t.toLocationName],
  },
  items: { get: (t) => t.lines.length },
  requested: { get: transferRequested },
  sent: { label: 'Units sent', get: (t) => (t.status === 'draft' ? null : transferSent(t)) },
  received: {
    label: 'Units received',
    get: (t) => (t.receivedAt === null ? null : transferReceived(t)),
  },
  inTransit: { get: transferInTransit },
  // Sales are read when the filter runs, as the goods receipt list does with its shelf.
  sold: {
    unit: '%',
    get: (t) =>
      t.status === 'received'
        ? Math.round(transferSoldThrough(t, useDataStore.getState().sales).ratio * 100)
        : null,
  },
  status: {
    type: 'options',
    optionLabel: (value) => transferStatusLabel(value as TransferStatus),
  },
  sentAt: { label: 'Sent on', type: 'date' },
  receivedAt: { label: 'Received on', type: 'date' },
  costValue: { get: (t) => transferCostValue(t, USD_RATE) },
  saleValue: { get: transferSaleValue },
}
