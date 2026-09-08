import { describe, expect, it } from 'vitest'
import { describeReport, runReport, type SourceRow, type ReportDefinition } from './report'

const row = (dims: Record<string, string>, values: Record<string, number>): SourceRow => ({
  dims,
  values,
  at: null,
})

describe('grouping and adding up', () => {
  const rows = [
    row({ product: 'Belt', category: 'Engine' }, { revenue: 100, units: 2, sales: 1 }),
    row({ product: 'Belt', category: 'Engine' }, { revenue: 50, units: 1, sales: 1 }),
    row({ product: 'Pad', category: 'Brakes' }, { revenue: 200, units: 4, sales: 1 }),
  ]

  it('collapses rows that share their dimension values', () => {
    const result = runReport(rows, { dimensions: ['product'], measures: ['revenue', 'units'] })
    expect(result.rows).toHaveLength(2)
    const belt = result.rows.find((r) => r.dims.product === 'Belt')!
    expect(belt.values.revenue).toBe(150)
    expect(belt.values.units).toBe(3)
  })

  it('groups by several dimensions at once', () => {
    const result = runReport(rows, {
      dimensions: ['category', 'product'],
      measures: ['revenue'],
    })
    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]!.dims).toEqual({ category: 'Brakes', product: 'Pad' })
  })

  it('makes one grand-total row when nothing is grouped', () => {
    // "What did we take last month" is a legitimate report, not an empty one.
    const result = runReport(rows, { dimensions: [], measures: ['revenue'] })
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]!.values.revenue).toBe(350)
  })

  it('totals every column across the whole report', () => {
    const result = runReport(rows, { dimensions: ['product'], measures: ['revenue'] })
    expect(result.totals.revenue).toBe(350)
    expect(result.sourceRows).toBe(3)
  })

  it('puts the biggest first, on the leading measure', () => {
    const result = runReport(rows, { dimensions: ['product'], measures: ['revenue'] })
    expect(result.rows.map((r) => r.dims.product)).toEqual(['Pad', 'Belt'])
  })

  it('survives a row missing a dimension', () => {
    const result = runReport([row({}, { revenue: 10 })], {
      dimensions: ['product'],
      measures: ['revenue'],
    })
    expect(result.rows[0]!.dims.product).toBe('—')
  })

  it('returns nothing for no rows rather than throwing', () => {
    const result = runReport([], { dimensions: ['product'], measures: ['revenue'] })
    expect(result.rows).toEqual([])
    expect(result.sourceRows).toBe(0)
  })
})

describe('ratios', () => {
  it('works margin % out from the group, never by summing', () => {
    // Summing two 50% margins would give 100%. Each group is recomputed.
    const rows = [
      row({ p: 'a' }, { revenue: 100, margin: 50 }),
      row({ p: 'a' }, { revenue: 100, margin: 50 }),
    ]
    const result = runReport(rows, { dimensions: ['p'], measures: ['revenue', 'marginRatio'] })
    expect(result.rows[0]!.values.marginRatio).toBeCloseTo(0.5)
    expect(result.totals.marginRatio).toBeCloseTo(0.5)
  })

  it('works average check out from revenue and sale count', () => {
    const rows = [
      row({ p: 'a' }, { revenue: 300, sales: 1 }),
      row({ p: 'a' }, { revenue: 100, sales: 1 }),
    ]
    const result = runReport(rows, { dimensions: ['p'], measures: ['averageCheck'] })
    expect(result.rows[0]!.values.averageCheck).toBe(200)
  })

  it('does not divide by zero', () => {
    const result = runReport([row({ p: 'a' }, { revenue: 0, margin: 0, sales: 0 })], {
      dimensions: ['p'],
      measures: ['marginRatio', 'averageCheck'],
    })
    expect(result.rows[0]!.values.marginRatio).toBe(0)
    expect(result.rows[0]!.values.averageCheck).toBe(0)
  })

  it('nets stock movement in and out', () => {
    const rows = [
      row({ k: 'Receipt' }, { inUnits: 10, outUnits: 0 }),
      row({ k: 'Receipt' }, { inUnits: 5, outUnits: 2 }),
    ]
    const result = runReport(rows, { dimensions: ['k'], measures: ['netUnits'] })
    expect(result.rows[0]!.values.netUnits).toBe(13)
  })
})

describe('how a definition reads', () => {
  const base = {
    source: 'sales',
    measures: ['revenue'],
    dimensions: ['product'],
  } as ReportDefinition

  it('says what it measures and what it splits by', () => {
    expect(describeReport(base)).toBe('Revenue by product')
    expect(describeReport({ ...base, dimensions: ['product', 'seller'] })).toBe(
      'Revenue by product and seller',
    )
  })

  it('says "in total" when nothing is grouped', () => {
    expect(describeReport({ ...base, dimensions: [] })).toBe('Revenue, in total')
  })
})
