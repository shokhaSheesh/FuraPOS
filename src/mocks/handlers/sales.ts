import { delay, http, HttpResponse } from 'msw'
import { api } from './api'
import { clients, locations, sales } from '../seed'
import { matches, paginate } from '../utils'
import type { Sale, SaleLine } from '@/features/sales/model/sale'
import { computeTotals } from '@/features/sales/model/sale'

let sequence = sales.length

export const salesHandlers = [
  http.get(api('/clients'), ({ request }) => {
    const url = new URL(request.url)
    const search = url.searchParams.get('search')
    const filtered = clients.filter((client) => matches([client.name, client.phone], search))
    return HttpResponse.json(paginate(filtered, url))
  }),

  http.get(api('/sales'), ({ request }) => {
    const url = new URL(request.url)
    const search = url.searchParams.get('search')
    const status = url.searchParams.get('status')

    const filtered = sales.filter((sale) => {
      if (status && sale.status !== status) return false
      return matches([sale.number, sale.clientName, sale.locationName], search)
    })

    return HttpResponse.json(paginate([...filtered].reverse(), url))
  }),

  http.get(api('/sales/:id'), ({ params }) => {
    const sale = sales.find((item) => item.id === params.id)
    if (!sale) return HttpResponse.json({ message: 'Sale not found' }, { status: 404 })
    return HttpResponse.json(sale)
  }),

  http.post(api('/sales'), async ({ request }) => {
    const body = (await request.json()) as {
      clientId: string | null
      locationId: string
      paymentMethod: Sale['paymentMethod']
      comment: string
      paid: number
      lines: SaleLine[]
      status: 'draft' | 'completed' | 'postponed'
    }

    if (!body.lines?.length) {
      return HttpResponse.json({ message: 'A sale needs at least one product' }, { status: 422 })
    }

    // Deliberate latency so the in-flight state is visible in development.
    await delay(700)

    const totals = computeTotals(body.lines, body.paid)
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
      comment: body.comment || null,
      lines: body.lines,
      subtotal: totals.subtotal,
      discount: totals.discount,
      total: totals.total,
      paid: body.paid,
      debt: totals.debt,
      createdAt: new Date().toISOString(),
    }

    sales.push(sale)
    return HttpResponse.json(sale, { status: 201 })
  }),
]
