import type { FieldOverrides } from '@/shared/lib/columnFilterFields'
import { logKindLabel, type StockLogEntry, type StockLogKind } from './log'

/** The product log's search panel: its columns, with the document split into kind and number. */
export const LOG_FILTER_OVERRIDES: FieldOverrides<StockLogEntry> = {
  name: { type: 'text' },
  sku: { label: 'SKU', type: 'text', get: (e) => e.sku },
  locationName: { type: 'options' },
  delta: { label: 'Change', type: 'range', get: (e) => e.delta },
  document: {
    type: 'options',
    get: (e) => e.kind,
    optionLabel: (value) => logKindLabel(value as StockLogKind),
  },
  documentNumber: { label: 'Document number', type: 'text', get: (e) => e.documentNumber },
  reason: { type: 'options' },
  by: { type: 'options' },
  at: { type: 'date' },
}
