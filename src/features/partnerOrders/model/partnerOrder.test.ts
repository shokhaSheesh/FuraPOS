import { describe, expect, it } from 'vitest'
import {
  canCancel,
  canShip,
  lineOutstanding,
  nextStep,
  outstandingUnits,
  statusAfterShipping,
  type PartnerOrderLine,
} from './partnerOrder'

const line = (over: Partial<PartnerOrderLine> = {}): PartnerOrderLine => ({
  id: 'l1',
  variationId: 'var-1-1',
  productId: 'prd-1',
  sku: 'SKU-00001',
  name: 'Timing belt A50',
  imageUrl: null,
  unit: 'pcs',
  orderedQuantity: 20,
  shippedQuantity: 0,
  unitPrice: 1000,
  currency: 'UZS',
  ...over,
})

describe('an order somebody placed with us', () => {
  it('is part shipped until the last unit has gone', () => {
    const half = [line({ shippedQuantity: 8 })]
    expect(outstandingUnits({ lines: half })).toBe(12)
    expect(statusAfterShipping({ lines: half })).toBe('partial')

    const all = [line({ shippedQuantity: 20 })]
    expect(outstandingUnits({ lines: all })).toBe(0)
    expect(statusAfterShipping({ lines: all })).toBe('shipped')
  })

  it('never reads an over-shipment as negative outstanding', () => {
    // Sending more than was asked for is a different order; here it must at
    // least not make the outstanding figure go backwards.
    expect(lineOutstanding(line({ orderedQuantity: 10, shippedQuantity: 14 }))).toBe(0)
  })

  it('offers exactly one step, and shipping is never one of them', () => {
    // Shipping happens as many times as it takes; `partial` and `shipped` are
    // derived from what has gone, never picked from a menu.
    expect(nextStep('new')?.to).toBe('confirmed')
    expect(nextStep('confirmed')).toBeNull()
    expect(nextStep('partial')).toBeNull()
    expect(nextStep('shipped')).toBeNull()
  })

  it('will not ship what has not been accepted, and stops once it all has', () => {
    expect(canShip('new')).toBe(false)
    expect(canShip('confirmed')).toBe(true)
    expect(canShip('partial')).toBe(true)
    expect(canShip('shipped')).toBe(false)
  })

  it('cannot be cancelled once it is closed', () => {
    expect(canCancel('new')).toBe(true)
    // Shipped is terminal from our side: the goods are on their lorry, and
    // what happens next is recorded at their end, not ours.
    expect(canCancel('shipped')).toBe(false)
    expect(canCancel('cancelled')).toBe(false)
  })
})
