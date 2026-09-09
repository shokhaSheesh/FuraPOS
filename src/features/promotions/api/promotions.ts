import { useMemo } from 'react'
import { useDataStore, type PromotionInput } from '@/data/store'
import { matches } from '@/data/query'
import {
  bestPromotion,
  daysRemaining,
  promotionStatus,
  type PromotableLine,
  type Promotion,
  type PromotionStatus,
} from '../model/promotion'

export interface PromotionRow extends Promotion {
  status: PromotionStatus
  daysLeft: number | null
}

const STATUS_ORDER: Record<PromotionStatus, number> = {
  running: 0,
  scheduled: 1,
  paused: 2,
  finished: 3,
}

export function usePromotions(filters: { search?: unknown; status?: unknown } = {}) {
  const promotions = useDataStore((s) => s.promotions)

  return useMemo(() => {
    const items: PromotionRow[] = promotions
      .map((promotion) => ({
        ...promotion,
        status: promotionStatus(promotion),
        daysLeft: daysRemaining(promotion),
      }))
      .filter((promotion) => {
        if (filters.status && promotion.status !== filters.status) return false
        return matches(
          [promotion.name, ...promotion.scopeNames, promotion.comment],
          filters.search as string | undefined,
        )
      })
      // What is on now, then what is coming, then what is over.
      .sort((a, b) => {
        const byStatus = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
        if (byStatus !== 0) return byStatus
        return b.startsAt.localeCompare(a.startsAt)
      })

    return { data: { items, total: items.length }, isLoading: false }
  }, [promotions, filters.status, filters.search])
}

export function usePromotion(id: string | undefined) {
  const promotions = useDataStore((s) => s.promotions)
  return useMemo(() => {
    const promotion = promotions.find((p) => p.id === id)
    if (!promotion) return { data: undefined, isLoading: false }
    return {
      data: {
        ...promotion,
        status: promotionStatus(promotion),
        daysLeft: daysRemaining(promotion),
      } as PromotionRow,
      isLoading: false,
    }
  }, [promotions, id])
}

export function usePromotionCounts() {
  const { data } = usePromotions()
  return useMemo(() => {
    const counts: Record<string, number> = { all: data.items.length }
    for (const promotion of data.items) {
      counts[promotion.status] = (counts[promotion.status] ?? 0) + 1
    }
    return { data: counts }
  }, [data.items])
}

/**
 * The best promotion for a basket, for the New sale screen.
 *
 * Only one applies. Stacking overlapping offers is how a shop sells below cost
 * by accident, and "the customer gets the better of the two" is a rule that
 * can be explained at the counter.
 */
/**
 * The best offer for this basket **and this customer**.
 *
 * Passing the client is what makes a targeted promotion targeted: without it
 * New sale would offer a haulier's negotiated rate to a walk-in.
 */
export function useBestPromotion(lines: PromotableLine[], clientId: string | null = null) {
  const promotions = useDataStore((s) => s.promotions)
  return useMemo(
    () => bestPromotion(promotions, lines, new Date(), clientId),
    [promotions, lines, clientId],
  )
}

export function usePromotionActions() {
  const create = useDataStore((s) => s.createPromotion)
  const update = useDataStore((s) => s.updatePromotion)
  const setPaused = useDataStore((s) => s.setPromotionPaused)
  const remove = useDataStore((s) => s.deletePromotion)

  return {
    create: (input: PromotionInput) => create(input),
    update: (id: string, input: PromotionInput) => update(id, input),
    setPaused,
    remove,
    isPending: false,
  }
}
