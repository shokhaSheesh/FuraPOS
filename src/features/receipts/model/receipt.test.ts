import { describe, expect, it } from 'vitest'
import { useDataStore } from '@/data/store'
import { USD_RATE } from '@/data/seed'
import {
  landedTotal,
  landedUnitCost,
  landedUplift,
  receiptShortfall,
  retailValue,
  soldThrough,
  supplierTotal,
  type ReceiptLine,
} from './receipt'

const line = (over: Partial<ReceiptLine> = {}): ReceiptLine => ({
  id: 'l1',
  variationId: 'var-1-1',
  productId: 'prd-1',
  sku: 'SKU-00001',
  name: 'Timing belt A50',
  imageUrl: null,
  unit: 'pcs',
  orderedQuantity: 10,
  receivedQuantity: null,
  unitCost: 100,
  costCurrency: 'UZS',
  ...over,
})

const at = (variationId: string, locationId: string) =>
  useDataStore
    .getState()
    .variations.find((v) => v.id === variationId)
    ?.stockByLocation.find((row) => row.locationId === locationId)?.quantity ?? 0

const costOf = (variationId: string) => {
  const row = useDataStore.getState().variations.find((v) => v.id === variationId)!
  return { cost: row.costPrice, currency: row.costCurrency }
}

describe('landed cost', () => {
  it('is just the supplier price when there are no extras', () => {
    const receipt = { lines: [line()], additionalCosts: [] }
    expect(landedUnitCost(receipt.lines[0]!, receipt, USD_RATE)).toBe(100)
    expect(landedUplift(receipt, USD_RATE)).toBe(0)
  })

  it('spreads extras across lines in proportion to their value', () => {
    // Line A is 1000 of the 2000 goods value, line B is the other 1000, so a
    // 400 freight bill splits 200/200 — but over different quantities, so the
    // per-unit effect is not the same.
    const receipt = {
      lines: [
        line({ id: 'a', orderedQuantity: 10, unitCost: 100 }),
        line({ id: 'b', variationId: 'var-2-1', orderedQuantity: 5, unitCost: 200 }),
      ],
      additionalCosts: [{ id: 'c1', label: 'Freight', amount: 400, currency: 'UZS' as const }],
    }

    expect(supplierTotal(receipt, USD_RATE)).toBe(2000)
    expect(landedTotal(receipt, USD_RATE)).toBe(2400)
    expect(landedUplift(receipt, USD_RATE)).toBeCloseTo(0.2)

    expect(landedUnitCost(receipt.lines[0]!, receipt, USD_RATE)).toBeCloseTo(120) // 100 + 200/10
    expect(landedUnitCost(receipt.lines[1]!, receipt, USD_RATE)).toBeCloseTo(240) // 200 + 200/5
  })

  it("adds up: every unit's landed cost times its quantity equals the landed total", () => {
    const receipt = {
      lines: [
        line({ id: 'a', orderedQuantity: 7, unitCost: 85, costCurrency: 'USD' as const }),
        line({ id: 'b', variationId: 'var-2-1', orderedQuantity: 3, unitCost: 250_000 }),
      ],
      additionalCosts: [
        { id: 'c1', label: 'Freight', amount: 500, currency: 'USD' as const },
        { id: 'c2', label: 'Duty', amount: 1_000_000, currency: 'UZS' as const },
      ],
    }
    const spread = receipt.lines.reduce(
      (sum, l) => sum + landedUnitCost(l, receipt, USD_RATE) * l.orderedQuantity,
      0,
    )
    // Nothing is created or lost in the allocation.
    expect(spread).toBeCloseTo(landedTotal(receipt, USD_RATE), 6)
  })

  it('converts a USD invoice at the rate before spreading anything', () => {
    const receipt = {
      lines: [line({ unitCost: 100, costCurrency: 'USD' as const })],
      additionalCosts: [],
    }
    expect(landedUnitCost(receipt.lines[0]!, receipt, USD_RATE)).toBe(100 * USD_RATE)
  })

  it('spreads over what arrived, not over what was invoiced', () => {
    // Freight was paid on ten; only five turned up. Those five carry the lot.
    const receipt = {
      lines: [line({ orderedQuantity: 10, receivedQuantity: 5, unitCost: 100 })],
      additionalCosts: [{ id: 'c1', label: 'Freight', amount: 500, currency: 'UZS' as const }],
    }
    expect(landedUnitCost(receipt.lines[0]!, receipt, USD_RATE)).toBe(200) // 100 + 500/5
    expect(receiptShortfall(receipt)).toBe(5)
  })
})

