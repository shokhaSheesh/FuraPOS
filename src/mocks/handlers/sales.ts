import { delay, http, HttpResponse } from 'msw'
import { api } from './api'
import { clients, locations, sales } from '../seed'
import { matches, paginate } from '../utils'
import type { Sale, SaleDelivery, SaleLine, SaleStatus } from '@/features/sales/model/sale'
import { computeTotals } from '@/features/sales/model/sale'

let sequence = sales.length

/** Shared by the list and the summary so they can never disagree. */
function filterSales(url: URL) {
  const search = url.searchParams.get('search')
  const status = url.searchParams.get('status')
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')

  return sales.filter((sale) => {
    if (status && sale.status !== status) return false
    if (from && sale.createdAt.slice(0, 10) < from) return false
    if (to && sale.createdAt.slice(0, 10) > to) return false
    return matches([sale.number, sale.clientName, sale.locationName, sale.sellerName], search)
  })
}

export const salesHandlers = [
  http.get(api('/clients'), ({ request }) => {
    const url = new URL(request.url)
    const search = url.searchParams.get('search')
    const filtered = clients.filter((client) => matches([client.name, client.phone], search))
    return HttpResponse.json(paginate(filtered, url))
  }),

  http.get(api('/sales'), ({ request }) => {
    const url = new URL(request.url)
    return HttpResponse.json(paginate([...filterSales(url)].reverse(), url))
  }),

  /**
   * The strip above the table. Same filters as the list, so the figures always
   * describe exactly the rows on screen.
   */
  http.get(api('/sales/summary'), ({ request }) => {
    const filtered = filterSales(new URL(request.url))
    const units = filtered.reduce(
      (sum, sale) => sum + sale.lines.reduce((n, line) => n + line.quantity, 0),
      0,
    )
    const withDebt = filtered.filter((sale) => sale.debt > 0)
    const withDelivery = filtered.filter((sale) => sale.delivery)

    return HttpResponse.json({
      count: filtered.length,
      total: filtered.reduce((sum, sale) => sum + sale.total, 0),
      units,
      debtCount: withDebt.length,
      debtTotal: withDebt.reduce((sum, sale) => sum + sale.debt, 0),
      deliveryCount: withDelivery.length,
      deliveryTotal: withDelivery.reduce((sum, sale) => sum + sale.deliveryCost, 0),
      clients: new Set(filtered.map((s) => s.clientId).filter(Boolean)).size,
      sellers: new Set(filtered.map((s) => s.sellerName)).size,
    })
  }),

  http.get(api('/sales/:id'), ({ params }) => {
    const sale = sales.find((item) => item.id === params.id)
    if (!sale) return HttpResponse.json({ message: 'Sale not found' }, { status: 404 })
    return HttpResponse.json(sale)
  }),

  http.patch(api('/sales/:id'), async ({ params, request }) => {
    const sale = sales.find((item) => item.id === params.id)
    if (!sale) return HttpResponse.json({ message: 'Sale not found' }, { status: 404 })

    const patch = (await request.json()) as { status?: SaleStatus; paid?: number }
    await delay(600)

    if (patch.status) sale.status = patch.status
    if (patch.paid !== undefined) sale.paid = Math.min(sale.total, sale.paid + patch.paid)

    sale.debt = Math.max(0, sale.total - sale.paid)
    sale.updatedAt = new Date().toISOString()
    if (sale.status === 'completed' || sale.status === 'delivered') {
      sale.finishedAt = sale.finishedAt ?? new Date().toISOString()
    }

    return HttpResponse.json(sale)
  }),

  http.post(api('/sales'), async ({ request }) => {
    const body = (await request.json()) as {
      clientId: string | null
      locationId: string
      paymentMethod: Sale['paymentMethod']
      comment: string
      channel: Sale['channel']
      paid: number
      lines: SaleLine[]
      delivery: SaleDelivery | null
      expiresAt: string | null
      status: SaleStatus
    }

    if (!body.lines?.length) {
      return HttpResponse.json({ message: 'A sale needs at least one product' }, { status: 422 })
    }

    // Deliberate latency so the in-flight state is visible in development.
    await delay(700)

    const totals = computeTotals(body.lines, body.paid, body.delivery?.cost ?? 0)
    const now = new Date().toISOString()
    const settled = body.status === 'completed' || body.status === 'delivered'
    sequence += 1
    const client = clients.find((c) => c.id === body.clientId)

    const sale: Sale = {
      id: `sale-${sequence}`,
      number: `S-${String(sequence).padStart(5, '0')}`,
      status: body.status,
      clientId: body.clientId,
      clientName: client?.name ?? null,
      locationId: body.locationId,
      locationName: locations.find((l) => l.id === body.locationId)?.name ?? '—',
      sellerName: 'Akhmet Dauletmuratov',
      paymentMethod: body.paymentMethod,
      channel: body.channel,
      comment: body.comment || null,
      lines: body.lines,
      delivery: body.delivery,
      subtotal: totals.subtotal,
      discount: totals.discount,
      deliveryCost: totals.deliveryCost,
      total: totals.total,
      paid: body.paid,
      debt: totals.debt,
      expiresAt: body.expiresAt,
      createdAt: now,
      updatedAt: now,
      finishedAt: settled ? now : null,
    }

    sales.push(sale)
    return HttpResponse.json(sale, { status: 201 })
  }),
]
