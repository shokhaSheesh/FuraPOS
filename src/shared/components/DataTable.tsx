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
  /**
   * Columns that start hidden. A dense table can carry more columns than it
   * shows, so the ones most people never need are off until asked for.
   */
  initialHidden?: string[]
  /**
   * Search and filters, rendered in the table's own toolbar row so a table
   * has exactly one toolbar: controls left, column visibility right.
   */
  toolbar?: ReactNode
}

function readStoredVisibility(
  storageKey: string | undefined,
  initialHidden: string[] | undefined,
): ColumnVisibilityState {
  const defaults = Object.fromEntries((initialHidden ?? []).map((id) => [id, false]))
  if (!storageKey) return defaults
  try {
    const stored = JSON.parse(
      localStorage.getItem(`cols:${storageKey}`) ?? 'null',
    ) as ColumnVisibilityState | null
    if (!stored) return defaults
    /**
     * Defaults first, the stored choice on top. A column added after the user
     * last touched this table is absent from their stored state, and without
     * this it would appear regardless of its default — which is how Stock got
     * pushed off-screen by four columns that were supposed to be hidden.
     */
    return { ...defaults, ...stored }
  } catch {
    return defaults
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
  initialHidden,
  toolbar,
}: DataTableProps<T>) {
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>(() =>
    readStoredVisibility(storageKey, initialHidden),
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
    <div className="rounded-card border-border bg-surface shadow-card overflow-hidden border">
      <div className="border-border flex flex-wrap items-center gap-2 border-b p-2">
        {toolbar}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <Button variant="ghost" size="sm" className="ml-auto">
              <Settings2 />
              Columns
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={4}
              // Capped so a 19-column table does not open a full-height wall
              // of checkboxes; it never grows past the space actually available.
              className="rounded-control border-border bg-surface shadow-popover z-50 max-h-[min(18rem,var(--radix-dropdown-menu-content-available-height))] min-w-48 overflow-y-auto overscroll-contain border p-1"
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
                    className="text-fg data-[highlighted]:bg-surface-muted flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm outline-none"
                  >
                    <span className="border-border-strong flex size-4 items-center justify-center rounded border">
                      <DropdownMenu.ItemIndicator>
                        <span className="bg-primary block size-2 rounded-[2px]" />
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
                        'text-2xs text-fg-muted h-10 px-3 font-semibold tracking-wide whitespace-nowrap uppercase',
                        alignRight ? 'text-right' : 'text-left',
                      )}
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={() => header.column.toggleSorting()}
                          // Form controls do not inherit text-transform, so the
                          // header typography is repeated here on purpose.
                          className="hover:text-fg inline-flex items-center gap-1 tracking-wide uppercase"
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
                <tr key={rowIndex} className="border-border border-t">
                  {Array.from({ length: visibleColumnCount }).map((__, cellIndex) => (
                    <td key={cellIndex} className="h-11 px-3">
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
                    'border-border border-t',
                    onRowClick && 'hover:bg-surface-muted cursor-pointer',
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={cn(
                        'text-fg h-11 px-3 py-0 whitespace-nowrap',
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
