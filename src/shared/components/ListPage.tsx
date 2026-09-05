import type { ReactNode } from 'react'
import { SearchInput } from './SearchInput'

interface ListPageProps {
  search?: { value: string; onChange: (value: string) => void; placeholder?: string }
  filters?: ReactNode
  children: ReactNode
}

/**
 * Toolbar + content for list screens that are NOT a table (card grids such as
 * Integrations). Tables put their search/filters in DataTable's `toolbar`
 * prop instead, so the table has exactly one toolbar row.
 */
export function ListPage({ search, filters, children }: ListPageProps) {
  return (
    <div className="space-y-3">
      {search || filters ? (
        <div className="flex flex-wrap items-center gap-2">
          {search ? <SearchInput {...search} /> : null}
          {filters}
        </div>
      ) : null}
      {children}
    </div>
  )
}
