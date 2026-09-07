import type { Id } from '@/shared/types'
import type { useDataStore } from '@/data/store'
import { matches } from '@/data/query'
import { USD_RATE } from '@/data/seed'

/**
 * What to buy, and how much.
 *
 * Every other screen in this module records something that already happened.
 * This is the only forecast, and it is the payoff for the rest: sales say
 * how fast a part leaves, stock says what is left, receipts say who sells it
 * and what it cost, and the supplier's MOQ says what a realistic order looks
 * like. None of those alone answers "what should I buy on Monday".
 */

/**
 * The four numbers a buying suggestion rests on.
 *
 * Three are OX's, named as OX names them, because they are the ones a buyer
 * already thinks in: how far back to judge demand, how often they place an
 * order, and how much slack they want on top.
 *
 * **`leadTimeDays` matters most here.** OX asks for it on the schedule
 * («Срок доставки») but not on a manual run, which works for a shop reordering
 * locally and quietly breaks for an importer whose container is six weeks out:
 * without it, a part with three weeks of stock looks comfortable when it will
 * in fact be empty long before anything can arrive.
 */
export interface ReorderSettings {
  /** OX: «Период продаж» — days of history to judge demand on. */
  salesWindowDays: number
  /** OX: «Срок доставки» — how long a delivery takes to arrive. */
  leadTimeDays: number
  /** OX: «До следующего заказа, дней» — the gap between orders. */
  orderIntervalDays: number
  /** OX: «Страховой запас» — days of cover on top of the horizon. */
  safetyDays: number
}

export const DEFAULT_SETTINGS: ReorderSettings = {
  salesWindowDays: 90,
  // An importer's container is weeks away, not days — a default of 7 would
  // make every suggestion wrong on the first screen.
  leadTimeDays: 30,
  orderIntervalDays: 14,
  safetyDays: 7,
}

/**
 * How many days a delivery has to last: long enough to arrive, then long enough
 * to survive until the *next* delivery arrives, plus whatever slack was asked
 * for. This is the standard periodic-review horizon, and it is where OX's two
 * fields and our lead time meet.
 */
export const coverageHorizon = (settings: ReorderSettings) =>
  settings.leadTimeDays + settings.orderIntervalDays + settings.safetyDays

/**
 * How close a part is to running out, measured against how long a delivery
 * takes rather than against a fixed number. Ten units is comfortable for
 * something that sells one a month and an emergency for something that sells
 * ten a week.
 */
export type Urgency = 'out' | 'critical' | 'soon' | 'ok' | 'idle'

export const URGENCIES: {
  value: Urgency
  label: string
  tone: 'danger' | 'warning' | 'success' | 'neutral'
}[] = [
  { value: 'out', label: 'Out of stock', tone: 'danger' },
  { value: 'critical', label: 'Will run out first', tone: 'danger' },
  { value: 'soon', label: 'Order soon', tone: 'warning' },
  { value: 'ok', label: 'Enough', tone: 'success' },
  { value: 'idle', label: 'Not selling', tone: 'neutral' },
]

export const urgencyLabel = (urgency: Urgency) =>
  URGENCIES.find((entry) => entry.value === urgency)?.label ?? urgency

export const urgencyTone = (urgency: Urgency) =>
  URGENCIES.find((entry) => entry.value === urgency)?.tone ?? 'neutral'

export interface ReorderLine {
  variationId: Id
  productId: Id
  sku: string
  name: string
  imageUrl: string | null
  unit: string
  categoryName: string
  supplierId: Id | null
  supplierName: string | null

  onHand: number
  /** Units sold inside the history window. */
  sold: number
  /** Units per day, from that window. */
  dailyRate: number
  /** How many days the shelf lasts at that rate. Null when it never sells. */
  daysOfCover: number | null
  /** What a delivery's worth of demand looks like — the trigger level. */
  reorderPoint: number
  /** The raw shortfall, before the supplier's minimum is applied. */
  shortfall: number
  /** What to actually order: the shortfall rounded up to a whole MOQ. */
  suggested: number
  moq: number | null
  unitCost: number
  costCurrency: 'USD' | 'UZS'
  urgency: Urgency
}

/** Units per day over the window. Zero when nothing sold. */
export const dailyRate = (sold: number, salesWindowDays: number) =>
  salesWindowDays <= 0 ? 0 : sold / salesWindowDays

