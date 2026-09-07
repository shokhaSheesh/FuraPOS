import { useMemo } from 'react'
import { useDataStore, type CreateRepricingInput } from '@/data/store'
import { matches, paginate } from '@/data/query'
import type { ListQuery } from '@/shared/types'
import { averageChange, changedLines, marginShift, type Repricing } from '../model/repricing'

function filterRepricings(all: Repricing[], query: ListQuery) {
  return all.filter((repricing) => {
    if (query.status && repricing.status !== query.status) return false
    if (query.direction === 'up' && averageChange(repricing) <= 0) return false
    if (query.direction === 'down' && averageChange(repricing) >= 0) return false
    return matches(
      [
        repricing.number,
        repricing.categoryName,
        repricing.brandName,
        repricing.comment,
        repricing.createdBy,
      ],
      query.search,
    )
  })
}

export function useRepricings(query: ListQuery) {
  const repricings = useDataStore((s) => s.repricings)
  const data = useMemo(() => {
    const filtered = filterRepricings(repricings, query)
    const ordered = query.sort
      ? filtered
      : [...filtered].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return paginate(ordered, query)
  }, [repricings, query])
  return { data, isLoading: false }
}

export function useRepricing(id: string) {
  const repricing = useDataStore((s) => s.repricings.find((r) => r.id === id))
  return { data: repricing, isLoading: false, isError: !repricing }
}

export interface RepricingSummary {
  drafts: number
  appliedLines: number
  averageChange: number
  marginBefore: number
  marginAfter: number
}

export function useRepricingSummary(query: ListQuery) {
  const repricings = useDataStore((s) => s.repricings)
  return useMemo<RepricingSummary>(() => {
    const scoped = filterRepricings(repricings, { ...query, status: undefined })
    const applied = scoped.filter((r) => r.status === 'applied')
    const allLines = { lines: applied.flatMap((r) => r.lines) }
    const shift = marginShift(allLines)
    return {
      drafts: scoped.filter((r) => r.status === 'draft').length,
      appliedLines: changedLines(allLines).length,
      averageChange: averageChange(allLines),
      marginBefore: shift.before,
      marginAfter: shift.after,
    }
  }, [repricings, query])
}

export function useRepricingStatusCounts(query: ListQuery) {
  const repricings = useDataStore((s) => s.repricings)
  const data = useMemo(() => {
    const scoped = filterRepricings(repricings, { ...query, status: undefined })
    const counts: Record<string, number> = { all: scoped.length }
    for (const repricing of scoped) counts[repricing.status] = (counts[repricing.status] ?? 0) + 1
    return counts
  }, [repricings, query])
  return { data, isLoading: false }
}

/* --- writes -------------------------------------------------------------- */

export function useCreateRepricing() {
  const create = useDataStore((s) => s.createRepricing)
  return {
    isPending: false,
    mutate: (input: CreateRepricingInput, opts?: { onSuccess?: (r: Repricing) => void }) => {
      opts?.onSuccess?.(create(input))
    },
  }
}

export function useRepricingActions(id: string) {
  const setPrice = useDataStore((s) => s.setRepricingPrice)
  const apply = useDataStore((s) => s.applyRepricing)
  const revert = useDataStore((s) => s.revertRepricing)
  const run = (
    action: (id: string) => { ok: true } | { ok: false; error: string },
    opts?: { onSuccess?: () => void; onError?: (m: string) => void },
  ) => {
    const result = action(id)
    if (result.ok) opts?.onSuccess?.()
    else opts?.onError?.(result.error)
  }
  return {
    setPrice: (lineId: string, newPrice: number) => setPrice(id, lineId, newPrice),
    apply: (opts?: { onSuccess?: () => void; onError?: (m: string) => void }) => run(apply, opts),
    revert: (opts?: { onSuccess?: () => void; onError?: (m: string) => void }) => run(revert, opts),
  }
}
