import { useMemo, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import {
  useTable,
  type ColumnVisibilityState,
  type RowData,
  type SortingState,
} from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, ChevronsUpDown, Settings2 } from 'lucide-react'
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
  /** Omit both for a table that shows every row, such as the lines of a document. */
  pagination?: PaginationState
  onPaginationChange?: (next: PaginationState) => void
  /** Rendered in place of pagination — totals under a document's lines. */
  footer?: ReactNode
  /** A stable id per row, so inputs inside cells keep focus when rows change. */
  getRowId?: (row: T, index: number) => string
  /** Extra classes for a row — e.g. the line that was just added. */
  rowClassName?: (row: T) => string | undefined
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

/** The order the user dragged columns into, as column ids. Unknown ids are ignored. */
type ColumnOrder = string[]

function readStoredOrder(storageKey: string | undefined): ColumnOrder {
  if (!storageKey) return []
  try {
    return (JSON.parse(localStorage.getItem(`order:${storageKey}`) ?? 'null') as ColumnOrder) ?? []
  } catch {
    return []
  }
}

/** A column's stable id: its own, or the field it reads. */
const columnId = <T extends RowData>(column: TableColumn<T>): string =>
  (column.id ?? (column as { accessorKey?: string }).accessorKey ?? '') as string

/**
 * Applies a stored order: columns the user has arranged first, in their order,
 * then anything added since, in the order the screen declared it. The actions
 * column is always last — it is not a column of data and cannot be dragged.
 */
function applyOrder<T extends RowData>(
  columns: TableColumn<T>[],
  order: ColumnOrder,
): TableColumn<T>[] {
  if (order.length === 0) return columns
  const byId = new Map(columns.map((column) => [columnId(column), column]))
  const arranged = order.flatMap((id) => {
    const column = byId.get(id)
    if (!column) return []
    byId.delete(id)
    return [column]
  })
  const rest = columns.filter((column) => byId.has(columnId(column)))
  const all = [...arranged, ...rest]
  const actions = all.filter((column) => columnId(column) === 'actions')
  return actions.length
    ? [...all.filter((column) => columnId(column) !== 'actions'), ...actions]
    : all
}

/** Widths the user dragged, per column id, in pixels. Absent means "fit the content". */
type ColumnWidths = Record<string, number>

const MIN_COLUMN_WIDTH = 48

function readStoredWidths(storageKey: string | undefined): ColumnWidths {
  if (!storageKey) return {}
  try {
    return (
      (JSON.parse(localStorage.getItem(`widths:${storageKey}`) ?? 'null') as ColumnWidths) ?? {}
    )
  } catch {
    return {}
  }
}