/**
 * Days until the shelf is empty. **Null, not Infinity**, when a part does not
 * sell — the difference matters, because "lasts forever" and "we have no idea"
 * are the same number and neither should be sorted alongside real figures.
 */
export const daysOfCover = (onHand: number, rate: number) => (rate <= 0 ? null : onHand / rate)

/**
 * The level at which ordering has to start: enough to survive the wait for a
 * delivery. Below this and the part runs out before anything can arrive,
 * whatever is ordered today.
 */
export const reorderPoint = (rate: number, settings: ReorderSettings) =>
  Math.ceil(rate * settings.leadTimeDays)

/**
 * How many to buy: enough to cover the wait *and* the period after it, less
 * what is already on the shelf, then rounded up to a whole multiple of the
 * supplier's minimum — because ordering 7 from a supplier who ships in 12s is
 * a suggestion nobody can act on.
 */
export function suggestedQuantity(
  onHand: number,
  rate: number,
  moq: number | null,
  settings: ReorderSettings,
): { shortfall: number; suggested: number } {
  const target = rate * coverageHorizon(settings)
  const shortfall = Math.max(0, Math.ceil(target - onHand))
  if (shortfall === 0) return { shortfall: 0, suggested: 0 }
  if (!moq || moq <= 1) return { shortfall, suggested: shortfall }
  return { shortfall, suggested: Math.ceil(shortfall / moq) * moq }
}

export function urgencyOf(
  onHand: number,
  rate: number,
  cover: number | null,
  settings: ReorderSettings,
): Urgency {
  // Something that never sells is not urgent however empty the shelf is, and
  // saying otherwise buries the parts that matter.
  if (rate <= 0) return 'idle'
  if (onHand <= 0) return 'out'
  if (cover === null) return 'idle'
  // Below the lead time it is already too late: whatever is ordered today, the
  // shelf empties before it lands.
  if (cover < settings.leadTimeDays) return 'critical'
  if (cover < coverageHorizon(settings)) return 'soon'
  return 'ok'
}

/** Everything worth ordering, in the order someone should deal with it. */
export const URGENCY_ORDER: Record<Urgency, number> = {
  out: 0,
  critical: 1,
  soon: 2,
  ok: 3,
  idle: 4,
}

export const needsOrdering = (line: Pick<ReorderLine, 'urgency' | 'suggested'>) =>
  line.suggested > 0 &&
  (line.urgency === 'out' || line.urgency === 'critical' || line.urgency === 'soon')

export const lineCostUzs = (line: ReorderLine, usdRate: number) =>
  line.suggested * (line.costCurrency === 'USD' ? line.unitCost * usdRate : line.unitCost)

/* --- turning the catalogue into a buying list ----------------------------- */

export interface ReorderFilters {
  search?: string
  supplierId?: string | null
  categoryId?: string | null
  locationId?: string | null
  /** A selection can be scoped to several warehouses at once, as OX allows. */
  locationIds?: string[]
  urgency?: Urgency | null
  /** Hide anything already comfortable, which is most of the catalogue. */
  onlyNeeded?: boolean
}

/**
 * Turns the whole catalogue into a buying list.
 *
 * Everything here is derived on read. There is no stored "suggestion", because
 * a suggestion is only true for as long as the stock and the sales behind it
 * are — one sale later and yesterday's answer is wrong.
 */
/**
 * The calculation itself, free of React so a saved selection can freeze the
 * same answer the screen would have shown.
 */
