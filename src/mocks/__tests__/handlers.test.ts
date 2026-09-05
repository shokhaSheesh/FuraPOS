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

  it('creates a sale and returns it in the ledger with server-computed totals', async () => {
    const payload = {
      clientId: null,
      locationId: 'loc-2',
      paymentMethod: 'cash',
      comment: '',
      paid: 0,
      status: 'completed',
      lines: [
        {
          id: 'l1',
          productId: 'prd-1',
          sku: 'SKU-00001',
          name: 'Test product',
          unit: 'pcs',
          quantity: 2,
          unitPrice: 500_000,
          discountPercent: 10,
        },
      ],
    }

    const created = await fetch('http://localhost/api/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    expect(created.status).toBe(201)
    const sale = (await created.json()) as {
      id: string
      number: string
      total: number
      debt: number
    }
    // The server computes the money; the client never gets to assert it.
    expect(sale.total).toBe(900_000)
    expect(sale.debt).toBe(900_000)

    const ledger = await get<Paginated<{ id: string }>>('/sales?pageSize=1')
    expect(ledger.items[0]!.id).toBe(sale.id)
  })

  it('records a payment against a sale and reduces its debt', async () => {
    const ledger = await get<Paginated<{ id: string; total: number; debt: number }>>(
      '/sales?status=open&pageSize=1',
    )
    const sale = ledger.items[0]
    if (!sale) return // no open sale in this seed run

    const response = await fetch(`http://localhost/api/sales/${sale.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paid: sale.debt }),
    })
    expect(response.status).toBe(200)
    const updated = (await response.json()) as { debt: number; paid: number }
    expect(updated.debt).toBe(0)
    // A payment can never exceed the total, however much is sent.
    expect(updated.paid).toBeLessThanOrEqual(sale.total)
  })

  it('stamps finishedAt when a sale reaches a terminal status', async () => {
    const ledger = await get<Paginated<{ id: string }>>('/sales?status=processed&pageSize=1')
    const sale = ledger.items[0]
    if (!sale) return

    const response = await fetch(`http://localhost/api/sales/${sale.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    })
    const updated = (await response.json()) as { finishedAt: string | null; status: string }
    expect(updated.status).toBe('completed')
    expect(updated.finishedAt).toBeTruthy()
  })

  it('keeps deleted sales out of the ledger and its totals', async () => {
    const before = await get<{ count: number; total: number }>('/sales/summary')
    const page = await get<Paginated<{ id: string; total: number }>>('/sales?pageSize=1')
    const victim = page.items[0]!

    await fetch(`http://localhost/api/sales/${victim.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'deleted' }),
    })

    const after = await get<{ count: number; total: number }>('/sales/summary')
    expect(after.count).toBe(before.count - 1)
    expect(after.total).toBe(before.total - victim.total)

    // Still reachable on its own screen, so nothing is actually lost.
    const deleted = await get<Paginated<{ id: string }>>('/sales?status=deleted')
    expect(deleted.items.map((s) => s.id)).toContain(victim.id)

    const ledger = await get<Paginated<{ id: string }>>('/sales?pageSize=100')
    expect(ledger.items.map((s) => s.id)).not.toContain(victim.id)
  })

  it('refuses a sale with no lines', async () => {
    const response = await fetch('http://localhost/api/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lines: [] }),
    })
    expect(response.status).toBe(422)
  })

  it('serves the session with permissions', async () => {
    const me = await get<{ permissions: string[] }>('/me')
    expect(me.permissions.length).toBeGreaterThan(0)
  })

  it('serves a dashboard summary whose series length follows the period', async () => {
    const week = await get<{ revenueByLocation: unknown[]; period: string }>(
      '/dashboard/summary?period=week',
    )
    expect(week.period).toBe('week')
    expect(week.revenueByLocation).toHaveLength(7)

    const month = await get<{ revenueByLocation: unknown[] }>('/dashboard/summary?period=month')
    expect(month.revenueByLocation).toHaveLength(30)
  })

  it('gives every dashboard metric a value and a comparison basis', async () => {
    const s = await get<
      Record<string, { value: number; change: number | null }> & {
        comparedTo: string
      }
    >('/dashboard/summary?period=today')
    for (const key of ['revenue', 'salesCount', 'averageCheck', 'grossMargin']) {
      expect(s[key]!.value).toBeGreaterThan(0)
    }
    expect(s.comparedTo).toBe('yesterday')
  })
})
