import type { FieldOverrides } from '@/shared/lib/columnFilterFields'
import { PAYMENT_METHODS, SALE_CHANNELS, SALE_STATUSES, type Sale } from './sale'
import { t } from '@/shared/i18n'

const labelFrom =
  (list: readonly { value: string; label: string }[]) =>
  (value: string): string =>
    t(list.find((entry) => entry.value === value)?.label ?? value)

/**
 * The sales ledger's search panel: its columns, with the few whose value is
 * worked out or whose raw value is a code given a getter or a name.
 */
export const SALE_FILTER_OVERRIDES: FieldOverrides<Sale> = {
  status: { type: 'options', optionLabel: labelFrom(SALE_STATUSES) },
  channel: { type: 'options', optionLabel: labelFrom(SALE_CHANNELS) },
  paymentMethod: { type: 'options', optionLabel: labelFrom(PAYMENT_METHODS) },
  items: { get: (sale) => sale.lines.reduce((sum, line) => sum + line.quantity, 0) },
}
