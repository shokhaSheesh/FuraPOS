import type { Id, IsoDate } from '@/shared/types'

/**
 * Every change to a stock number, one row each.
 *
 * This is the screen someone opens when a number is wrong: it answers "what
 * happened to this part, in what order, and who did it". That is a different
 * question from the Stock movement report, which answers "how much moved" —
 * one is an audit trail of events, the other is arithmetic over them, and
 * collapsing them into one screen serves neither.
 *
 * Nothing here is stored. A log entry is derived from the documents that
 * already exist, because a separate log table is a second version of the truth
 * that can disagree with the first.
 */
export type StockLogKind =
  'receipt' | 'transfer_in' | 'transfer_out' | 'correction' | 'stocktake' | 'sale'

export const STOCK_LOG_KINDS: {
  value: StockLogKind
  label: string
  /** Which way it normally goes, for the filter chips to read sensibly. */
  direction: 'in' | 'out' | 'both'
}[] = [
  { value: 'receipt', label: 'Goods receipt', direction: 'in' },
  { value: 'transfer_in', label: 'Transfer in', direction: 'in' },
  { value: 'transfer_out', label: 'Transfer out', direction: 'out' },
  { value: 'correction', label: 'Correction', direction: 'both' },
  { value: 'stocktake', label: 'Stocktake', direction: 'both' },
  { value: 'sale', label: 'Sale', direction: 'out' },
]

export const logKindLabel = (kind: StockLogKind) =>
  STOCK_LOG_KINDS.find((entry) => entry.value === kind)?.label ?? kind

export interface StockLogEntry {
  id: string
  at: IsoDate
  kind: StockLogKind

  variationId: Id
  productId: Id
  sku: string
  name: string
  imageUrl: string | null

  locationId: Id
  locationName: string

  /** Signed: negative took stock away. */
  delta: number
  /**
   * What the shelf held after this entry.
   *
   * Derived by replaying every movement, not stored — see `buildStockLog`.
   * Null when it cannot be worked out honestly.
   */
  balanceAfter: number | null

  /** The document that caused it, so the row can be clicked through. */
  documentId: Id
  documentNumber: string
  /**
   * Why, when the document says. Corrections carry a real reason; for
   * everything else the document type *is* the reason, so this stays null
   * rather than repeating it.
   */
  reason: string | null
  by: string
}

/**
 * Newest first — a log is read from the top.
 *
 * The id breaks ties, and it has to: several lines of one document share a
 * timestamp to the millisecond, and without a tiebreaker the display order and
 * the order the running balance was computed in can disagree, which shows the
 * wrong balance against the top row.
 */
export const byNewest = (a: StockLogEntry, b: StockLogEntry) =>
  b.at.localeCompare(a.at) || b.id.localeCompare(a.id)

/** The exact reverse, used to replay a shelf's history. */
export const byOldest = (a: StockLogEntry, b: StockLogEntry) =>
  a.at.localeCompare(b.at) || a.id.localeCompare(b.id)
