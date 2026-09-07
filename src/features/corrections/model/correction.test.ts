import { describe, expect, it } from 'vitest'
import { useDataStore } from '@/data/store'
import {
  correctionDraftSchema,
  netUnits,
  writtenOff,
  writtenOn,
  type CorrectionLine,
} from './correction'

const line = (over: Partial<CorrectionLine> = {}): CorrectionLine => ({
  id: 'l1',
  variationId: 'var-1-1',
  productId: 'prd-1',
  sku: 'SKU-00001',
  name: 'Timing belt A50',
  imageUrl: null,
  unit: 'pcs',
  countedBefore: 10,
  countedAfter: 8,
  unitCost: 85,
  costCurrency: 'USD',
  ...over,
})

const at = (variationId: string, locationId: string) =>
  useDataStore
    .getState()
    .variations.find((v) => v.id === variationId)
    ?.stockByLocation.find((row) => row.locationId === locationId)?.quantity ?? 0

const total = (variationId: string) =>
  useDataStore.getState().variations.find((v) => v.id === variationId)?.stock ?? 0

describe('correction arithmetic', () => {
  it('keeps write-offs and write-ons apart rather than only netting them', () => {
    // A recount that loses two of one part and finds two of another is not the
    // same event as one where nothing happened.
    const mixed = { lines: [line({ countedAfter: 8 }), line({ id: 'l2', countedAfter: 12 })] }
    expect(netUnits(mixed)).toBe(0)
    expect(writtenOff(mixed)).toBe(2)
    expect(writtenOn(mixed)).toBe(2)
  })

  it('reads a shortfall as negative and a surplus as positive', () => {
    expect(netUnits({ lines: [line({ countedAfter: 7 })] })).toBe(-3)
    expect(netUnits({ lines: [line({ countedAfter: 14 })] })).toBe(4)
  })
})

describe('correction validation', () => {
  const draft = {
    locationId: 'loc-1',
    reason: 'damaged' as const,
    comment: '',
    lines: [line()],
  }

  it('accepts a correction that actually changes something', () => {
    expect(correctionDraftSchema.safeParse(draft).success).toBe(true)
  })

  it('refuses a correction where every count matches', () => {
    const result = correctionDraftSchema.safeParse({
      ...draft,
      lines: [line({ countedBefore: 10, countedAfter: 10 })],
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toMatch(/Nothing has changed/)
  })

  it('refuses a negative count', () => {
    expect(
      correctionDraftSchema.safeParse({ ...draft, lines: [line({ countedAfter: -1 })] }).success,
    ).toBe(false)
  })

  it('refuses a correction with no lines', () => {
    expect(correctionDraftSchema.safeParse({ ...draft, lines: [] }).success).toBe(false)
  })
})

describe('applying a correction', () => {
  it('sets the shelf to what was counted, not to what the form thought', () => {
    const store = useDataStore.getState()
    const startHere = at('var-1-1', 'loc-1')
    const startTotal = total('var-1-1')

    store.createCorrection({
      locationId: 'loc-1',
      reason: 'damaged',
      comment: '',
      // countedBefore is deliberately stale — the store must ignore it and
      // read the live figure, or a correction would silently undo whatever
      // happened between opening the screen and saving.
      lines: [line({ countedBefore: 999, countedAfter: startHere - 2 })],
    })

    expect(at('var-1-1', 'loc-1')).toBe(startHere - 2)
    expect(total('var-1-1')).toBe(startTotal - 2)
  })

  it('records what the system believed at the moment it was written', () => {
    const store = useDataStore.getState()
    const startHere = at('var-1-1', 'loc-2')

    const correction = store.createCorrection({
      locationId: 'loc-2',
      reason: 'found',
      comment: '',
      lines: [line({ countedBefore: 0, countedAfter: startHere + 3 })],
    })

    expect(correction.lines[0]!.countedBefore).toBe(startHere)
    expect(at('var-1-1', 'loc-2')).toBe(startHere + 3)
  })

  it('reverses cleanly, and keeps both entries in the history', () => {
    const store = useDataStore.getState()
    const startHere = at('var-1-1', 'loc-1')

    const correction = store.createCorrection({
      locationId: 'loc-1',
      reason: 'theft',
      comment: '',
      lines: [line({ countedAfter: startHere - 4 })],
    })
    expect(at('var-1-1', 'loc-1')).toBe(startHere - 4)

    expect(useDataStore.getState().cancelCorrection(correction.id)).toEqual({ ok: true })
    expect(at('var-1-1', 'loc-1')).toBe(startHere)

    const stored = useDataStore.getState().corrections.find((c) => c.id === correction.id)!
    expect(stored.status).toBe('cancelled')
    // Reversed, not deleted.
    expect(stored.lines[0]!.countedAfter).toBe(startHere - 4)
  })

  it('will not reverse the same correction twice', () => {
    const store = useDataStore.getState()
    const correction = store.createCorrection({
      locationId: 'loc-1',
      reason: 'lost',
      comment: '',
      lines: [line({ countedAfter: at('var-1-1', 'loc-1') - 1 })],
    })
    useDataStore.getState().cancelCorrection(correction.id)
    const second = useDataStore.getState().cancelCorrection(correction.id)
    expect(second.ok).toBe(false)
  })

  it('keeps the nested product and the flat catalogue row in step', () => {
    const store = useDataStore.getState()
    store.createCorrection({
      locationId: 'loc-3',
      reason: 'miscount',
      comment: '',
      lines: [line({ countedAfter: at('var-1-1', 'loc-3') + 5 })],
    })

    const nested = useDataStore
      .getState()
      .products.find((p) => p.id === 'prd-1')
      ?.variations.find((v) => v.id === 'var-1-1')
    const flat = useDataStore.getState().variations.find((v) => v.id === 'var-1-1')

    expect(nested?.stock).toBe(flat?.stock)
    expect(nested?.stockByLocation.find((r) => r.locationId === 'loc-3')?.quantity).toBe(
      flat?.stockByLocation.find((r) => r.locationId === 'loc-3')?.quantity,
    )
  })
})