describe('posting a receipt', () => {
  it('lands the stock and sets the cost to what it actually cost', () => {
    const store = useDataStore.getState()
    const startHere = at('var-1-1', 'loc-1')

    const receipt = store.createReceipt({
      supplierId: 'sup-1',
      invoiceNumber: 'INV-1',
      locationId: 'loc-1',
      comment: '',
      lines: [line({ orderedQuantity: 10, unitCost: 1000, costCurrency: 'UZS' })],
      additionalCosts: [{ id: 'c1', label: 'Freight', amount: 2000, currency: 'UZS' }],
      status: 'received',
    })

    expect(receipt.status).toBe('received')
    expect(at('var-1-1', 'loc-1')).toBe(startHere + 10)
    // 10 000 of goods plus 2 000 of freight over ten units = 1 200 each.
    expect(costOf('var-1-1')).toEqual({ cost: 1200, currency: 'UZS' })
  })

  it('lands only what was counted off the truck', () => {
    const store = useDataStore.getState()
    const startHere = at('var-1-1', 'loc-2')

    const receipt = store.createReceipt({
      supplierId: 'sup-1',
      invoiceNumber: '',
      locationId: 'loc-2',
      comment: '',
      lines: [line({ orderedQuantity: 8 })],
      additionalCosts: [],
      status: 'draft',
    })
    const lineId = receipt.lines[0]!.id
    useDataStore.getState().setReceiptStatus(receipt.id, 'received', { [lineId]: 6 })

    expect(at('var-1-1', 'loc-2')).toBe(startHere + 6)
    const posted = useDataStore.getState().receipts.find((r) => r.id === receipt.id)!
    expect(receiptShortfall(posted)).toBe(2)
  })

  it('takes the stock back when a posted receipt is cancelled', () => {
    const store = useDataStore.getState()
    const startHere = at('var-1-1', 'loc-3')

    const receipt = store.createReceipt({
      supplierId: null,
      invoiceNumber: '',
      locationId: 'loc-3',
      comment: '',
      lines: [line({ orderedQuantity: 4 })],
      additionalCosts: [],
      status: 'received',
    })
    expect(at('var-1-1', 'loc-3')).toBe(startHere + 4)

    expect(useDataStore.getState().setReceiptStatus(receipt.id, 'cancelled')).toEqual({ ok: true })
    expect(at('var-1-1', 'loc-3')).toBe(startHere)
  })

  it('refuses to cancel a receipt whose goods have already left', () => {
    const store = useDataStore.getState()
    const receipt = store.createReceipt({
      supplierId: null,
      invoiceNumber: '',
      locationId: 'loc-3',
      comment: '',
      lines: [line({ variationId: 'var-2-1', orderedQuantity: 3 })],
      additionalCosts: [],
      status: 'received',
    })

    // Sell them on by writing the shelf down to nothing.
    useDataStore.getState().createCorrection({
      locationId: 'loc-3',
      reason: 'other',
      comment: 'shipped out',
      lines: [
        {
          id: 'x',
          variationId: 'var-2-1',
          productId: 'prd-2',
          sku: 'x',
          name: 'x',
          imageUrl: null,
          unit: 'pcs',
          countedBefore: 0,
          countedAfter: 0,
          unitCost: 0,
          costCurrency: 'UZS',
        },
      ],
    })

    const result = useDataStore.getState().setReceiptStatus(receipt.id, 'cancelled')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/correct it instead/)
  })

  it('will not post the same receipt twice', () => {
    const store = useDataStore.getState()
    const receipt = store.createReceipt({
      supplierId: null,
      invoiceNumber: '',
      locationId: 'loc-1',
      comment: '',
      lines: [line({ orderedQuantity: 1 })],
      additionalCosts: [],
      status: 'received',
    })
    expect(useDataStore.getState().setReceiptStatus(receipt.id, 'received').ok).toBe(false)
  })

  it('keeps the nested product and the flat catalogue row in step', () => {
    useDataStore.getState().createReceipt({
      supplierId: null,
      invoiceNumber: '',
      locationId: 'loc-1',
      comment: '',
      lines: [line({ orderedQuantity: 5 })],
      additionalCosts: [],
      status: 'received',
    })

    const nested = useDataStore
      .getState()
      .products.find((p) => p.id === 'prd-1')
      ?.variations.find((v) => v.id === 'var-1-1')
    const flat = useDataStore.getState().variations.find((v) => v.id === 'var-1-1')

    expect(nested?.stock).toBe(flat?.stock)
    expect(nested?.costPrice).toBe(flat?.costPrice)
  })
})

describe('sell-through', () => {
  const posted = (over: Partial<ReceiptLine> = {}) => ({
    status: 'received' as const,
    locationId: 'loc-1',
    lines: [line({ orderedQuantity: 10, receivedQuantity: 10, ...over })],
  })

  it('is zero while none of it has moved', () => {
    expect(soldThrough(posted(), () => 10)).toEqual({ received: 10, sold: 0, ratio: 0 })
  })

  it('reads the shelf to work out what has gone', () => {
    expect(soldThrough(posted(), () => 4)).toEqual({ received: 10, sold: 6, ratio: 0.6 })
    expect(soldThrough(posted(), () => 0)).toEqual({ received: 10, sold: 10, ratio: 1 })
  })

  it('never exceeds what was received, however much is on the shelf', () => {
    // A later delivery has restocked past this one; sell-through cannot go
    // negative, and this is exactly the case where the estimate understates.
    expect(soldThrough(posted(), () => 400)).toEqual({ received: 10, sold: 0, ratio: 0 })
  })

  it('says nothing about a receipt that was never posted', () => {
    const draft = { status: 'draft' as const, locationId: 'loc-1', lines: [line()] }
    expect(soldThrough(draft, () => 0)).toEqual({ received: 0, sold: 0, ratio: 0 })
  })
})

describe('retail value', () => {
  it('prices the delivery at what we sell it for, not what we paid', () => {
    const receipt = { lines: [line({ orderedQuantity: 4 }), line({ id: 'b', orderedQuantity: 6 })] }
    expect(retailValue(receipt, () => 1_000)).toBe(10_000)
  })
})
