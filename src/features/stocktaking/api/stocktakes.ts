import { useMemo } from 'react'
import { useDataStore, type StartStocktakeInput } from '@/data/store'
import { matches, paginate } from '@/data/query'
import { USD_RATE } from '@/data/seed'
import type { ListQuery } from '@/shared/types'
import {
  accuracy,
  netCostValue,
  shortUnits,
  surplusUnits,
  type Stocktake,
} from '../model/stocktake'

function filterStocktakes(all: Stocktake[], query: ListQuery) {
  return all.filter((stocktake) => {
    if (query.status && stocktake.status !== query.status) return false
    if (query.location && stocktake.locationId !== query.location) return false
    return matches(
      [
        stocktake.number,
        stocktake.locationName,
        stocktake.categoryName,
        stocktake.comment,
        stocktake.createdBy,
      ],
      query.search,
    )
  })
}

export function useStocktakes(query: ListQuery) {
  const stocktakes = useDataStore((s) => s.stocktakes)
  const data = useMemo(() => {
    const filtered = filterStocktakes(stocktakes, query)
    const ordered = query.sort
      ? filtered
      : [...filtered].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return paginate(ordered, query)
  }, [stocktakes, query])
  return { data, isLoading: false }
}

export function useStocktake(id: string) {
  const stocktake = useDataStore((s) => s.stocktakes.find((s2) => s2.id === id))
  return { data: stocktake, isLoading: false, isError: !stocktake }
}

export interface StocktakeSummary {
  open: number
  accuracy: number
  shortUnits: number
  surplusUnits: number
  netValue: number
}

/**
 * Accuracy is the headline, not the loss. A warehouse that finds a small
 * discrepancy every month is working; one whose counts agree 80% of the time
 * cannot trust any figure on any other screen, however small the money looks.
 */
export function useStocktakeSummary(query: ListQuery) {
  const stocktakes = useDataStore((s) => s.stocktakes)
  return useMemo<StocktakeSummary>(() => {
    const scoped = filterStocktakes(stocktakes, { ...query, status: undefined })
    const applied = scoped.filter((s) => s.status === 'applied')
    const allLines = { lines: applied.flatMap((s) => s.lines) }
    return {
      open: scoped.filter((s) => s.status === 'counting').length,
      accuracy: accuracy(allLines),
      shortUnits: shortUnits(allLines),
      surplusUnits: surplusUnits(allLines),
      netValue: netCostValue(allLines, USD_RATE),
    }
  }, [stocktakes, query])
}

export function useStocktakeStatusCounts(query: ListQuery) {
  const stocktakes = useDataStore((s) => s.stocktakes)
  const data = useMemo(() => {
    const scoped = filterStocktakes(stocktakes, { ...query, status: undefined })
    const counts: Record<string, number> = { all: scoped.length }
    for (const stocktake of scoped) counts[stocktake.status] = (counts[stocktake.status] ?? 0) + 1
    return counts
  }, [stocktakes, query])
  return { data, isLoading: false }
}

/* --- writes -------------------------------------------------------------- */

export function useStartStocktake() {
  const start = useDataStore((s) => s.startStocktake)
  return {
    isPending: false,
    mutate: (input: StartStocktakeInput, opts?: { onSuccess?: (s: Stocktake) => void }) => {
      opts?.onSuccess?.(start(input))
    },
  }
}

export function useStocktakeActions(id: string) {
  const setCount = useDataStore((s) => s.setStocktakeCount)
  const apply = useDataStore((s) => s.applyStocktake)
  const cancel = useDataStore((s) => s.cancelStocktake)
  return {
    setCount: (lineId: string, counted: number | null) => setCount(id, lineId, counted),
    apply: (opts?: {
      onSuccess?: (correctionId: string) => void
      onError?: (m: string) => void
    }) => {
      const result = apply(id)
      if (result.ok) opts?.onSuccess?.(result.correctionId)
      else opts?.onError?.(result.error)
    },
    cancel: (opts?: { onSuccess?: () => void; onError?: (m: string) => void }) => {
      const result = cancel(id)
      if (result.ok) opts?.onSuccess?.()
      else opts?.onError?.(result.error)
    },
  }
}
