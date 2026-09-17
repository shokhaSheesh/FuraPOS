import { describe as group, expect, it } from 'vitest'
import {
  applyFieldFilters,
  decodeFilters,
  describe,
  encodeFilters,
  type FilterField,
} from './fieldFilters'

interface Row {
  name: string
  barcode: string | null
  makes: string[]
  stock: number
  image: string | null
}

const rows: Row[] = [
  { name: 'Fuel pump', barcode: '4600001', makes: ['DAF'], stock: 3, image: null },
  { name: 'Brake disc', barcode: null, makes: ['MAN', 'Volvo'], stock: 12, image: 'a.png' },
  { name: 'Oil filter', barcode: '4600002', makes: [], stock: 0, image: null },
]

const fields: FilterField<Row>[] = [
  { id: 'name', label: 'Name', type: 'text', get: (r) => r.name },
  { id: 'barcode', label: 'Barcode', type: 'text', excludable: true, get: (r) => r.barcode },
  {
    id: 'make',
    label: 'Make',
    type: 'options',
    get: (r) => r.makes,
    options: ['DAF', 'MAN', 'Volvo', 'Scania'].map((m) => ({ value: m, label: m })),
  },
  { id: 'stock', label: 'Quantity', type: 'range', get: (r) => r.stock },
  { id: 'image', label: 'Has image', type: 'boolean', get: (r) => r.image },
]

const names = (list: Row[]) => list.map((r) => r.name)

group('filtering by field', () => {
  it('matches text anywhere in the value, case-insensitively', () => {
    expect(
      names(applyFieldFilters(rows, fields, { name: { type: 'text', text: 'PUMP' } })),
    ).toEqual(['Fuel pump'])
  })

  it('finds every value of a pasted list', () => {
    const found = applyFieldFilters(rows, fields, {
      barcode: { type: 'text', text: '4600001, 4600002' },
    })
    expect(names(found)).toEqual(['Fuel pump', 'Oil filter'])
  })

  it('keeps the rows that do not match when excluding', () => {
    const found = applyFieldFilters(rows, fields, {
      barcode: { type: 'text', text: '4600001', exclude: true },
    })
    expect(names(found)).toEqual(['Brake disc', 'Oil filter'])
  })

  it('matches any chosen option against any value of the row', () => {
    const found = applyFieldFilters(rows, fields, { make: { type: 'options', values: ['Volvo'] } })
    expect(names(found)).toEqual(['Brake disc'])
  })

  it('reads a range as inclusive, with either end open', () => {
    expect(
      names(applyFieldFilters(rows, fields, { stock: { type: 'range', min: 3, max: null } })),
    ).toEqual(['Fuel pump', 'Brake disc'])
    expect(
      names(applyFieldFilters(rows, fields, { stock: { type: 'range', min: null, max: 0 } })),
    ).toEqual(['Oil filter'])
  })

  it('reads yes / no as whether the field has a value', () => {
    expect(
      names(applyFieldFilters(rows, fields, { image: { type: 'boolean', value: false } })),
    ).toEqual(['Fuel pump', 'Oil filter'])
  })

  it('needs every applied filter to pass', () => {
    const found = applyFieldFilters(rows, fields, {
      name: { type: 'text', text: 'e' },
      stock: { type: 'range', min: 1, max: null },
    })
    expect(names(found)).toEqual(['Fuel pump', 'Brake disc'])
  })

  it('ignores empty boxes', () => {
    expect(applyFieldFilters(rows, fields, { name: { type: 'text', text: '  ' } })).toHaveLength(3)
  })
})

group('chips and the URL', () => {
  it('says what a filter does in a few words', () => {
    expect(describe(fields[1]!, { type: 'text', text: '46', exclude: true })).toBe('Barcode ≠ 46')
    expect(describe(fields[2]!, { type: 'options', values: ['DAF', 'MAN', 'Volvo'] })).toBe(
      'Make: DAF, MAN +1',
    )
    expect(describe(fields[3]!, { type: 'range', min: 5, max: null })).toBe('Quantity ≥ 5')
  })

  it('round-trips through the URL and drops empty filters', () => {
    const encoded = encodeFilters({
      name: { type: 'text', text: 'pump' },
      barcode: { type: 'text', text: '' },
    })
    expect(decodeFilters(encoded)).toEqual({ name: { type: 'text', text: 'pump' } })
    expect(encodeFilters({ barcode: { type: 'text', text: '' } })).toBeNull()
  })

  it('reads a broken parameter as no filters', () => {
    expect(decodeFilters('{not json')).toEqual({})
  })
})
