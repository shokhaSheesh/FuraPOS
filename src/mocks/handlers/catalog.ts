import { delay, http, HttpResponse } from 'msw'
import { api } from './api'
import { brands, categories, locations, products, USD_RATE } from '../seed'
import { matches, paginate } from '../utils'

const url = (request: Request) => new URL(request.url)

/** Shared by the list, the counts and the summary so the three agree. */
function filterProducts(u: URL) {
  const search = u.searchParams.get('search')
  const categoryId = u.searchParams.get('categoryId')
  const status = u.searchParams.get('status')
  const stock = u.searchParams.get('stock')

  return products.filter((product) => {
    if (categoryId && product.categoryId !== categoryId) return false
    if (status && product.status !== status) return false
    if (stock === 'zero' && product.stock !== 0) return false
    if (stock === 'low') {
      const low = product.lowStockThreshold
      if (low === null || product.stock === 0 || product.stock > low) return false
    }
    return matches(
      [product.name, product.sku, product.barcode, product.brandName, product.description],
      search,
    )
  })
}

export const catalogHandlers = [
  http.get(api('/products'), ({ request }) => {
    return HttpResponse.json(paginate(filterProducts(new URL(request.url)), url(request)))
  }),

  /** Counts for the filter chips, ignoring the status filter itself. */
  http.get(api('/products/status-counts'), ({ request }) => {
    const u = url(request)
    u.searchParams.delete('status')
    const scoped = filterProducts(u)
    const counts: Record<string, number> = { all: scoped.length }
    for (const product of scoped) counts[product.status] = (counts[product.status] ?? 0) + 1
    counts.zeroStock = scoped.filter((p) => p.stock === 0).length
    counts.withImage = scoped.filter((p) => p.imageUrl).length
    return HttpResponse.json(counts)
  }),

  /**
   * The strip above the table. Stock is valued twice — at what we will sell it
   * for and at what we paid — because for an importer those are different
   * currencies and the gap between them is the point.
   */
  http.get(api('/products/summary'), ({ request }) => {
    const scoped = filterProducts(url(request))
    const costInUzs = (p: (typeof products)[number]) =>
      p.costCurrency === 'USD' ? p.costPrice * USD_RATE : p.costPrice

    return HttpResponse.json({
      total: scoped.length,
      active: scoped.filter((p) => p.status === 'active').length,
      archived: scoped.filter((p) => p.status === 'archived').length,
      quantity: scoped.reduce((sum, p) => sum + p.stock, 0),
      saleValue: scoped.reduce((sum, p) => sum + p.stock * (p.discountPrice ?? p.salePrice), 0),
      costValue: scoped.reduce((sum, p) => sum + p.stock * costInUzs(p), 0),
      zeroStock: scoped.filter((p) => p.stock === 0).length,
      withImage: scoped.filter((p) => p.imageUrl).length,
    })
  }),

  http.get(api('/products/:id'), ({ params }) => {
    const product = products.find((item) => item.id === params.id)
    if (!product) return HttpResponse.json({ message: 'Product not found' }, { status: 404 })
    return HttpResponse.json(product)
  }),

  http.delete(api('/products/:id'), async ({ params }) => {
    const index = products.findIndex((item) => item.id === params.id)
    if (index === -1) return HttpResponse.json({ message: 'Product not found' }, { status: 404 })
    // Deliberate latency: the in-flight state is a feature, not an edge case.
    await delay(700)
    products.splice(index, 1)
    return new HttpResponse(null, { status: 204 })
  }),

  http.get(api('/categories'), () => HttpResponse.json({ items: categories })),
  http.get(api('/brands'), () => HttpResponse.json({ items: brands })),
  http.get(api('/locations'), () => HttpResponse.json({ items: locations })),
]
