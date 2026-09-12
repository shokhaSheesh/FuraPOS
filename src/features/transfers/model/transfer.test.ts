import { beforeEach, describe, expect, it } from 'vitest'
import { useDataStore } from '@/data/store'
import {
  lineShortfall,
  lineUnfulfilled,
  nextStep,
  transferDraftSchema,
  transferInTransit,
  transferQuantity,
  transferShortfall,
} from './transfer'

const LINE = {
  id: 'l1',
  variationId: 'var-1-1',
  productId: 'prd-1',
  sku: 'SKU-00001',
  name: 'Timing belt A50',
  imageUrl: null,
  unit: 'pcs',
  requestedQuantity: 3,
  sentQuantity: null,
  receivedQuantity: null,
  unitCost: 85,
  costCurrency: 'USD' as const,
  unitPrice: 1_476_000,
}

/** What one location holds of one variation, read back from the store. */
const at = (variationId: string, locationId: string) =>
  useDataStore
    .getState()
    .variations.find((v) => v.id === variationId)
    ?.stockByLocation.find((row) => row.locationId === locationId)?.quantity ?? 0

/** The variation's total, which must always equal the sum of its locations. */
const total = (variationId: string) =>
  useDataStore.getState().variations.find((v) => v.id === variationId)?.stock ?? 0

const sumOfLocations = (variationId: string) =>
  useDataStore
    .getState()
    .variations.find((v) => v.id === variationId)
    ?.stockByLocation.reduce((sum, row) => sum + row.quantity, 0) ?? 0

describe('transfer lifecycle', () => {
  it('offers exactly one next step, and none from a terminal state', () => {
    expect(nextStep('draft')?.to).toBe('in_transit')
    expect(nextStep('in_transit')?.to).toBe('received')
    expect(nextStep('received')).toBeNull()
    expect(nextStep('cancelled')).toBeNull()
  })

  it('counts units, not lines', () => {
    expect(transferQuantity({ lines: [LINE, { ...LINE, id: 'l2', requestedQuantity: 4 }] })).toBe(7)
  })

  it('reports the most concrete quantity it has for a line', () => {
    // Ordered until it ships, shipped until it lands, then what actually landed.
    expect(transferQuantity({ lines: [LINE] })).toBe(3)
    expect(transferQuantity({ lines: [{ ...LINE, sentQuantity: 2 }] })).toBe(2)
    expect(transferQuantity({ lines: [{ ...LINE, sentQuantity: 2, receivedQuantity: 1 }] })).toBe(1)
  })

  it('separates what the warehouse could not find from what went missing', () => {
    const line = { ...LINE, requestedQuantity: 10, sentQuantity: 7, receivedQuantity: 6 }
    expect(lineUnfulfilled(line)).toBe(3)
    expect(lineShortfall(line)).toBe(1)
    // Nothing is "in transit" once the far end has counted: the missing unit
    // is a loss, not a parcel still travelling.
    expect(transferInTransit({ lines: [line] })).toBe(0)
    expect(transferShortfall({ lines: [line] })).toBe(1)
    expect(transferInTransit({ lines: [{ ...LINE, sentQuantity: 7 }] })).toBe(7)
  })
})

