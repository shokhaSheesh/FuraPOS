import { delay, http, HttpResponse } from 'msw'
import { api } from './api'
import { brands, categories, locations, products, USD_RATE, variations } from '../seed'
import { matches, paginate } from '../utils'
import { costInUzs, effectivePrice, productStock } from '@/features/products/model/product'

const url = (request: Request) => new URL(request.url)

/** Shared by the list, the counts and the summary so the three always agree. */
function filterVariations(u: URL) {
  const search = u.searchParams.get('search')
  const categoryId = u.searchParams.get('categoryId')
  const status = u.searchParams.get('status')
  const stock = u.searchParams.get('stock')

  return variations.filter((v) => {
    if (categoryId && !v.categoryPath.includes(categoryId)) return false
    if (status && v.status !== status) return false
    if (stock === 'zero' && v.stock !== 0) return false
    if (stock === 'low') {
      if (v.lowStockThreshold === null || v.stock === 0 || v.stock > v.lowStockThreshold) {
        return false
      }
    }
    return matches(
      [v.fullName, v.sku, v.barcode, v.brandName, v.description, v.vehicleMake],
      search,
    )
  })
}

export const catalogHandlers = [
  /** The sellable list: one row per variation. This is the catalogue. */
  http.get(api('/variations'), ({ request }) =>
    HttpResponse.json(paginate(filterVariations(url(request)), url(request))),
  ),

  /** The parent view: one row per product, with its variations aggregated. */
  http.get(api('/products'), ({ request }) => {
    const u = url(request)
    const search = u.searchParams.get('search')
    const status = u.searchParams.get('status')

    const filtered = products.filter((product) => {
      if (status && product.status !== status) return false
      return matches(
        [product.name, product.description, product.brandName, product.vehicleMake],
        search,
      )
    })

    return HttpResponse.json(paginate(filtered, u))
  }),

  http.get(api('/products/:id'), ({ params }) => {
    const product = products.find((item) => item.id === params.id)
    if (!product) return HttpResponse.json({ message: 'Product not found' }, { status: 404 })
    return HttpResponse.json(product)
  }),

  http.get(api('/variations/:id'), ({ params }) => {
    const variation = variations.find((item) => item.id === params.id)
    if (!variation) return HttpResponse.json({ message: 'Variation not found' }, { status: 404 })
    return HttpResponse.json(variation)
  }),

  /** Counts for the filter chips, ignoring the status filter itself. */
  http.get(api('/variations/status-counts'), ({ request }) => {
    const u = url(request)
    u.searchParams.delete('status')
    const scoped = filterVariations(u)
    const counts: Record<string, number> = { all: scoped.length }
    for (const v of scoped) counts[v.status] = (counts[v.status] ?? 0) + 1
    counts.zeroStock = scoped.filter((v) => v.stock === 0).length
    counts.withImage = scoped.filter((v) => v.imageUrl).length
    return HttpResponse.json(counts)
  }),

  /**
   * The strip above the catalogue. Stock is valued twice — at what we will
   * sell it for and at what we paid — because for an importer those are two
   * currencies, and the gap between them is the working-capital question.
   */
  http.get(api('/variations/summary'), ({ request }) => {
    const scoped = filterVariations(url(request))
    return HttpResponse.json({
      total: scoped.length,
      products: new Set(scoped.map((v) => v.productId)).size,
      active: scoped.filter((v) => v.status === 'active').length,
      archived: scoped.filter((v) => v.status === 'archived').length,
      quantity: scoped.reduce((sum, v) => sum + v.stock, 0),
      saleValue: scoped.reduce((sum, v) => sum + v.stock * effectivePrice(v), 0),
      costValue: scoped.reduce((sum, v) => sum + v.stock * costInUzs(v, USD_RATE), 0),
      zeroStock: scoped.filter((v) => v.stock === 0).length,
      withImage: scoped.filter((v) => v.imageUrl).length,
    })
  }),

  http.delete(api('/variations/:id'), async ({ params }) => {
    const index = variations.findIndex((item) => item.id === params.id)
    if (index === -1) return HttpResponse.json({ message: 'Not found' }, { status: 404 })
    // Deliberate latency: the in-flight state is a feature, not an edge case.
    await delay(700)
    variations.splice(index, 1)
    return new HttpResponse(null, { status: 204 })
  }),

  http.get(api('/categories'), () => HttpResponse.json({ items: categories })),
  http.get(api('/brands'), () => HttpResponse.json({ items: brands })),
  http.get(api('/locations'), () => HttpResponse.json({ items: locations })),
]

export { productStock }