export function buildReorderLines(
  data: {
    variations: ReturnType<typeof useDataStore.getState>['variations']
    sales: ReturnType<typeof useDataStore.getState>['sales']
    receipts: ReturnType<typeof useDataStore.getState>['receipts']
  },
  settings: ReorderSettings,
  filters: ReorderFilters,
): ReorderLine[] {
  const { variations, sales, receipts } = data
  {
    const since = Date.now() - settings.salesWindowDays * 86_400_000

    /* Units sold per variation in the window. Deleted sales are excluded for
       the same reason they are excluded from revenue: a cancelled sale is not
       demand, and treating it as such would have us buying stock to replace
       goods that never left. */
    const sold = new Map<string, number>()
    for (const sale of sales) {
      if (sale.status === 'deleted') continue
      if (new Date(sale.createdAt).getTime() < since) continue
      if (filters.locationId && sale.locationId !== filters.locationId) continue
      if (filters.locationIds?.length && !filters.locationIds.includes(sale.locationId)) continue
      for (const line of sale.lines) {
        sold.set(line.variationId, (sold.get(line.variationId) ?? 0) + line.quantity)
      }
    }

    /* Who last sent us each part, and at what landed cost. The most recent
       posted receipt wins: a supplier we stopped buying from is not who we
       should be ordering from now. */
    const source = new Map<
      string,
      { supplierId: string | null; supplierName: string | null; at: string }
    >()
    for (const receipt of receipts) {
      if (receipt.status !== 'received' || !receipt.receivedAt) continue
      for (const line of receipt.lines) {
        const current = source.get(line.variationId)
        if (!current || receipt.receivedAt > current.at) {
          source.set(line.variationId, {
            supplierId: receipt.supplierId,
            supplierName: receipt.supplierName,
            at: receipt.receivedAt,
          })
        }
      }
    }

    const lines: ReorderLine[] = variations
      .filter((variation) => variation.status === 'active')
      .map((variation) => {
        const scope = filters.locationIds?.length
          ? filters.locationIds
          : filters.locationId
            ? [filters.locationId]
            : null
        const onHand = scope
          ? variation.stockByLocation
              .filter((row) => scope.includes(row.locationId))
              .reduce((sum, row) => sum + row.quantity, 0)
          : variation.stock
        const unitsSold = sold.get(variation.id) ?? 0
        const rate = dailyRate(unitsSold, settings.salesWindowDays)
        const cover = daysOfCover(onHand, rate)
        const { shortfall, suggested } = suggestedQuantity(onHand, rate, variation.moq, settings)
        const from = source.get(variation.id)

        return {
          variationId: variation.id,
          productId: variation.productId,
          sku: variation.sku,
          name: variation.fullName,
          imageUrl: variation.imageUrl,
          unit: variation.unit,
          categoryName: variation.categoryName,
          supplierId: from?.supplierId ?? null,
          supplierName: from?.supplierName ?? null,
          onHand,
          sold: unitsSold,
          dailyRate: rate,
          daysOfCover: cover,
          reorderPoint: reorderPoint(rate, settings),
          shortfall,
          suggested,
          moq: variation.moq,
          unitCost: variation.costPrice,
          costCurrency: variation.costCurrency,
          urgency: urgencyOf(onHand, rate, cover, settings),
        }
      })
      .filter((line) => {
        if (filters.onlyNeeded && !needsOrdering(line)) return false
        if (filters.urgency && line.urgency !== filters.urgency) return false
        if (filters.supplierId && line.supplierId !== filters.supplierId) return false
        if (filters.categoryId) {
          const variation = variations.find((v) => v.id === line.variationId)
          if (variation?.categoryId !== filters.categoryId) return false
        }
        return matches([line.name, line.sku, line.supplierName, line.categoryName], filters.search)
      })

    // Most urgent first, then whatever runs out soonest — the order someone
    // would deal with them in.
    lines.sort((a, b) => {
      const byUrgency = URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency]
      if (byUrgency !== 0) return byUrgency
      return (a.daysOfCover ?? Infinity) - (b.daysOfCover ?? Infinity)
    })

    return lines
  }
}

export interface ReorderSummary {
  needed: number
  outOfStock: number
  critical: number
  units: number
  cost: number
  suppliers: number
}

export function summariseReorder(lines: ReorderLine[]): ReorderSummary {
  const needed = lines.filter(needsOrdering)
  return {
    needed: needed.length,
    outOfStock: lines.filter((line) => line.urgency === 'out').length,
    critical: lines.filter((line) => line.urgency === 'critical').length,
    units: needed.reduce((sum, line) => sum + line.suggested, 0),
    cost: needed.reduce((sum, line) => sum + lineCostUzs(line, USD_RATE), 0),
    suppliers: new Set(needed.map((line) => line.supplierId ?? '__none__')).size,
  }
}

export function countByUrgency(lines: ReorderLine[]): Record<string, number> {
  const counts: Record<string, number> = { all: lines.length }
  for (const line of lines) counts[line.urgency] = (counts[line.urgency] ?? 0) + 1
  return counts
}