describe('transfer validation', () => {
  const draft = {
    kind: 'send' as const,
    fromLocationId: 'loc-1',
    toLocationId: 'loc-2',
    comment: '',
    lines: [LINE],
  }

  it('accepts a transfer between two different places', () => {
    expect(transferDraftSchema.safeParse(draft).success).toBe(true)
  })

  it('refuses a transfer to where it already is', () => {
    const result = transferDraftSchema.safeParse({ ...draft, toLocationId: 'loc-1' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['toLocationId'])
  })

  it('refuses a transfer with nothing on it', () => {
    expect(transferDraftSchema.safeParse({ ...draft, lines: [] }).success).toBe(false)
  })
})

describe('moving stock', () => {
  let startAtSource = 0

  // Read the shelf fresh before each case: earlier cases move stock, and the
  // store is shared, so a hard-coded starting quantity would be a lie.
  beforeEach(() => {
    startAtSource = at('var-1-1', 'loc-1')
  })

  it('takes stock off the source when sent, and does not add it anywhere yet', () => {
    const store = useDataStore.getState()
    const startAtDestination = at('var-1-1', 'loc-2')
    const startTotal = total('var-1-1')

    const transfer = store.createTransfer({
      kind: 'send',
      fromLocationId: 'loc-1',
      toLocationId: 'loc-2',
      comment: '',
      lines: [{ ...LINE, requestedQuantity: 2 }],
      status: 'in_transit',
    })

    expect(transfer.status).toBe('in_transit')
    expect(at('var-1-1', 'loc-1')).toBe(startAtSource - 2)
    // The whole point: in transit is on neither shelf.
    expect(at('var-1-1', 'loc-2')).toBe(startAtDestination)
    expect(total('var-1-1')).toBe(startTotal - 2)
  })

  it('lands the stock at the destination on receipt', () => {
    const store = useDataStore.getState()
    const startAtDestination = at('var-1-1', 'loc-2')
    const startTotal = total('var-1-1')

    const transfer = store.createTransfer({
      kind: 'send',
      fromLocationId: 'loc-1',
      toLocationId: 'loc-2',
      comment: '',
      lines: [{ ...LINE, requestedQuantity: 2 }],
      status: 'in_transit',
    })
    expect(useDataStore.getState().setTransferStatus(transfer.id, 'received')).toEqual({ ok: true })

    expect(at('var-1-1', 'loc-2')).toBe(startAtDestination + 2)
    // A transfer moves stock, it never creates or destroys it.
    expect(total('var-1-1')).toBe(startTotal)
    expect(sumOfLocations('var-1-1')).toBe(total('var-1-1'))
  })

  it('refuses to send more than the source actually holds', () => {
    const store = useDataStore.getState()
    const transfer = store.createTransfer({
      kind: 'send',
      fromLocationId: 'loc-1',
      toLocationId: 'loc-2',
      comment: '',
      lines: [{ ...LINE, requestedQuantity: startAtSource + 1 }],
      status: 'draft',
    })

    const result = useDataStore.getState().setTransferStatus(transfer.id, 'in_transit')
    expect(result.ok).toBe(false)
    // The message has to name the product, or it is not actionable.
    if (!result.ok) expect(result.error).toContain(LINE.name)
    // And nothing moved.
    expect(at('var-1-1', 'loc-1')).toBe(startAtSource)
  })

  it('puts the stock back when a sent transfer is cancelled', () => {
    const store = useDataStore.getState()
    const transfer = store.createTransfer({
      kind: 'send',
      fromLocationId: 'loc-1',
      toLocationId: 'loc-2',
      comment: '',
      lines: [{ ...LINE, requestedQuantity: 2 }],
      status: 'in_transit',
    })
    expect(at('var-1-1', 'loc-1')).toBe(startAtSource - 2)

    useDataStore.getState().setTransferStatus(transfer.id, 'cancelled')
    expect(at('var-1-1', 'loc-1')).toBe(startAtSource)
  })

  it('changes no stock when a draft is cancelled', () => {
    const store = useDataStore.getState()
    const startTotal = total('var-1-1')
    const transfer = store.createTransfer({
      kind: 'send',
      fromLocationId: 'loc-1',
      toLocationId: 'loc-2',
      comment: '',
      lines: [{ ...LINE, requestedQuantity: 2 }],
      status: 'draft',
    })

    useDataStore.getState().setTransferStatus(transfer.id, 'cancelled')
    expect(at('var-1-1', 'loc-1')).toBe(startAtSource)
    expect(total('var-1-1')).toBe(startTotal)
  })

  it('will not receive a transfer that was never sent', () => {
    const store = useDataStore.getState()
    const transfer = store.createTransfer({
      kind: 'send',
      fromLocationId: 'loc-1',
      toLocationId: 'loc-2',
      comment: '',
      lines: [{ ...LINE, requestedQuantity: 1 }],
      status: 'draft',
    })
    const result = useDataStore.getState().setTransferStatus(transfer.id, 'received')
    expect(result.ok).toBe(false)
  })

  it('keeps the nested product and the flat catalogue row in step', () => {
    const store = useDataStore.getState()
    store.createTransfer({
      kind: 'send',
      fromLocationId: 'loc-1',
      toLocationId: 'loc-3',
      comment: '',
      lines: [{ ...LINE, requestedQuantity: 1 }],
      status: 'in_transit',
    })

    const nested = useDataStore
      .getState()
      .products.find((p) => p.id === 'prd-1')
      ?.variations.find((v) => v.id === 'var-1-1')
    const flat = useDataStore.getState().variations.find((v) => v.id === 'var-1-1')

    expect(nested?.stock).toBe(flat?.stock)
    expect(nested?.stockByLocation.find((r) => r.locationId === 'loc-1')?.quantity).toBe(
      flat?.stockByLocation.find((r) => r.locationId === 'loc-1')?.quantity,
    )
  })
})

describe('partial fulfilment', () => {
  it('sends only what the warehouse says it found, leaving the rest on the shelf', () => {
    const store = useDataStore.getState()
    const startAtSource = at('var-1-1', 'loc-1')
    const transfer = store.createTransfer({
      kind: 'send',
      fromLocationId: 'loc-1',
      toLocationId: 'loc-2',
      comment: '',
      lines: [{ ...LINE, requestedQuantity: 5 }],
      status: 'draft',
    })

    const lineId = transfer.lines[0]!.id
    useDataStore.getState().setTransferStatus(transfer.id, 'in_transit', { [lineId]: 3 })

    // Only 3 left; the other 2 never moved.
    expect(at('var-1-1', 'loc-1')).toBe(startAtSource - 3)
    const sent = useDataStore.getState().transfers.find((t) => t.id === transfer.id)!
    expect(sent.lines[0]!.sentQuantity).toBe(3)
    expect(lineUnfulfilled(sent.lines[0]!)).toBe(2)
  })

  it('writes off what was sent and never arrived', () => {
    const store = useDataStore.getState()
    const startTotal = total('var-1-1')
    const startAtDestination = at('var-1-1', 'loc-2')

    const transfer = store.createTransfer({
      kind: 'send',
      fromLocationId: 'loc-1',
      toLocationId: 'loc-2',
      comment: '',
      lines: [{ ...LINE, requestedQuantity: 4 }],
      status: 'in_transit',
    })
    const lineId = transfer.lines[0]!.id
    useDataStore.getState().setTransferStatus(transfer.id, 'received', { [lineId]: 3 })

    // Three landed, one is gone: total stock is down by exactly the shortfall.
    expect(at('var-1-1', 'loc-2')).toBe(startAtDestination + 3)
    expect(total('var-1-1')).toBe(startTotal - 1)

    const done = useDataStore.getState().transfers.find((t) => t.id === transfer.id)!
    expect(transferShortfall(done)).toBe(1)
    expect(transferInTransit(done)).toBe(0)
  })

  it('cannot receive more than was sent', () => {
    const store = useDataStore.getState()
    const transfer = store.createTransfer({
      kind: 'send',
      fromLocationId: 'loc-1',
      toLocationId: 'loc-2',
      comment: '',
      lines: [{ ...LINE, requestedQuantity: 2 }],
      status: 'in_transit',
    })
    const lineId = transfer.lines[0]!.id
    useDataStore.getState().setTransferStatus(transfer.id, 'received', { [lineId]: 99 })

    const done = useDataStore.getState().transfers.find((t) => t.id === transfer.id)!
    expect(done.lines[0]!.receivedQuantity).toBe(2)
  })

  it('records who sent and who received', () => {
    const store = useDataStore.getState()
    const transfer = store.createTransfer({
      kind: 'send',
      fromLocationId: 'loc-1',
      toLocationId: 'loc-2',
      comment: '',
      lines: [{ ...LINE, requestedQuantity: 1 }],
      status: 'draft',
    })
    expect(transfer.sentBy).toBeNull()

    useDataStore.getState().setTransferStatus(transfer.id, 'in_transit')
    expect(useDataStore.getState().transfers.find((t) => t.id === transfer.id)!.sentBy).toBeTruthy()

    useDataStore.getState().setTransferStatus(transfer.id, 'received')
    const done = useDataStore.getState().transfers.find((t) => t.id === transfer.id)!
    expect(done.receivedBy).toBeTruthy()
  })
})
