import { describe, expect, it } from 'vitest'
import { useDataStore } from '@/data/store'
import { accuracy, discrepancies, progress, shortUnits, surplusUnits } from './stocktake'

const at = (variationId: string, locationId: string) =>
  useDataStore
    .getState()
    .variations.find((v) => v.id === variationId)
    ?.stockByLocation.find((row) => row.locationId === locationId)?.quantity ?? 0

const get = (id: string) => useDataStore.getState().stocktakes.find((s) => s.id === id)!

describe('counting progress', () => {
  const sheet = (counted: (number | null)[]) => ({
    lines: counted.map((value, index) => ({
      id: `l${index}`,
      variationId: 'v',
      productId: 'p',
      sku: 's',
      name: 'n',
      imageUrl: null,
      unit: 'pcs',
      categoryId: 'c',
      categoryName: 'C',
      shelfAddress: null,
      expected: 10,
      counted: value,
      unitCost: 100,
      costCurrency: 'UZS' as const,
    })),
  })

  it('counts a line as done only once someone has entered something', () => {
    expect(progress(sheet([10, null, null]))).toEqual({ done: 1, total: 3, ratio: 1 / 3 })
    // Zero is a count. It means "I looked and there are none".
    expect(progress(sheet([0, 0, null]))).toEqual({ done: 2, total: 3, ratio: 2 / 3 })
  })

  it('measures accuracy against counted lines only, never the whole sheet', () => {
    // One counted and right, one counted and wrong, one never counted: 50%,
    // not 33% — an unfinished count must not look like an inaccurate one.
    expect(accuracy(sheet([10, 8, null]))).toBe(0.5)
  })

  it('treats an uncounted line as no variance at all', () => {
    const s = sheet([null, null])
    expect(discrepancies(s)).toHaveLength(0)
    expect(shortUnits(s)).toBe(0)
    expect(surplusUnits(s)).toBe(0)
  })

  it('separates what is missing from what was found', () => {
    const s = sheet([7, 13])
    expect(shortUnits(s)).toBe(3)
    expect(surplusUnits(s)).toBe(3)
  })
})

describe('applying a stocktake', () => {
  const startOne = () =>
    useDataStore
      .getState()
      .startStocktake({ locationId: 'loc-1', categoryId: '', brandId: '', comment: '' })

  it('freezes what the system believes when the sheet is opened', () => {
    const stocktake = startOne()
    const line = stocktake.lines[0]!
    expect(line.expected).toBe(at(line.variationId, 'loc-1'))
    expect(line.counted).toBeNull()
  })

  it('leaves uncounted lines completely alone', () => {
    const stocktake = startOne()
    const [counted, untouched] = stocktake.lines
    const untouchedBefore = at(untouched!.variationId, 'loc-1')

    useDataStore.getState().setStocktakeCount(stocktake.id, counted!.id, counted!.expected - 2)
    const result = useDataStore.getState().applyStocktake(stocktake.id)
    expect(result.ok).toBe(true)

    // The counted one moved; the one nobody reached did not, and was not
    // written off to zero.
    expect(at(counted!.variationId, 'loc-1')).toBe(counted!.expected - 2)
    expect(at(untouched!.variationId, 'loc-1')).toBe(untouchedBefore)
  })

  it('commits its variances as a correction, so one ledger holds everything', () => {
    const stocktake = startOne()
    const line = stocktake.lines[0]!
    useDataStore.getState().setStocktakeCount(stocktake.id, line.id, line.expected - 1)

    const before = useDataStore.getState().corrections.length
    const result = useDataStore.getState().applyStocktake(stocktake.id)
    expect(result.ok).toBe(true)
    expect(useDataStore.getState().corrections).toHaveLength(before + 1)

    const correction = useDataStore.getState().corrections.at(-1)!
    expect(correction.source).toBe('stocktake')
    expect(correction.sourceRef).toBe(stocktake.id)
    expect(get(stocktake.id).correctionId).toBe(correction.id)
  })

  it('refuses to apply when nothing counted disagrees', () => {
    const stocktake = startOne()
    const line = stocktake.lines[0]!
    // Counted, and it matches.
    useDataStore.getState().setStocktakeCount(stocktake.id, line.id, line.expected)
    const result = useDataStore.getState().applyStocktake(stocktake.id)
    expect(result.ok).toBe(false)
  })

  it('does not undo a sale that happened while the aisle was being counted', () => {
    const stocktake = startOne()
    const line = stocktake.lines[0]!
    // Counter sees two fewer than the system said.
    useDataStore.getState().setStocktakeCount(stocktake.id, line.id, line.expected - 2)

    // Meanwhile three are sold, so the shelf is now expected − 3.
    useDataStore.getState().createCorrection({
      locationId: 'loc-1',
      reason: 'other',
      comment: 'sold during the count',
      lines: [
        {
          id: 'x',
          variationId: line.variationId,
          productId: line.productId,
          sku: line.sku,
          name: line.name,
          imageUrl: null,
          unit: line.unit,
          countedBefore: 0,
          countedAfter: line.expected - 3,
          unitCost: 0,
          costCurrency: 'UZS',
        },
      ],
    })

    useDataStore.getState().applyStocktake(stocktake.id)

    // The count found 2 missing, so 2 come off what the shelf holds *now* —
    // it does not get reset to the counted figure, which would resurrect the
    // three that were sold.
    expect(at(line.variationId, 'loc-1')).toBe(line.expected - 5)
  })

  it('cannot be applied twice', () => {
    const stocktake = startOne()
    const line = stocktake.lines[0]!
    useDataStore.getState().setStocktakeCount(stocktake.id, line.id, line.expected - 1)
    useDataStore.getState().applyStocktake(stocktake.id)
    expect(useDataStore.getState().applyStocktake(stocktake.id).ok).toBe(false)
  })

  it('abandons without touching stock', () => {
    const stocktake = startOne()
    const line = stocktake.lines[0]!
    const before = at(line.variationId, 'loc-1')
    useDataStore.getState().setStocktakeCount(stocktake.id, line.id, 0)

    expect(useDataStore.getState().cancelStocktake(stocktake.id)).toEqual({ ok: true })
    expect(at(line.variationId, 'loc-1')).toBe(before)
    expect(get(stocktake.id).status).toBe('cancelled')
  })

  it('will not abandon a count that has already been applied', () => {
    const stocktake = startOne()
    const line = stocktake.lines[0]!
    useDataStore.getState().setStocktakeCount(stocktake.id, line.id, line.expected - 1)
    useDataStore.getState().applyStocktake(stocktake.id)
    const result = useDataStore.getState().cancelStocktake(stocktake.id)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/reverse its correction/)
  })
})
