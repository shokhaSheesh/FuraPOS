import { useState, type ReactNode } from 'react'
import {
  useTable,
  type ColumnVisibilityState,
  type RowData,
  type SortingState,
} from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ChevronsUpDown, Settings2 } from 'lucide-react'
import { DropdownMenu } from 'radix-ui'
import { cn } from '@/shared/lib/cn'
import { Button } from '@/shared/ui/Button'
import { Skeleton } from '@/shared/ui/Skeleton'
import { EmptyState } from './EmptyState'
import { TablePagination, type PaginationState } from './TablePagination'
import { tableFeatureSet, type TableColumn } from './table/features'

export interface DataTableProps<T extends RowData> {
  columns: TableColumn<T>[]
  data: T[]
  /** Total across all pages — from the API envelope, never data.length. */
  total: number
  pagination: PaginationState
  onPaginationChange: (next: PaginationState) => void
  sorting?: SortingState
  onSortingChange?: (next: SortingState) => void
  isLoading?: boolean
  onRowClick?: (row: T) => void
  emptyState?: ReactNode
  /** Persists the user's column choices for this table across visits. */
  storageKey?: string
}

function readStoredVisibility(storageKey?: string): ColumnVisibilityState {
  if (!storageKey) return {}
  try {
    return JSON.parse(localStorage.getItem(`cols:${storageKey}`) ?? '{}') as ColumnVisibilityState
  } catch {
    return {}
  }
}

export function DataTable<T extends RowData>({
  columns,
  data,
  total,
  pagination,
  onPaginationChange,
  sorting = [],
  onSortingChange,
  isLoading,
  onRowClick,
  emptyState,
  storageKey,
}: DataTableProps<T>) {
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>(() =>
    readStoredVisibility(storageKey),
  )

  const table = useTable({
    features: tableFeatureSet,
    data,
    columns,
    manualSorting: true,
    state: { sorting, columnVisibility },
    onSortingChange: (updater) => {
      if (!onSortingChange) return
      onSortingChange(typeof updater === 'function' ? updater(sorting) : updater)
    },
    onColumnVisibilityChange: (updater) => {
      setColumnVisibility((previous) => {
        const next = typeof updater === 'function' ? updater(previous) : updater
        if (storageKey) localStorage.setItem(`cols:${storageKey}`, JSON.stringify(next))
        return next
      })
    },
  })

  const visibleColumnCount = table.getVisibleLeafColumns().length
  const rows = table.getRowModel().rows

  return (
    <div className="overflow-hidden rounded-card border border-border bg-surface shadow-card">
      <div className="flex items-center justify-end border-b border-border px-2 py-1.5">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <Button variant="ghost" size="sm">
              <Settings2 />
              Columns
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={4}
              className="z-50 min-w-48 rounded-control border border-border bg-surface p-1 shadow-popover"
            >
              {table
                .getAllLeafColumns()
                .filter((column) => column.getCanHide())
                .map((column) => (
                  <DropdownMenu.CheckboxItem
                    key={column.id}
                    checked={column.getIsVisible()}
                    onCheckedChange={(checked) => column.toggleVisibility(Boolean(checked))}
                    onSelect={(event) => event.preventDefault()}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-fg outline-none data-[highlighted]:bg-surface-muted"
                  >
                    <span className="flex size-4 items-center justify-center rounded border border-border-strong">
                      <DropdownMenu.ItemIndicator>
                        <span className="block size-2 rounded-[2px] bg-primary" />
                      </DropdownMenu.ItemIndicator>
                    </span>
                    {typeof column.columnDef.header === 'string'
                      ? column.columnDef.header
                      : column.id}
                  </DropdownMenu.CheckboxItem>
                ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-surface-muted">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = Boolean(onSortingChange) && header.column.getCanSort()
                  const sorted = header.column.getIsSorted()
                  const alignRight = header.column.columnDef.meta?.align === 'right'
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      className={cn(
                        'whitespace-nowrap px-3 py-2.5 text-2xs font-semibold uppercase tracking-wide text-fg-muted',
                        alignRight ? 'text-right' : 'text-left',
                      )}
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={() => header.column.toggleSorting()}
                          className={cn(
                            // Form controls do not inherit text-transform, so the
                            // header typography is repeated here on purpose.
                            'inline-flex items-center gap-1 uppercase tracking-wide hover:text-fg',
                            alignRight && 'flex-row-reverse',
                          )}
                        >
                          <table.FlexRender header={header} />
                          {sorted === 'asc' ? (
                            <ArrowUp className="size-3" />
                          ) : sorted === 'desc' ? (
                            <ArrowDown className="size-3" />
                          ) : (
                            <ChevronsUpDown className="size-3 opacity-40" />
                          )}
                        </button>
                      ) : (
                        <table.FlexRender header={header} />
                      )}
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>

          <tbody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, rowIndex) => (
                <tr key={rowIndex} className="border-t border-border">
                  {Array.from({ length: visibleColumnCount }).map((__, cellIndex) => (
                    <td key={cellIndex} className="px-3 py-2.5">
                      <Skeleton className="h-4 w-full max-w-40" />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={visibleColumnCount}>
                  {emptyState ?? (
                    <EmptyState
                      title="Nothing here yet"
                      description="Try clearing your filters, or add the first record."
                    />
                  )}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  className={cn(
                    'border-t border-border',
                    onRowClick && 'cursor-pointer hover:bg-surface-muted',
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={cn(
                        'px-3 py-2.5 text-fg',
                        cell.column.columnDef.meta?.align === 'right' ? 'text-right' : 'text-left',
                      )}
                    >
                      <table.FlexRender cell={cell} />
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <TablePagination total={total} pagination={pagination} onChange={onPaginationChange} />
    </div>
  )
}
