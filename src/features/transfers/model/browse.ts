import type { TransferRow } from '../components/transferLineColumns'

/**
 * The transfer's product step, browsed the way the client's mockup does it:
 * category → sub-category → product cards → a product's variations.
 *
 * The rows underneath are still the sending shelf, one per variation, exactly
 * as the table view shows them. This file only regroups them into the cards
 * and folders that sit on top, so the two views can never disagree about what
 * is on the shelf or on the transfer.
 */

/** One card: a product, with the variations of it the source can spare. */
export interface ProductGroup {
  productId: string
  productName: string
  categoryId: string
  categoryPath: string
  brandName: string | null
  manufacturer: string | null
  vehicleMakes: string[]
  vehicleModels: string[]
  rows: TransferRow[]
  atSource: number
  atDestination: number
  demand: { 3: number; 6: number }
  /** Units of it already on the transfer, across its variations. */
  chosen: number
}

export interface CategoryNode {
  id: string
  name: string
  parentId: string | null
}

export function groupByProduct(rows: TransferRow[]): ProductGroup[] {
  const groups = new Map<string, ProductGroup>()
  for (const row of rows) {
    const v = row.variation
    let group = groups.get(v.productId)
    if (!group) {
      group = {
        productId: v.productId,
        productName: v.productName,
        categoryId: v.categoryId,
        categoryPath: v.categoryPath,
        brandName: v.brandName,
        manufacturer: v.manufacturer,
        vehicleMakes: v.vehicleMakes,
        vehicleModels: v.vehicleModels,
        rows: [],
        atSource: 0,
        atDestination: 0,
        demand: { 3: 0, 6: 0 },
        chosen: 0,
      }
      groups.set(v.productId, group)
    }
    group.rows.push(row)
    group.atSource += row.atSource
    group.atDestination += row.atDestination
    group.demand = { 3: group.demand[3] + row.demand[3], 6: group.demand[6] + row.demand[6] }
    group.chosen += row.quantity
  }
  return [...groups.values()]
}

export const childrenOf = (id: string | null, categories: CategoryNode[]) =>
  categories.filter((category) => category.parentId === id)

/** A category and everything filed beneath it, however deep. */
export function subtreeOf(id: string, categories: CategoryNode[]): Set<string> {
  const found = new Set([id])
  let frontier = [id]
  while (frontier.length) {
    const next = categories.filter((c) => c.parentId && frontier.includes(c.parentId))
    frontier = next.map((c) => c.id).filter((childId) => !found.has(childId))
    frontier.forEach((childId) => found.add(childId))
  }
  return found
}

/** How many cards sit under each category, its sub-categories included. */
export function countByCategory(
  groups: ProductGroup[],
  categories: CategoryNode[],
): Map<string, number> {
  const parentOf = new Map(categories.map((c) => [c.id, c.parentId] as const))
  const counts = new Map<string, number>()
  for (const group of groups) {
    let id: string | null | undefined = group.categoryId
    // Guarded against a loop in the tree, which settings should never allow.
    const seen = new Set<string>()
    while (id && !seen.has(id)) {
      seen.add(id)
      counts.set(id, (counts.get(id) ?? 0) + 1)
      id = parentOf.get(id)
    }
  }
  return counts
}

/** Name, code, OEM, barcode or storage address — of the product or any variation of it. */
export function matchesSearch(group: ProductGroup, query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return group.rows.some((row) =>
    [
      row.variation.productName,
      row.variation.fullName,
      row.variation.sku,
      row.variation.barcode,
      row.variation.oem,
      row.variation.shelfAddress,
      row.variation.productId,
    ].some((field) => field?.toLowerCase().includes(q)),
  )
}

/**
 * How low a shelf reads on a card. The mockup's thresholds: two or fewer is
 * critical, five or fewer is low.
 */
export type StockLevel = 'critical' | 'low' | 'good'
export const stockLevel = (units: number): StockLevel =>
  units <= 2 ? 'critical' : units <= 5 ? 'low' : 'good'

export type Availability = 'any' | 'low' | 'none'

/** Filtered on what the *receiving* end holds, since that is what a move is for. */
export function matchesAvailability(group: ProductGroup, availability: Availability) {
  if (availability === 'low') return group.atDestination <= 5
  if (availability === 'none') return group.atDestination === 0
  return true
}

export type SortBy = 'sales' | 'stock' | 'name'

export function sortGroups(groups: ProductGroup[], by: SortBy): ProductGroup[] {
  const sorted = [...groups]
  if (by === 'sales') sorted.sort((a, b) => b.demand[3] - a.demand[3] || b.demand[6] - a.demand[6])
  // Emptiest destination first: those are the ones worth moving.
  if (by === 'stock') sorted.sort((a, b) => a.atDestination - b.atDestination)
  if (by === 'name') sorted.sort((a, b) => a.productName.localeCompare(b.productName))
  return sorted
}
