import { useMemo } from 'react'
import { useDataStore } from '@/data/store'
import {
  DEFAULT_SETTINGS,
  buildReorderLines,
  type ReorderFilters,
  type ReorderSettings,
} from '../model/reorder'

/**
 * Turns the whole catalogue into a buying list.
 *
 * Everything here is derived on read. There is no stored "suggestion", because
 * a suggestion is only true for as long as the stock and the sales behind it
 * are — one sale later and yesterday's answer is wrong. What a schedule *does*
 * store is the draft order a run produced, which is a decision rather than a
 * calculation.
 */
export function useReorderLines(settings: ReorderSettings, filters: ReorderFilters) {
  const variations = useDataStore((s) => s.variations)
  const sales = useDataStore((s) => s.sales)
  const receipts = useDataStore((s) => s.receipts)

  return useMemo(
    () => buildReorderLines({ variations, sales, receipts }, settings, filters),
    [variations, sales, receipts, settings, filters],
  )
}

export { DEFAULT_SETTINGS }
