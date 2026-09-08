import { useMemo } from 'react'
import { useDataStore } from '@/data/store'
import { USD_RATE } from '@/data/seed'
import type { Sale } from '@/features/sales/model/sale'
import type { VariationRow } from '@/features/products/model/product'
import { covers, type Promotion } from '@/features/promotions/model/promotion'
import {
  EMPTY_WINDOW,
  upliftOf,
  verdictFor,
  type PromotionResult,
  type WindowFigures,
} from '../model/promotionResult'

const costUzs = (variation: VariationRow | undefined, quantity: number) =>
  variation
    ? (variation.costCurrency === 'USD' ? variation.costPrice * USD_RATE : variation.costPrice) *
      quantity
    : 0

/**
 * Figures for one window, restricted to what the promotion covered.
 *
 * Scoped deliberately: measuring a brakes promotion against total shop revenue
 * would drown its effect in every oil filter sold that week.
 */
function windowFigures(
  sales: Sale[],
  variations: Map<string, VariationRow>,
  promotion: Promotion,
  from: number,
  to: number,
): WindowFigures {
  const figures = { ...EMPTY_WINDOW }
  const clients = new Set<string>()

  for (const sale of sales) {
    if (sale.status === 'deleted') continue
    const at = new Date(sale.createdAt).getTime()
    if (at < from || at > to) continue

    let counted = false
    for (const line of sale.lines) {
      const variation = variations.get(line.variationId)
      const inScope = covers(promotion, {
        variationId: line.variationId,
        productId: line.productId,
        categoryId: variation?.categoryId ?? null,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
      })
      if (!inScope) continue

      const gross = line.quantity * line.unitPrice
      const revenue = gross - (gross * line.discountPercent) / 100
      figures.revenue += revenue
      figures.margin += revenue - costUzs(variation, line.quantity)
      figures.units += line.quantity
      counted = true
    }

    if (counted) {
      figures.sales += 1
      if (sale.clientId) clients.add(sale.clientId)
    }
  }

  figures.clients = clients.size
  return figures
}

/**
 * Every promotion, measured.
 *
 * The comparison window is **the same number of days immediately before it
 * started**. That is the standard approach and it has a standard caveat, which
 * the screen states rather than hides: it cannot separate the promotion from
 * anything else that changed in those weeks — a season, a competitor, a
 * delivery that failed to arrive.
 */
export function usePromotionReport(enabled: boolean): PromotionResult[] | null {
  const promotions = useDataStore((s) => s.promotions)
  const sales = useDataStore((s) => s.sales)
  const variations = useDataStore((s) => s.variations)

  return useMemo(() => {
    if (!enabled) return null
    const byId = new Map(variations.map((variation) => [variation.id, variation]))
    const now = Date.now()

    return (
      promotions
        .map((promotion) => {
          const started = new Date(promotion.startsAt).getTime()
          // A promotion still running is measured up to today, not to a future
          // end date it has not reached.
          const ended = Math.min(promotion.endsAt ? new Date(promotion.endsAt).getTime() : now, now)
          const span = Math.max(0, ended - started)
          const days = Math.floor(span / 86_400_000)

          const during = windowFigures(sales, byId, promotion, started, ended)
          const before = windowFigures(sales, byId, promotion, started - span, started - 1)

          let discountGiven = 0
          let unitsDiscounted = 0
          let uses = 0
          for (const sale of sales) {
            if (sale.status === 'deleted' || sale.promotionId !== promotion.id) continue
            uses += 1
            for (const line of sale.lines) {
              if (line.discountPercent <= 0) continue
              const gross = line.quantity * line.unitPrice
              discountGiven += (gross * line.discountPercent) / 100
              unitsDiscounted += line.quantity
            }
          }

          /*
          The extra margin is the whole answer, and the discount is **already
          inside it**: margin is revenue-after-discount less cost, so a
          promotion that gave away more than it brought in shows up here as a
          smaller margin than the baseline. Subtracting `discountGiven` again
          would charge the campaign for the same money twice.
        */
          const marginGained = during.margin - before.margin
          const result = {
            promotionId: promotion.id,
            name: promotion.name,
            days,
            uses,
            discountGiven,
            unitsDiscounted,
            during,
            before,
            upliftRatio: upliftOf(during, before),
            marginGained,
            netEffect: marginGained,
          }

          return { ...result, verdict: verdictFor({ ...result }) } satisfies PromotionResult
        })
        // Biggest giveaway first: the money already spent is what deserves a look.
        .sort((a, b) => b.discountGiven - a.discountGiven)
    )
  }, [enabled, promotions, sales, variations])
}
