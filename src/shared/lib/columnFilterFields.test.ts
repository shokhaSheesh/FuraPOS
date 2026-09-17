import { describe, expect, it } from 'vitest'
import type { TableColumn } from '@/shared/components/table/features'
import { filterFieldsFromColumns, gettersOf } from './columnFilterFields'
import { applyQueryFilters, encodeFilters } from './fieldFilters'

interface Row {
  number: string
  status: string
  total: number
  createdAt: string
  client: { name: string }
  note: string | null
}

const rows: Row[] = Array.from({ length: 20 }, (_, i) => ({
  number: `S-${1000 + i}`,
  status: i % 2 ? 'in_transit' : 'received',
  total: i * 100,
  createdAt: `2026-09-${String(i + 1).padStart(2, '0')}T10:00:00Z`,
  client: { name: `Client ${i}` },
  note: null,
}))

const columns: TableColumn<Row>[] = [
  { accessorKey: 'number', header: 'Number' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'total', header: 'Total' },
  { accessorKey: 'createdAt', header: 'Created' },
  { accessorKey: 'client.name', header: 'Client' },
  { id: 'computed', header: 'Worked out', cell: () => null },
  { id: 'actions', header: '', cell: () => null },
]

describe('a search panel built from a table', () => {
  const fields = filterFieldsFromColumns(columns, rows, {
    status: { optionLabel: (v) => (v === 'in_transit' ? 'In transit' : 'Received') },
  })
  const byId = Object.fromEntries(fields.map((f) => [f.id, f]))

  it('has a field per data column, named as the table heads it', () => {
    expect(fields.map((f) => [f.id, f.label])).toEqual([
      ['number', 'Number'],
      ['status', 'Status'],
      ['total', 'Total'],
      ['createdAt', 'Created'],
      ['client.name', 'Client'],
    ])
  })

  it('reads the kind of filter from the data', () => {
    expect(byId.number!.type).toBe('text')
    expect(byId.status!.type).toBe('options')
    expect(byId.total!.type).toBe('range')
    expect(byId.createdAt!.type).toBe('date')
  })

  it('names options through the override', () => {
    expect(byId.status!.options).toEqual([
      { value: 'in_transit', label: 'In transit' },
      { value: 'received', label: 'Received' },
    ])
  })

  it('includes a worked-out column once it is given a getter', () => {
    const withGetter = filterFieldsFromColumns(columns, rows, {
      computed: { get: (row) => row.total * 2 },
    })
    expect(withGetter.find((f) => f.id === 'computed')?.type).toBe('range')
  })
})

describe('filtering in a data hook', () => {
  it('reads nested columns and dates from the stored filters alone', () => {
    const f = encodeFilters({
      'client.name': { type: 'text', text: 'client 1' },
      createdAt: { type: 'date', from: '2026-09-10', to: '2026-09-12' },
    })
    expect(applyQueryFilters(rows, f).map((r) => r.number)).toEqual(['S-1010', 'S-1011'])
  })

  it('uses an override getter for a worked-out field', () => {
    const f = encodeFilters({ computed: { type: 'range', min: 3000, max: null } })
    const getters = gettersOf<Row>({ computed: { get: (row) => row.total * 2 } })
    expect(applyQueryFilters(rows, f, getters)).toHaveLength(5)
  })
})
