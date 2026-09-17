import type { RowData } from '@tanstack/react-table'
import type { TableColumn } from '@/shared/components/table/features'
import {
  readPath,
  type FieldGetters,
  type FieldValue,
  type FilterField,
  type FilterFieldType,
} from './fieldFilters'

/**
 * A list's search panel, built from the list's own table columns.
 *
 * The rule the product list set: the panel shows the fields the page shows,
 * named the way the table heads them. Writing that list out by hand for every
 * screen is how it drifts, so a page hands over its columns and gets one field
 * per column back. What kind of filter each becomes is read from the data —
 * numbers get from–to, dates a date range, a column with a handful of repeated
 * values a pick-list, anything else a text box.
 *
 * Where the data cannot say — a column whose cell is worked out rather than
 * stored, or a status whose raw value is `in_transit` — the page overrides that
 * one column. The same overrides give the data hook its getters, so the panel
 * and the filtering read a field from the same place.
 */
export interface FieldOverride<T> {
  label?: string
  type?: FilterFieldType
  /** Where the value comes from, when it is not the column's `accessorKey`. */
  get?: (row: T) => FieldValue
  /** How a raw option reads, e.g. `in_transit` → "In transit". */
  optionLabel?: (value: string) => string
  unit?: string
  /** Leave this column out of the panel. */
  skip?: boolean
}

export type FieldOverrides<T> = Record<string, FieldOverride<T>>

/** Columns that are controls, not data. */
const NOT_FIELDS = new Set(['actions', 'rowActions', 'select', 'expand'])

/** At or under this many different values, a text column becomes a pick-list. */
const MAX_OPTIONS = 15

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T|$)/

export const gettersOf = <T>(overrides: FieldOverrides<T>): FieldGetters<T> =>
  Object.fromEntries(
    Object.entries(overrides).flatMap(([id, override]) =>
      override.get ? [[id, override.get]] : [],
    ),
  )

const columnId = <T extends RowData>(column: TableColumn<T>) =>
  column.id ?? ((column as { accessorKey?: string }).accessorKey as string | undefined)

function inferType(values: FieldValue[], rowCount: number): FilterFieldType {
  const present = values.filter((v) => v !== null && v !== undefined && v !== '')
  if (present.length === 0) return 'text'
  if (present.every((v) => typeof v === 'number')) return 'range'
  if (present.every((v) => typeof v === 'boolean')) return 'boolean'
  if (present.every((v) => typeof v === 'string' && ISO_DATE.test(v))) return 'date'
  const flat = present.flatMap((v) => (Array.isArray(v) ? v : [v])).map(String)
  const distinct = new Set(flat).size
  const repeats = distinct < Math.max(2, rowCount)
  return distinct <= MAX_OPTIONS && repeats ? 'options' : 'text'
}

export function filterFieldsFromColumns<T extends RowData>(
  columns: TableColumn<T>[],
  rows: T[],
  overrides: FieldOverrides<T> = {},
): FilterField<T>[] {
  const fields: FilterField<T>[] = []
  const seen = new Set<string>()

  const build = (id: string, header: unknown, accessorKey: string | undefined) => {
    const override = overrides[id] ?? {}
    if (override.skip || NOT_FIELDS.has(id)) return
    const label = override.label ?? (typeof header === 'string' && header.trim() ? header : null)
    const get = override.get ?? (accessorKey ? (row: T) => readPath(row, accessorKey) : null)
    if (!label || !get) return

    const values = rows.map(get)
    const type = override.type ?? inferType(values, rows.length)
    const field: FilterField<T> = { id, label, type, get, unit: override.unit }
    if (type === 'options') {
      const distinct = [
        ...new Set(
          values
            .flatMap((v) => (Array.isArray(v) ? v : [v]))
            .filter((v): v is string | number => v !== null && v !== undefined && v !== '')
            .map(String),
        ),
      ]
      field.options = distinct
        .map((value) => ({ value, label: override.optionLabel?.(value) ?? value }))
        .sort((a, b) => a.label.localeCompare(b.label))
    }
    fields.push(field)
    seen.add(id)
  }

  for (const column of columns) {
    const id = columnId(column)
    if (!id) continue
    build(id, column.header, (column as { accessorKey?: string }).accessorKey)
  }
  // Fields a page wants that no column shows — declared with a label and a getter.
  for (const [id, override] of Object.entries(overrides)) {
    if (!seen.has(id) && override.label && override.get) build(id, override.label, undefined)
  }
  return fields
}
