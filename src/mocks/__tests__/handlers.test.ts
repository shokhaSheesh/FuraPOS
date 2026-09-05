import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { server } from '../node'
import { DEFAULT_PAGE_SIZE } from '@/shared/types'
import type { Paginated } from '@/shared/types'
import type { Product } from '@/features/products/model/product'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())

const get = async <T>(path: string) => {
  const response = await fetch(`http://localhost/api${path}`)
  expect(response.ok).toBe(true)
  return (await response.json()) as T
}

/**
 * These assert the API *contract* the UI is built against. When the real
 * backend arrives, this file is the spec it has to satisfy.
 */
describe('mock API', () => {
  it('paginates products with a total across all pages', async () => {
    const page = await get<Paginated<Product>>('/products')
    expect(page.items).toHaveLength(DEFAULT_PAGE_SIZE)
    expect(page.total).toBeGreaterThan(page.items.length)
    expect(page.page).toBe(1)
  })

  it('returns a different slice on page 2', async () => {
    const first = await get<Paginated<Product>>('/products?page=1&pageSize=10')
    const second = await get<Paginated<Product>>('/products?page=2&pageSize=10')
    expect(second.items).toHaveLength(10)
    expect(second.items[0]!.id).not.toBe(first.items[0]!.id)
  })

  it('sorts by a numeric column', async () => {
    const page = await get<Paginated<Product>>('/products?sort=salePrice&order=desc&pageSize=5')
    const prices = page.items.map((product) => product.salePrice)
    expect(prices).toEqual([...prices].sort((a, b) => b - a))
  })

  it('searches by name, SKU and barcode', async () => {
    const all = await get<Paginated<Product>>('/products?pageSize=1')
    const target = all.items[0]!
    const found = await get<Paginated<Product>>(`/products?search=${target.sku}`)
    expect(found.items.map((product) => product.id)).toContain(target.id)
  })

  // Runs last on purpose: it mutates the seed array.
  it('deletes a product and then reports it missing', async () => {
    const page = await get<Paginated<Product>>('/products?pageSize=1&sort=id&order=desc')
    const target = page.items[0]!

    const deleted = await fetch(`http://localhost/api/products/${target.id}`, { method: 'DELETE' })
    expect(deleted.status).toBe(204)

    const missing = await fetch(`http://localhost/api/products/${target.id}`)
    expect(missing.status).toBe(404)
  })

  it('serves the session with permissions', async () => {
    const me = await get<{ permissions: string[] }>('/me')
    expect(me.permissions.length).toBeGreaterThan(0)
  })

  it('serves a dashboard summary with a 14-day series', async () => {
    const summary = await get<{ revenueSeries: unknown[] }>('/dashboard/summary')
    expect(summary.revenueSeries).toHaveLength(14)
  })
})
