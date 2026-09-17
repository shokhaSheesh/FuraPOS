import { useMemo } from 'react'
import type { RowData } from '@tanstack/react-table'
import type { TableColumn } from '@/shared/components/table/features'
import { FilterSearch } from '@/shared/components/FilterSearch'
import { filterFieldsFromColumns, type FieldOverrides } from '@/shared/lib/columnFilterFields'
import { decodeFilters, encodeFilters } from '@/shared/lib/fieldFilters'
import type { ListQuery, ListQueryPatch } from '@/shared/types'

/**
 * `FilterSearch` for a list page whose state lives in the URL: the panel's
 * fields come from the page's own table columns, the applied filters go in
 * `f` and the typed search in `search`. The page's data hook applies `f` with
 * `applyQueryFilters` and the same overrides.
 */
export function ColumnFilterSearch<T extends RowData>({
  columns,
  rows,
  overrides,
  query,
  setQuery,
  placeholder = 'Filter and search',
}: {
  columns: TableColumn<T>[]
  /** Every row the list can show, unfiltered — pick-lists are read from it. */
  rows: T[]
  overrides?: FieldOverrides<T>
  query: ListQuery
  setQuery: (patch: ListQueryPatch) => void
  placeholder?: string
}) {
  const fields = useMemo(
    () => filterFieldsFromColumns(columns, rows, overrides),
    [columns, rows, overrides],
  )
  const values = useMemo(() => decodeFilters(query.f), [query.f])
  return (
    <FilterSearch
      fields={fields}
      values={values}
      onApply={(next) => setQuery({ f: encodeFilters(next) })}
      search={String(query.search ?? '')}
      onSearchChange={(search) => setQuery({ search })}
      placeholder={placeholder}
    />
  )
}
