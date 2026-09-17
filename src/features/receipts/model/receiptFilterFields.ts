import type { FieldOverrides } from '@/shared/lib/columnFilterFields'
import { PROCUREMENT_KINDS } from '@/shared/types/procurementSource'
import { useDataStore } from '@/data/store'
import { USD_RATE } from '@/data/seed'
import {
  landedTotal,
  receiptOrdered,
  receiptReceived,
  receiptSource,
  receiptStatusLabel,
  retailValue,
  soldThrough,
  supplierTotal,
  type GoodsReceipt,
} from './receipt'

/** Today's shelf, read when a filter runs — the sold-through and retail columns price against it. */
const variations = () => useDataStore.getState().variations
const stockAt = (variationId: string, locationId: string) =>
  variations()
    .find((v) => v.id === variationId)
    ?.stockByLocation.find((row) => row.locationId === locationId)?.quantity ?? 0
const salePriceOf = (variationId: string) =>
  variations().find((v) => v.id === variationId)?.salePrice ?? 0

/** The goods receipt list's search panel: its columns, worked-out figures given a getter. */
export const RECEIPT_FILTER_OVERRIDES: FieldOverrides<GoodsReceipt> = {
  quantity: {
    get: (r) => (r.status === 'draft' ? receiptOrdered(r) : receiptReceived(r)),
  },
  soldThrough: {
    unit: '%',
    get: (r) => (r.status === 'received' ? Math.round(soldThrough(r, stockAt).ratio * 100) : null),
  },
  status: {
    type: 'options',
    optionLabel: (value) => receiptStatusLabel(value as GoodsReceipt['status']),
  },
  kind: {
    type: 'options',
    optionLabel: (value) => PROCUREMENT_KINDS.find((k) => k.value === value)?.label ?? value,
  },
  supplierName: { type: 'options', get: receiptSource },
  landed: { get: (r) => landedTotal(r, USD_RATE) },
  retail: { get: (r) => retailValue(r, salePriceOf) },
  supplierTotal: { get: (r) => supplierTotal(r, USD_RATE) },
}
