import type { VariationRow } from '@/features/products/model/product'

/**
 * A document's product step, browsed the way the client's mockup does it:
 * category → sub-category → product cards → a product's variations.
 *
 * Transfers, purchase orders and goods receipts all pick products this way.
 * Each keeps its own rows — the sending shelf, a supplier's catalogue, ours —
 * one per variation, and this file only regroups them into the cards and
 * folders on top, so the cards and the list can never disagree about what is
 * on offer or already on the document.
 */

/** What every document's row has, whatever else it carries. */
export interface CatalogueRow {
  /** Stable across renders. */
  key: string
  variation: VariationRow
  /** How many are on the document. Zero means it is not on it yet. */
  quantity: number
  /** Units sold over 1 and 3 months, wherever the document cares about. */
  demand: { 1: number; 3: number }
}

/** One card: a product, with its variations on offer. */
export interface ProductGroup<R extends CatalogueRow = CatalogueRow> {
  productId: string
  productName: string
  categoryId: string
  categoryPath: string
  vehicleMakes: string[]
  vehicleModels: string[]
  rows: R[]
  demand: { 1: number; 3: number }
  /** Units of it already on the document, across its variations. */
  chosen: number
}

export interface CategoryNode {
  id: string
  name: string
  parentId: string | null
  imageUrl?: string | null
}

export function groupByProduct<R extends CatalogueRow>(rows: R[]): ProductGroup<R>[] {
  const groups = new Map<string, ProductGroup<R>>()
  for (const row of rows) {
    const v = row.variation
    let group = groups.get(v.productId)
    if (!group) {
      group = {
        productId: v.productId,
        productName: v.productName,
        categoryId: v.categoryId,
        categoryPath: v.categoryPath,
        vehicleMakes: v.vehicleMakes,
        vehicleModels: v.vehicleModels,
        rows: [],
        demand: { 1: 0, 3: 0 },
        chosen: 0,
      }
      groups.set(v.productId, group)
    }
    group.rows.push(row)
    group.demand = { 1: group.demand[1] + row.demand[1], 3: group.demand[3] + row.demand[3] }
    group.chosen += row.quantity
  }
  return [...groups.values()]
}

/** A per-row figure added up across a card's variations. */
export const sumRows = <R extends CatalogueRow>(group: ProductGroup<R>, pick: (row: R) => number) =>
  group.rows.reduce((sum, row) => sum + pick(row), 0)

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
  groups: ProductGroup<CatalogueRow>[],
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

/**
 * Name, code, OEM, barcode or storage address — of the product or any variation
 * of it — plus whatever else the document's rows are known by, such as a
 * supplier's own code.
 */
export function matchesSearch<R extends CatalogueRow>(
  group: ProductGroup<R>,
  query: string,
  extra?: (row: R) => (string | null | undefined)[],
) {
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
      ...(extra?.(row) ?? []),
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

/** Best sellers first: over three months, then six to break a tie. */
export function bestSellingFirst<G extends ProductGroup<CatalogueRow>>(groups: G[]): G[] {
  return [...groups].sort((a, b) => b.demand[1] - a.demand[1] || b.demand[3] - a.demand[3])
}

/** Every photo of a product once, first variation's first: its photo, then its gallery. */
export function photosOf<R extends CatalogueRow>(group: ProductGroup<R>): string[] {
  const all = group.rows.flatMap((row) => [
    row.variation.imageUrl,
    ...(row.variation.gallery ?? []),
  ])
  return [...new Set(all.filter((src): src is string => Boolean(src)))]
}