/** Fixed when dragged: the cell clips rather than pushing its column wider again. */
const widthStyle = (width: number | undefined) =>
  width === undefined ? undefined : { width, minWidth: width, maxWidth: width }

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
  footer,
  getRowId,
  rowClassName,
}: DataTableProps<T>) {
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>(() =>
    readStoredVisibility(storageKey, initialHidden),
  )

  /*
    Column widths are dragged from the right edge of a heading and remembered
    alongside the column choices. Until a column is dragged it sizes to its
    content, as before; a double-click on the edge puts it back to that.
  */
  const [widths, setWidths] = useState<ColumnWidths>(() => readStoredWidths(storageKey))
  /*
    Columns can also be dragged into a different order by their heading, which
    is remembered beside the widths. A table nobody has rearranged keeps the
    order the screen declared.
  */
  const [order, setOrder] = useState<ColumnOrder>(() => readStoredOrder(storageKey))

  const ordered = useMemo(() => applyOrder(columns, order), [columns, order])

  /** Moves a column one place left or right, which is what the arrows do. */
  const moveColumn = (id: string, direction: -1 | 1) => {
    const ids = ordered.map(columnId).filter((columnKey) => columnKey !== 'actions')
    const from = ids.indexOf(id)
    const to = from + direction
    if (from === -1 || to < 0 || to >= ids.length) return
    const next = [...ids]
    next.splice(to, 0, ...next.splice(from, 1))
    setOrder(next)
    if (storageKey) {
      try {
        localStorage.setItem(`order:${storageKey}`, JSON.stringify(next))
      } catch {
        // Storage can be unavailable; the order still applies for this visit.
      }
    }
  }
  const drag = useRef<{ id: string; startX: number; startWidth: number } | null>(null)

  const saveWidths = (next: ColumnWidths) => {
    setWidths(next)
    if (!storageKey) return
    try {
      localStorage.setItem(`widths:${storageKey}`, JSON.stringify(next))
    } catch {
      // Storage can be unavailable; the width still applies for this visit.
    }
  }

  const startResize = (event: PointerEvent<HTMLSpanElement>, id: string) => {
    event.preventDefault()
    event.stopPropagation()
    const th = event.currentTarget.closest('th')
    if (!th) return
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { id, startX: event.clientX, startWidth: th.getBoundingClientRect().width }
  }

  const moveResize = (event: PointerEvent<HTMLSpanElement>) => {
    const current = drag.current
    if (!current) return
    const width = Math.max(
      MIN_COLUMN_WIDTH,
      Math.round(current.startWidth + event.clientX - current.startX),
    )
    setWidths((previous) => ({ ...previous, [current.id]: width }))
  }

  const endResize = () => {
    if (!drag.current) return
    drag.current = null
    // Persist once, when the drag ends, not on every pointer move.
    setWidths((previous) => {
      if (storageKey) {
        try {
          localStorage.setItem(`widths:${storageKey}`, JSON.stringify(previous))
        } catch {
          // As above.
        }
      }
      return previous
    })
  }

  const resetWidth = (id: string) => {
    const next = { ...widths }
    delete next[id]
    saveWidths(next)
  }

  const table = useTable({
    features: tableFeatureSet,
    data,
    columns: ordered,
    getRowId,
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
              {(() => {
                const movable = table
                  .getAllLeafColumns()
                  .filter((column) => column.id !== 'actions')
                  .map((column) => column.id)
                return table
                  .getAllLeafColumns()
                  .filter((column) => column.getCanHide())
                  .map((column) => {
                    const position = movable.indexOf(column.id)
                    return (
                      <DropdownMenu.CheckboxItem
                        key={column.id}
                        checked={column.getIsVisible()}
                        onCheckedChange={(checked) => column.toggleVisibility(Boolean(checked))}
                        onSelect={(event) => event.preventDefault()}
                        className="text-fg data-[highlighted]:bg-surface-muted flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm outline-none"
                      >
                        <span className="border-border-strong flex size-4 shrink-0 items-center justify-center rounded border">
                          <DropdownMenu.ItemIndicator>
                            <span className="bg-primary block size-2 rounded-[2px]" />
                          </DropdownMenu.ItemIndicator>
                        </span>
                        <span className="flex-1 truncate">
                          {typeof column.columnDef.header === 'string'
                            ? column.columnDef.header
                            : column.id}
                        </span>
                        {/* Ordering lives here rather than on the heading: a
                            table is read by dragging it sideways, so dragging a
                            heading to move it fought with scrolling. */}
                        <span className="ml-1 flex shrink-0 items-center">
                          <MoveButton
                            label={`Move ${column.id} left`}
                            disabled={position <= 0}
                            onClick={() => moveColumn(column.id, -1)}
                          >
                            <ChevronUp />
                          </MoveButton>
                          <MoveButton
                            label={`Move ${column.id} right`}
                            disabled={position === -1 || position >= movable.length - 1}
                            onClick={() => moveColumn(column.id, 1)}
                          >
                            <ChevronDown />
                          </MoveButton>
                        </span>
                      </DropdownMenu.CheckboxItem>
                    )
                  })
              })()}
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
                  const resizable = header.column.id !== 'actions'
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      style={widthStyle(widths[header.column.id])}
                      className={cn(
                        'text-2xs text-fg-muted group/th relative h-10 px-3 font-semibold tracking-wide whitespace-nowrap uppercase',
                        widths[header.column.id] !== undefined && 'overflow-hidden text-ellipsis',
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
                      {resizable ? (
                        <span
                          role="separator"
                          aria-orientation="vertical"
                          aria-label="Drag to resize the column, double-click to fit it"
                          onPointerDown={(event) => startResize(event, header.column.id)}
                          onPointerMove={moveResize}
                          onPointerUp={endResize}
                          onPointerCancel={endResize}
                          onClick={(event) => event.stopPropagation()}
                          onDoubleClick={() => resetWidth(header.column.id)}
                          className="absolute inset-y-0 right-0 flex w-2 cursor-col-resize touch-none justify-center"
                        >
                          <span className="bg-border-strong group-hover/th:bg-primary/60 my-2.5 w-px" />
                        </span>
                      ) : null}
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
                    rowClassName?.(row.original),
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      style={widthStyle(widths[cell.column.id])}
                      className={cn(
                        'text-fg h-11 px-3 py-0 whitespace-nowrap',
                        // Only a dragged column clips; clipping every cell would cut off
                        // the focus ring of an input sitting in one.
                        widths[cell.column.id] !== undefined && 'overflow-hidden text-ellipsis',
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

      {footer ??
        (pagination && onPaginationChange ? (
          <TablePagination total={total} pagination={pagination} onChange={onPaginationChange} />
        ) : null)}
    </div>
  )
}

/** One of the two arrows beside a column in the Columns menu. */
function MoveButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onClick()
      }}
      className="text-fg-subtle hover:text-fg grid size-5 place-items-center disabled:opacity-25 [&_svg]:size-3.5"
    >
      {children}
    </button>
  )
}
