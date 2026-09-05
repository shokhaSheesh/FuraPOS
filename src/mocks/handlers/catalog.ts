import { http, HttpResponse } from 'msw'
import { api } from './api'
import { brands, categories, locations, products } from '../seed'
import { matches, paginate } from '../utils'

export const catalogHandlers = [
  http.get(api('/products'), ({ request }) => {
    const url = new URL(request.url)
    const search = url.searchParams.get('search')
    const categoryId = url.searchParams.get('categoryId')
    const status = url.searchParams.get('status')

    const filtered = products.filter((product) => {
      if (categoryId && product.categoryId !== categoryId) return false
      if (status && product.status !== status) return false
      return matches([product.name, product.sku, product.barcode, product.brandName], search)
    })

    return HttpResponse.json(paginate(filtered, url))
  }),

  http.get(api('/products/:id'), ({ params }) => {
    const product = products.find((item) => item.id === params.id)
    if (!product) return HttpResponse.json({ message: 'Product not found' }, { status: 404 })
    return HttpResponse.json(product)
  }),

  http.get(api('/categories'), () => HttpResponse.json({ items: categories })),
  http.get(api('/brands'), () => HttpResponse.json({ items: brands })),
  http.get(api('/locations'), () => HttpResponse.json({ items: locations })),
]
