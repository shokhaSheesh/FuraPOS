import { useMemo } from 'react'
import { useDataStore, type ProductInput } from '@/data/store'
import { matches, paginate } from '@/data/query'
import { USD_RATE } from '@/data/seed'
import type { ListQuery } from '@/shared/types'
import { costInUzs, effectivePrice, type VariationRow } from '../model/product'

/**
 * Everything here reads the in-memory store directly. There is no network, so
 * nothing is ever loading and nothing can fail — the hooks keep the shape the
 * screens already expect so they did not have to change.
 */

/**
 * Narrows the catalogue to one location.
 *
 * This is a scope, not just a row filter: a variation the location does not
 * carry disappears, and the ones that remain report **that location's**
 * quantity as their stock. Every figure downstream — the Stock column, the
 * summary strip, stock-at-cost, the CSV — reads `stock`, so scoping it here
 * means none of them can disagree about which shelf is being counted.
 */
function scopeToLocation(all: VariationRow[], locationId: string) {
  return all.flatMap((v) => {
    const row = v.stockByLocation.find((entry) => entry.locationId === locationId)
    return row ? [{ ...v, stock: row.quantity, stockByLocation: [row] }] : []
  })
}

/**
 * How the list is laid out. Every view lists the same variations — one product
 * never becomes three — they differ only in how stock at several locations is
 * shown:
 *
 * - `variations`: one row per variation, stock summed across locations;
 * - `location`: one row per variation *per location it is stocked at*, so a
 *   part kept in three places reads as three rows, each with its own quantity.
 *
 * A quantity column per location is not a view: it is a set of optional
 * columns on `variations`, switched on from the Columns menu.
 */
export type ProductListView = 'variations' | 'location'

export const PRODUCT_LIST_VIEWS: { value: ProductListView; label: string }[] = [
  { value: 'variations', label: 'By variation' },
  { value: 'location', label: 'By location' },
]

export const productListView = (value: unknown): ProductListView =>
  PRODUCT_LIST_VIEWS.some((view) => view.value === value)
    ? (value as ProductListView)
    : 'variations'

/** A variation at one location — the same record, its stock narrowed to that shelf. */
const splitByLocation = (all: VariationRow[]) =>
  all.flatMap((v) =>
    v.stockByLocation.map((row) => ({ ...v, stock: row.quantity, stockByLocation: [row] })),
  )

/** Unique per row in every view: in `location` a variation appears once per location. */
export const productRowId = (row: VariationRow) =>
  row.stockByLocation.length === 1 ? `${row.id}@${row.stockByLocation[0]!.locationId}` : row.id

function filterVariations(all: VariationRow[], query: ListQuery) {
  const view = productListView(query.view)
  const scoped = query.location
    ? scopeToLocation(all, String(query.location))
    : view === 'location'
      ? splitByLocation(all)
      : all
  return scoped.filter((v) => {
    if (query.status && v.status !== query.status) return false
    if (query.stock === 'zero' && v.stock !== 0) return false
    if (query.stock === 'low') {
      if (v.lowStockThreshold === null || v.stock === 0 || v.stock > v.lowStockThreshold) {
        return false
      }
    }
    return matches(
      [v.fullName, v.sku, v.barcode, v.brandName, v.oem, v.description, v.vehicleMake],
      query.search,
    )
  })
}

export function useVariations(query: ListQuery, options: { enabled?: boolean } = {}) {
  const variations = useDataStore((s) => s.variations)
  const data = useMemo(() => {
    if (options.enabled === false) return undefined
    return paginate(filterVariations(variations, query), query)
  }, [variations, query, options.enabled])
  return { data, isLoading: false }
}

