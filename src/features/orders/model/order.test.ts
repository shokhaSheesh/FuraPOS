import { describe, expect, it } from 'vitest'
import { useDataStore, type CreateOrderInput } from '@/data/store'
import {
  canCancel,
  canReceive,
  daysLate,
  deliveredRatio,
  lineOutstanding,
  nextStep,
  outstandingUnits,
  type OrderLine,
} from './order'

const line = (over: Partial<OrderLine> = {}): OrderLine => ({
  id: 'l1',
  variationId: 'var-1-1',
  productId: 'prd-1',
  sku: 'SKU-00001',
  name: 'Timing belt A50',
  imageUrl: null,
  unit: 'pcs',
  orderedQuantity: 10,
  receivedQuantity: 0,
  unitCost: 1000,
  costCurrency: 'UZS',
  ...over,
})

const at = (variationId: string, locationId: string) =>
  useDataStore
    .getState()
    .variations.find((v) => v.id === variationId)
    ?.stockByLocation.find((row) => row.locationId === locationId)?.quantity ?? 0

const get = (id: string) => useDataStore.getState().orders.find((o) => o.id === id)!

const raise = (over: Partial<CreateOrderInput> = {}, lines = [line()]) =>
  useDataStore.getState().createOrder({
    supplierId: 'sup-1',
    locationId: 'loc-1',
    expectedAt: null,
    comment: '',
    lines,
    status: 'sent',
    ...over,
  })

describe('what is still coming', () => {
  it('is what was ordered less what has landed', () => {
    expect(lineOutstanding(line({ receivedQuantity: 4 }))).toBe(6)
    expect(lineOutstanding(line({ receivedQuantity: 10 }))).toBe(0)
  })

  it('never goes negative when a supplier over-delivers', () => {
    expect(lineOutstanding(line({ receivedQuantity: 15 }))).toBe(0)
  })

  it('reports progress across the whole order', () => {
    const order = { lines: [line({ receivedQuantity: 5 }), line({ id: 'l2' })] }
    expect(outstandingUnits(order)).toBe(15)
    expect(deliveredRatio(order)).toBe(0.25)
  })
})

describe('lateness', () => {
  const base = { lines: [line()], status: 'sent' as const }

  it('needs a promised date to mean anything', () => {
    expect(daysLate({ ...base, expectedAt: null })).toBeNull()
  })

  it('counts days past the promise', () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 86_400_000).toISOString()
    expect(daysLate({ ...base, expectedAt: tenDaysAgo })).toBe(10)
  })

  it('is not late before the date', () => {
    const soon = new Date(Date.now() + 5 * 86_400_000).toISOString()
    expect(daysLate({ ...base, expectedAt: soon })).toBeNull()
  })

  it('cannot be late once everything has arrived', () => {
    const past = new Date(Date.now() - 30 * 86_400_000).toISOString()
    expect(
      daysLate({ expectedAt: past, status: 'received', lines: [line({ receivedQuantity: 10 })] }),
    ).toBeNull()
  })
})

describe('the lifecycle', () => {
  it('offers one step at a time, and none once it is moving on its own', () => {
    expect(nextStep('draft')?.to).toBe('sent')
    expect(nextStep('sent')?.to).toBe('confirmed')
    // Receiving is a delivery, not a status change, so it is not a "next step".
    expect(nextStep('confirmed')).toBeNull()
    expect(nextStep('partial')).toBeNull()
    expect(nextStep('received')).toBeNull()
  })

  it('will not take a delivery against a draft', () => {
    expect(canReceive('draft')).toBe(false)
    expect(canReceive('sent')).toBe(true)
    expect(canReceive('partial')).toBe(true)
    expect(canReceive('received')).toBe(false)
  })

  it('will not cancel what is finished', () => {
    expect(canCancel('sent')).toBe(true)
    expect(canCancel('received')).toBe(false)
    expect(canCancel('cancelled')).toBe(false)
  })
})

describe('booking a delivery against an order', () => {
  it('creates a real goods receipt and puts the stock on the shelf', () => {
    const before = at('var-1-1', 'loc-1')
    const order = raise()
    const lineId = order.lines[0]!.id

    const result = useDataStore.getState().receiveAgainstOrder(order.id, { [lineId]: 4 }, 'INV-1')
    expect(result.ok).toBe(true)

    expect(at('var-1-1', 'loc-1')).toBe(before + 4)
    // The delivery goes through the ordinary receipt path, so it is a real
    // document rather than a special case.
    const receipt = useDataStore.getState().receipts.find((r) => r.orderId === order.id)!
    expect(receipt.status).toBe('received')
    expect(receipt.invoiceNumber).toBe('INV-1')
    expect(receipt.orderNumber).toBe(order.number)
  })

  it('writes what arrived back onto the order', () => {
    const order = raise()
    const lineId = order.lines[0]!.id
    useDataStore.getState().receiveAgainstOrder(order.id, { [lineId]: 4 }, '')

    const after = get(order.id)
    expect(after.lines[0]!.receivedQuantity).toBe(4)
    expect(outstandingUnits(after)).toBe(6)
    expect(after.status).toBe('partial')
    expect(after.receiptIds).toHaveLength(1)
  })

  it('closes the order once nothing is outstanding', () => {
    const order = raise()
    const lineId = order.lines[0]!.id
    useDataStore.getState().receiveAgainstOrder(order.id, { [lineId]: 6 }, '')
    expect(get(order.id).status).toBe('partial')

    useDataStore.getState().receiveAgainstOrder(order.id, { [lineId]: 4 }, '')
    const done = get(order.id)
    expect(done.status).toBe('received')
    expect(done.closedAt).toBeTruthy()
    expect(done.receiptIds).toHaveLength(2)
  })

  it('never books more than is outstanding', () => {
    const before = at('var-1-1', 'loc-1')
    const order = raise()
    const lineId = order.lines[0]!.id

    // A supplier who over-ships has sent something that was not ordered; it
    // belongs on its own receipt rather than inflating this one.
    useDataStore.getState().receiveAgainstOrder(order.id, { [lineId]: 999 }, '')
    expect(at('var-1-1', 'loc-1')).toBe(before + 10)
    expect(get(order.id).lines[0]!.receivedQuantity).toBe(10)
  })

  it('refuses a delivery against a draft', () => {
    const order = raise({ status: 'draft' })
    const result = useDataStore
      .getState()
      .receiveAgainstOrder(order.id, { [order.lines[0]!.id]: 1 }, '')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/Send the order/)
  })

  it('refuses a delivery of nothing', () => {
    const order = raise()
    const result = useDataStore
      .getState()
      .receiveAgainstOrder(order.id, { [order.lines[0]!.id]: 0 }, '')
    expect(result.ok).toBe(false)
  })

  it('will not cancel an order that has already part-arrived', () => {
    const order = raise()
    useDataStore.getState().receiveAgainstOrder(order.id, { [order.lines[0]!.id]: 3 }, '')

    const result = useDataStore.getState().setOrderStatus(order.id, 'cancelled')
    expect(result.ok).toBe(false)
    // Cancelling would leave stock on a shelf with no order behind it.
    if (!result.ok) expect(result.error).toMatch(/already been delivered/)
  })

  it('cancels cleanly while nothing has arrived', () => {
    const order = raise()
    expect(useDataStore.getState().setOrderStatus(order.id, 'cancelled')).toEqual({ ok: true })
    expect(get(order.id).status).toBe('cancelled')
  })
})
