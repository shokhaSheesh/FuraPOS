import { useMemo } from 'react'
import { useDataStore, type CreateCorrectionInput } from '@/data/store'
import { matches, paginate } from '@/data/query'
import { USD_RATE } from '@/data/seed'
import type { ListQuery } from '@/shared/types'
import { netCostValue, writtenOff, writtenOn, type Correction } from '../model/correction'

function filterCorrections(all: Correction[], query: ListQuery) {
  return all.filter((correction) => {
    if (query.status && correction.status !== query.status) return false
    if (query.location && correction.locationId !== query.location) return false
    if (query.reason && correction.reason !== query.reason) return false
    // "Which way did it go" is the question this list is usually opened with,
    // so direction is a filter in its own right rather than a reason lookup.
    if (query.direction === 'off' && writtenOff(correction) === 0) return false
    if (query.direction === 'on' && writtenOn(correction) === 0) return false
    return matches(
      [
        correction.number,
        correction.locationName,
        correction.comment,
        correction.createdBy,
        ...correction.lines.map((line) => line.sku),
        ...correction.lines.map((line) => line.name),
      ],
      query.search,
    )
  })
}

export function useCorrections(query: ListQuery) {
  const corrections = useDataStore((s) => s.corrections)
  const data = useMemo(() => {
    const filtered = filterCorrections(corrections, query)
    const ordered = query.sort
      ? filtered
      : [...filtered].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return paginate(ordered, query)
  }, [corrections, query])
  return { data, isLoading: false }
}

export function useCorrection(id: string) {
  const correction = useDataStore((s) => s.corrections.find((c) => c.id === id))
  return { data: correction, isLoading: false, isError: !correction }
}

export interface CorrectionSummary {
  offUnits: number
  offValue: number
  onUnits: number
  onValue: number
  netValue: number
}

/**
 * Answers the question the page exists for: how much stock is leaking, and
 * what is it worth. Cancelled corrections are excluded — they had their effect
 * reversed, so counting them would overstate the loss.
 */
export function useCorrectionSummary(query: ListQuery) {
  const corrections = useDataStore((s) => s.corrections)
  return useMemo<CorrectionSummary>(() => {
    const scoped = filterCorrections(corrections, { ...query, status: undefined }).filter(
      (correction) => correction.status === 'applied',
    )
    const value = (c: Correction, sign: 1 | -1) =>
      c.lines.reduce((sum, line) => {
        const delta = line.countedAfter - line.countedBefore
        if (Math.sign(delta) !== sign) return sum
        const unit = line.costCurrency === 'USD' ? line.unitCost * USD_RATE : line.unitCost
        return sum + Math.abs(delta) * unit
      }, 0)

    return {
      offUnits: scoped.reduce((sum, c) => sum + writtenOff(c), 0),
      offValue: scoped.reduce((sum, c) => sum + value(c, -1), 0),
      onUnits: scoped.reduce((sum, c) => sum + writtenOn(c), 0),
      onValue: scoped.reduce((sum, c) => sum + value(c, 1), 0),
      netValue: scoped.reduce((sum, c) => sum + netCostValue(c, USD_RATE), 0),
    }
  }, [corrections, query])
}

export function useCorrectionStatusCounts(query: ListQuery) {
  const corrections = useDataStore((s) => s.corrections)
  const data = useMemo(() => {
    const scoped = filterCorrections(corrections, { ...query, status: undefined })
    const counts: Record<string, number> = { all: scoped.length }
    for (const correction of scoped) {
      counts[correction.status] = (counts[correction.status] ?? 0) + 1
    }
    return counts
  }, [corrections, query])
  return { data, isLoading: false }
}

/* --- writes -------------------------------------------------------------- */

export function useCreateCorrection() {
  const create = useDataStore((s) => s.createCorrection)
  return {
    isPending: false,
    mutate: (input: CreateCorrectionInput, opts?: { onSuccess?: (c: Correction) => void }) => {
      opts?.onSuccess?.(create(input))
    },
  }
}

export function useCancelCorrection(id: string) {
  const cancel = useDataStore((s) => s.cancelCorrection)
  return {
    isPending: false,
    mutate: (opts?: { onSuccess?: () => void; onError?: (message: string) => void }) => {
      const result = cancel(id)
      if (result.ok) opts?.onSuccess?.()
      else opts?.onError?.(result.error)
    },
  }
}
