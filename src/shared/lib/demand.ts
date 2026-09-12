import type { Sale } from '@/features/sales/model/sale'

/**
 * How much of something actually sold, somewhere, lately.
 *
 * Moving stock between shelves without knowing what sells where is guesswork,
 * and this is the number that turns a transfer from a hunch into a decision.
 *
 * Deleted sales are excluded for the same reason they are excluded from
 * revenue: a cancelled sale is not demand, and counting it would have us
 * shipping stock to replace goods that never left.
 */
export const DEMAND_WINDOWS = [3, 6] as const
export type DemandWindow = (typeof DEMAND_WINDOWS)[number]

/** Months are counted as 30 days — near enough, and the same every time. */
export const DAYS_PER_MONTH = 30

export function unitsSoldAt(
  sales: Pick<Sale, 'status' | 'locationId' | 'createdAt' | 'lines'>[],
  variationId: string,
  locationId: string | null,
  months: number,
  now: number = Date.now(),
): number {
  const since = now - months * DAYS_PER_MONTH * 86_400_000
  let total = 0
  for (const sale of sales) {
    if (sale.status === 'deleted') continue
    // A null location means "anywhere" — used when no source is chosen yet.
    if (locationId !== null && sale.locationId !== locationId) continue
    if (new Date(sale.createdAt).getTime() < since) continue
    for (const line of sale.lines) {
      if (line.variationId === variationId) total += line.quantity
    }
  }
  return total
}

/**
 * The same figure over each window the screen offers, in one pass.
 *
 * Read together they say something a single number cannot: six months of
 * sales with nothing in the last three is a part that has stopped moving,
 * and shipping more of it to that shelf would be the wrong call.
 */
export function demandAt(
  sales: Pick<Sale, 'status' | 'locationId' | 'createdAt' | 'lines'>[],
  variationId: string,
  locationId: string | null,
  now: number = Date.now(),
): Record<DemandWindow, number> {
  return {
    3: unitsSoldAt(sales, variationId, locationId, 3, now),
    6: unitsSoldAt(sales, variationId, locationId, 6, now),
  }
}

/**
 * Whether the recent half of the six-month window is quieter than the older
 * half — said plainly on screen rather than left for somebody to subtract.
 */
export const hasStalled = (demand: Record<DemandWindow, number>) => demand[6] > 0 && demand[3] === 0