export function useProducts(query: ListQuery, options: { enabled?: boolean } = {}) {
  const products = useDataStore((s) => s.products)
  const data = useMemo(() => {
    if (options.enabled === false) return undefined
    const filtered = products.filter((p) => {
      if (query.status && p.status !== query.status) return false
      // A product belongs to a location if any of its variations is carried
      // there — otherwise the by-product view would contradict the by-variation
      // one about what that warehouse holds.
      if (
        query.location &&
        !p.variations.some((v) =>
          v.stockByLocation.some((row) => row.locationId === String(query.location)),
        )
      ) {
        return false
      }
      return matches([p.name, p.oem, p.description, p.brandName, p.vehicleMake], query.search)
    })
    return paginate(filtered, query)
  }, [products, query, options.enabled])
  return { data, isLoading: false }
}

export function useProduct(id: string) {
  const product = useDataStore((s) => s.products.find((p) => p.id === id))
  return { data: product, isLoading: false, isError: !product }
}

export interface CatalogSummary {
  total: number
  products: number
  active: number
  archived: number
  quantity: number
  saleValue: number
  costValue: number
  zeroStock: number
  withImage: number
}

export function useCatalogSummary(query: ListQuery) {
  const variations = useDataStore((s) => s.variations)
  const data = useMemo<CatalogSummary>(() => {
    const scoped = filterVariations(variations, query)
    return {
      total: scoped.length,
      products: new Set(scoped.map((v) => v.productId)).size,
      active: scoped.filter((v) => v.status === 'active').length,
      archived: scoped.filter((v) => v.status === 'archived').length,
      quantity: scoped.reduce((sum, v) => sum + v.stock, 0),
      saleValue: scoped.reduce((sum, v) => sum + v.stock * effectivePrice(v), 0),
      costValue: scoped.reduce((sum, v) => sum + v.stock * costInUzs(v, USD_RATE), 0),
      zeroStock: scoped.filter((v) => v.stock === 0).length,
      withImage: scoped.filter((v) => v.imageUrl).length,
    }
  }, [variations, query])
  return { data, isLoading: false }
}

export function useCategories() {
  const items = useDataStore((s) => s.categories)
  return { data: { items }, isLoading: false }
}

export function useBrands() {
  const items = useDataStore((s) => s.brands)
  return { data: { items }, isLoading: false }
}

/** Every product, for showing what a variation is linked to. */
export function useAllProducts() {
  const items = useDataStore((s) => s.products)
  return { data: { items }, isLoading: false }
}

/**
 * Every variation as a picker option, for linking one to others — analogues,
 * bought together. A product's own variations are left out: a part is not its
 * own analogue.
 */
export function useVariationChoices(exceptProductId?: string) {
  const variations = useDataStore((s) => s.variations)
  return useMemo(
    () =>
      variations
        .filter((v) => v.productId !== exceptProductId)
        .map((v) => ({
          value: v.id,
          label: v.fullName,
          meta: [v.sku, v.oem && `OEM ${v.oem}`].filter(Boolean).join(' · '),
        })),
    [variations, exceptProductId],
  )
}

/** Warehouses and shops a product can be stocked at. */
export function useLocations() {
  const items = useDataStore((s) => s.locations)
  return { data: { items }, isLoading: false }
}

/* --- writes -------------------------------------------------------------- */

export function useDeleteVariation() {
  const remove = useDataStore((s) => s.deleteVariation)
  return {
    isPending: false,
    mutate: (id: string, opts?: { onSuccess?: () => void }) => {
      remove(id)
      opts?.onSuccess?.()
    },
  }
}

export function useCreateProduct() {
  const create = useDataStore((s) => s.createProduct)
  return {
    isPending: false,
    mutate: (
      input: ProductInput,
      opts?: { onSuccess?: (p: ReturnType<typeof create>) => void },
    ) => {
      opts?.onSuccess?.(create(input))
    },
  }
}

export function useUpdateProduct(id: string) {
  const update = useDataStore((s) => s.updateProduct)
  return {
    isPending: false,
    mutate: (input: ProductInput, opts?: { onSuccess?: () => void }) => {
      update(id, input)
      opts?.onSuccess?.()
    },
  }
}
