import { useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { useTable, type ColumnVisibilityState, type RowData } from '@tanstack/react-table'
import { ChevronDown, ChevronUp, Settings2 } from 'lucide-react'
import { DropdownMenu } from 'radix-ui'
import { createPortal } from 'react-dom'
import { cn } from '@/shared/lib/cn'
import { Button } from '@/shared/ui/Button'
import { Skeleton } from '@/shared/ui/Skeleton'
import { EmptyState } from './EmptyState'
import { TablePagination, type PaginationState } from './TablePagination'
import { tableFeatureSet, type TableColumn } from './table/features'
import { t } from '@/shared/i18n'

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
  /**
   * Where the Columns menu goes when it belongs beside other view controls
   * outside the table. When set and there is no toolbar, the toolbar row is
   * not drawn at all.
   */
  columnsMenuContainer?: HTMLElement | null
  /**
   * Lets columns be dragged by their heading into a new place. While dragging,
   * holding the pointer near either edge scrolls the table that way, so a column
   * at the far end can be carried all the way to the front. Remembered with the
   * rest of the column choices.
   */
  reorderableColumns?: boolean
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
  isLoading,
  onRowClick,
  emptyState,
  storageKey,
  initialHidden,
  toolbar,
  columnsMenuContainer,
  reorderableColumns = false,
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
    saveOrder(next)
  }

  const saveOrder = (next: ColumnOrder) => {
    setOrder(next)
    if (storageKey) {
      try {
        localStorage.setItem(`order:${storageKey}`, JSON.stringify(next))
      } catch {
        // Storage can be unavailable; the order still applies for this visit.
      }
    }
  }

  /* --- dragging a column by its heading ---------------------------------- */

  const scrollRef = useRef<HTMLDivElement>(null)
  /** A press on a heading that has not moved far enough to be a drag yet. */
  const pressed = useRef<{ id: string; label: string; x: number; y: number } | null>(null)
  /** Where the pointer is, for the edge scroll to keep reading while it holds still. */
  const pointerX = useRef(0)
  /** Whether the press has travelled far enough to be a drag. */
  const active = useRef(false)
  /**
   * When a drag last ended. The click a browser fires on release must not sort
   * the column — but only that click, so it is a moment, not a flag left set.
   */
  const draggedAt = useRef(0)
  const [dragging, setDragging] = useState<{
    id: string
    label: string
    x: number
    y: number
    /** Before which visible heading it would land; the count of headings means "at the end". */
    dropIndex: number
    indicatorX: number
  } | null>(null)

  /** The visible, movable headings in their on-screen order. */
  const headingCells = () =>
    Array.from(
      scrollRef.current?.querySelectorAll<HTMLTableCellElement>('th[data-column-id]') ?? [],
    ).filter((cell) => cell.dataset.columnId !== 'actions')

  const dropTarget = (x: number) => {
    const cells = headingCells()
    let dropIndex = cells.length
    for (let index = 0; index < cells.length; index++) {
      const rect = cells[index]!.getBoundingClientRect()
      if (x < rect.left + rect.width / 2) {
        dropIndex = index
        break
      }
    }
    const container = scrollRef.current?.getBoundingClientRect()
    const edge =
      dropIndex < cells.length
        ? cells[dropIndex]!.getBoundingClientRect().left
        : (cells.at(-1)?.getBoundingClientRect().right ?? 0)
    // Kept inside the visible part of the table, so the line is never drawn
    // over whatever sits beside it.
    const indicatorX = container ? Math.min(Math.max(edge, container.left), container.right) : edge
    return { dropIndex, indicatorX }
  }

  const drop = (id: string, dropIndex: number) => {
    const visible = headingCells().map((cell) => cell.dataset.columnId!)
    const all = ordered.map(columnId).filter((key) => key !== 'actions')
    const without = all.filter((key) => key !== id)
    const before = visible[dropIndex]
    let at: number
    if (before === undefined) {
      const lastVisible = [...visible].reverse().find((key) => key !== id)
      at = lastVisible === undefined ? without.length : without.indexOf(lastVisible) + 1
    } else if (before === id) {
      return
    } else {
      at = without.indexOf(before)
    }
    const next = [...without]
    next.splice(at, 0, id)
    if (next.join('|') !== all.join('|')) saveOrder(next)
  }

  const pressHeading = (event: PointerEvent<HTMLTableCellElement>, id: string, label: string) => {
    if (!reorderableColumns || id === 'actions' || event.button !== 0) return
    // Controls inside a heading keep working as controls.
    if ((event.target as HTMLElement).closest('input, select, textarea, [role="separator"]')) return
    pressed.current = { id, label, x: event.clientX, y: event.clientY }
  }

  useEffect(() => {
    if (!reorderableColumns) return

    let scrollTimer: number | null = null
    const stopScrolling = () => {
      if (scrollTimer !== null) window.clearInterval(scrollTimer)
      scrollTimer = null
    }

    const onMove = (event: globalThis.PointerEvent) => {
      const press = pressed.current
      if (!press) return
      pointerX.current = event.clientX
      if (!active.current) {
        // A few pixels of travel before it counts, so a plain click is just a click.
        if (Math.hypot(event.clientX - press.x, event.clientY - press.y) < 6) return
        active.current = true
        document.body.style.userSelect = 'none'
        document.body.style.cursor = 'grabbing'
        // Scrolls while the pointer is held near an edge — an interval rather
        // than animation frames, so it keeps going while the pointer holds
        // still and stops the moment the drag does.
        scrollTimer = window.setInterval(() => {
          const container = scrollRef.current
          if (!container) return
          const rect = container.getBoundingClientRect()
          const zone = 64
          const x = pointerX.current
          let step = 0
          if (x < rect.left + zone) step = -Math.ceil(((rect.left + zone - x) / zone) * 18)
          else if (x > rect.right - zone) step = Math.ceil(((x - (rect.right - zone)) / zone) * 18)
          if (step === 0) return
          container.scrollLeft += Math.max(-36, Math.min(36, step))
          setDragging((latest) => (latest ? { ...latest, ...dropTarget(x) } : latest))
        }, 16)
      }
      setDragging({
        id: press.id,
        label: press.label,
        x: event.clientX,
        y: event.clientY,
        ...dropTarget(event.clientX),
      })
    }

    const finish = (commit: boolean) => {
      stopScrolling()
      const press = pressed.current
      const wasDragging = active.current
      pressed.current = null
      active.current = false
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
      if (press && wasDragging) {
        draggedAt.current = Date.now()
        if (commit) drop(press.id, dropTarget(pointerX.current).dropIndex)
      }
      setDragging(null)
    }

    const onUp = () => finish(true)
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !active.current) return
      // Esc during a drag cancels the drag, and only that — not the dialog
      // or panel the table happens to sit in.
      event.preventDefault()
      event.stopImmediatePropagation()
      finish(false)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    // Capture on window, so it is heard before a dialog's own Esc handling.
    window.addEventListener('keydown', onKey, true)
    return () => {
      stopScrolling()
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      window.removeEventListener('keydown', onKey, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reorderableColumns, ordered])
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
    state: { columnVisibility },
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

  const columnsMenu = (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="ghost" size="sm" className="ml-auto">
          <Settings2 />
          {t('Columns')}
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
                    {/* Ordering by arrows here works on every table. Tables
                        with `reorderableColumns` can also be rearranged by
                        dragging a heading, which scrolls the table itself
                        when held near an edge. */}
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
  )

  return (
    <div className="rounded-card border-border bg-surface shadow-card overflow-hidden border">
      {columnsMenuContainer === undefined || toolbar ? (
        <div className="border-border flex flex-wrap items-center gap-2 border-b p-2">
          {toolbar}
          {columnsMenuContainer === undefined ? columnsMenu : null}
        </div>
      ) : null}
      {columnsMenuContainer ? createPortal(columnsMenu, columnsMenuContainer) : null}

      <div ref={scrollRef} className="overflow-x-auto">
        {/*
          `min-w-max` is what makes the scroll real. Without it the table is
          only ever as wide as its container, so a table with more columns than
          fit squeezes every one of them and hides the overflow behind an
          ellipsis instead of letting the user scroll to it.
        */}
        <table className="w-full min-w-max border-collapse text-sm">
          <thead className="bg-surface-muted">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const alignRight = header.column.columnDef.meta?.align === 'right'
                  const resizable = header.column.id !== 'actions'
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      data-column-id={header.column.id}
                      style={widthStyle(widths[header.column.id])}
                      onPointerDown={(event) =>
                        pressHeading(
                          event,
                          header.column.id,
                          typeof header.column.columnDef.header === 'string'
                            ? header.column.columnDef.header
                            : header.column.id,
                        )
                      }
                      onClickCapture={(event) => {
                        if (Date.now() - draggedAt.current > 250) return
                        draggedAt.current = 0
                        event.preventDefault()
                        event.stopPropagation()
                      }}
                      title={
                        reorderableColumns && header.column.id !== 'actions'
                          ? t('Drag to move this column')
                          : undefined
                      }
                      className={cn(
                        'text-2xs text-fg-muted group/th relative h-10 px-3 font-semibold tracking-wide whitespace-nowrap uppercase',
                        widths[header.column.id] !== undefined && 'overflow-hidden text-ellipsis',
                        alignRight ? 'text-right' : 'text-left',
                        reorderableColumns && header.column.id !== 'actions' && 'cursor-grab',
                        dragging?.id === header.column.id && 'bg-primary-soft text-primary',
                      )}
                    >
                      {/* No sort control on a heading (client request): a heading
                          is for reading and for dragging. */}
                      {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                      {resizable ? (
                        <span
                          role="separator"
                          aria-orientation="vertical"
                          aria-label={t('Drag to resize the column, double-click to fit it')}
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
                      title={t('Nothing here yet')}
                      description={t('Try clearing your filters, or add the first record.')}
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
                    onRowClick && 'hover:bg-primary-soft/50 cursor-pointer',
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
                        dragging?.id === cell.column.id && 'bg-primary-soft/40 opacity-60',
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

      {dragging
        ? createPortal(
            <>
              <div
                aria-hidden
                className="bg-primary pointer-events-none fixed z-[100] w-0.5 rounded-full"
                style={{
                  left: dragging.indicatorX - 1,
                  top: scrollRef.current?.getBoundingClientRect().top ?? 0,
                  height: Math.min(
                    scrollRef.current?.getBoundingClientRect().height ?? 0,
                    window.innerHeight,
                  ),
                }}
              />
              <div
                aria-hidden
                className="bg-surface border-primary text-primary shadow-popover text-2xs rounded-control pointer-events-none fixed z-[100] border px-2.5 py-1.5 font-semibold tracking-wide whitespace-nowrap uppercase"
                style={{ left: dragging.x + 12, top: dragging.y + 12 }}
              >
                {dragging.label}
              </div>
            </>,
            document.body,
          )
        : null}

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
