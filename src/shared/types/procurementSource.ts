import { t } from '@/shared/i18n'
/**
 * Where bought goods come from.
 *
 * Shared, because a purchase order and a goods receipt ask the same question
 * and must answer it the same way: an order placed with the bazaar has to
 * arrive as a receipt from the bazaar, or the two halves of the same purchase
 * describe different transactions.
 *
 *   - **supplier** — a company we trade with and hold an account for. There is
 *     a record to pick, and a debt to build against it.
 *   - **market** — bought off the bazaar, from nobody we have an account with.
 *     There is no supplier record to point at, so who it was is free text, and
 *     no debt is carried: a market purchase is paid on the spot.
 *   - **china** — made to order by a factory in China. Also has no supplier
 *     record here; the factory is named in free text.
 */
export type ProcurementKind = 'supplier' | 'market' | 'china'

export const PROCUREMENT_KINDS: { value: ProcurementKind; label: string; hint: string }[] = [
  {
    value: 'supplier',
    label: 'From a supplier',
    hint: 'A company we hold an account with',
  },
  {
    value: 'market',
    label: 'From the market',
    hint: 'Bought at the bazaar, from nobody we have an account with',
  },
  {
    value: 'china',
    label: 'From China',
    hint: 'Made to order by a factory',
  },
]

/** True when the kind has a supplier record to point at, rather than free text. */
export const hasSupplierRecord = (kind: ProcurementKind) => kind === 'supplier'

/** What to call the free-text field for a kind that has no supplier record. */
export const boughtFromLabel = (kind: ProcurementKind) =>
  kind === 'market' ? t('Bought from') : t('Factory')

export const boughtFromPlaceholder = (kind: ProcurementKind) =>
  kind === 'market' ? 'Jomiy bozori, row 4' : 'Guangzhou Auto Parts Co.'

/** Who the purchase is with, in one phrase, whichever kind it is. */
export const procurementSource = ({
  kind,
  supplierName,
  boughtFrom,
}: {
  kind: ProcurementKind
  supplierName: string | null
  boughtFrom: string | null
}) =>
  kind === 'market'
    ? boughtFrom
      ? `Market · ${boughtFrom}`
      : 'Market'
    : kind === 'china'
      ? boughtFrom
        ? `China · ${boughtFrom}`
        : 'China'
      : (supplierName ?? '—')
