import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  Barcode,
  ChevronDown,
  PackagePlus,
  Plus,
  ScanLine,
  Trash2,
  X,
  type LucideIcon,
} from 'lucide-react'
import { DropdownMenu } from 'radix-ui'
import { DataTable } from '@/shared/components/DataTable'
import { SearchInput } from '@/shared/components/SearchInput'
import { EmptyState } from '@/shared/components/EmptyState'
import { ProductThumb } from '@/shared/components/ProductThumb'
import type { TableColumn } from '@/shared/components/table/features'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { cn } from '@/shared/lib/cn'
import { matches } from '@/data/query'
import { useDataStore } from '@/data/store'
import { formatNumber } from '@/shared/lib/format'
import type { CatalogueHit } from '@/shared/lib/catalogueSearch'
import type { VariationRow } from '@/features/products/model/product'
import {
  buildProductFieldColumns,
  PRODUCT_FIELD_COLUMN_IDS,
} from '@/features/products/components/productFieldColumns'
import { t } from '@/shared/i18n'

/**
 * The lines of a document — a transfer, an order, a goods receipt — laid out
 * like the reference product's own screen.
 *
 * The lines are the page: a full-width table carrying the product list's
 * columns, with the document's own editable columns after the name, and the
 * totals underneath.
 *
 * **Adding works the way OX does it.** "Add products → From the catalogue"
 * does not open a picker; it switches the toolbar into *add mode*: one search
 * box ("search or scan barcode") and a "Close mode" button. Typing drops down
 * the matching products; picking one puts it at the top of the table,
 * highlighted, and clears the box for the next — which is also exactly what
 * a barcode scanner needs, since it types a code and presses Enter.
 */

export interface LineRow {
  /** Stable per line — the form's field id — so a quantity input keeps focus. */
  key: string
  /** Index into the form's lines array, for the page's own Controllers. */
  index: number
  variationId: string
  quantity: number
}

export interface AddAction {
  label: string
  icon: LucideIcon
  onSelect: () => void
  disabled?: boolean
  hint?: string
}

export interface CatalogueSource {
  /** What "From …" says in the menu, e.g. "our catalogue" or "AKCHAEV INC's catalogue". */
  label: string
  search: (term: string) => CatalogueHit[]
  /** Adds the line, or one more of it. Returns the variation id it landed on. */
  onPick: (hitId: string) => string | null
}

/** What a row *is*. The document's own columns are placed straight after these. */
const IDENTITY_COLUMNS = PRODUCT_FIELD_COLUMN_IDS.slice(
  0,
  PRODUCT_FIELD_COLUMN_IDS.indexOf('stock'),
)

export function LineItemsTable<T extends LineRow>({
  rows,
  columns,
  catalogue,
  addActions = [],
  onRemove,
  storageKey,
  emptyTitle = 'No products yet',
  emptyDescription = 'Use “Add products” to put the first line on.',
  error,
  totals,
  canSeeCost = true,
}: {
  rows: T[]
  /** The document's own columns, placed after the product name. */
  columns: TableColumn<T>[]
  /** Where "From the catalogue" searches. */
  catalogue: CatalogueSource
  /** Anything else "Add products" offers — Suggest, New item. */
  addActions?: AddAction[]
  onRemove: (row: T) => void
  storageKey: string
  emptyTitle?: string
  emptyDescription?: string
  /** A form error about the lines as a whole, e.g. "Add at least one product". */
  error?: string
  /** Extra figures for the footer, beside the quantity — an order's value, say. */
  totals?: { label: string; value: string }[]
  /** Hides the supplier price from roles that may not see what we pay. */
  canSeeCost?: boolean
}) {
  const variations = useDataStore((s) => s.variations)
  const byId = useMemo(() => new Map(variations.map((v) => [v.id, v])), [variations])
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)
  const [lastAdded, setLastAdded] = useState<string | null>(null)

  const variationOf = (row: T): VariationRow | undefined => byId.get(row.variationId)

  /*
    Everything the product list shows. The document's own columns go after the
    identity block — image, product, variation, SKU, barcode — because that is
    where the eye is when a quantity is being typed.
  */
  const productFields = useMemo(
    () =>
      buildProductFieldColumns<T>({ variationOf: (row) => byId.get(row.variationId), canSeeCost }),
    [byId, canSeeCost],
  )
  const identityCount = productFields.filter((column) =>
    IDENTITY_COLUMNS.includes(column.id ?? ''),
  ).length

  // Newest first, as OX shows them: what was just added is where the eye is.
  const shown = useMemo(
    () =>
      [...rows].reverse().filter((row) => {
        if (adding) return true
        const v = byId.get(row.variationId)
        return matches([v?.fullName, v?.productName, v?.sku, v?.barcode, v?.description], search)
      }),
    [rows, byId, search, adding],
  )

  const allColumns = useMemo<TableColumn<T>[]>(
    () => [
      {
        id: 'variationId',
        header: t('ID'),
        cell: ({ row }) => (
          <span className="text-2xs text-fg-muted font-mono">{row.original.variationId}</span>
        ),
      },
      /*
        The catalogue's own fields, identical to the product list's — see
        `buildProductFieldColumns`. The document's editable columns are slotted
        in after the row's identity rather than appended, so the quantity being
        typed sits beside the name it belongs to.
      */
      ...productFields.slice(0, identityCount),
      ...columns,
      ...productFields.slice(identityCount),
      {
        id: 'remove',
        header: '',
        enableHiding: false,
        cell: ({ row }) => (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t('Remove {p0}', { p0: variationOf(row.original)?.fullName ?? 'line' })}
            className="hover:text-danger"
            onClick={() => onRemove(row.original)}
          >
            <Trash2 />
          </Button>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [columns, byId, onRemove],
  )

  const totalQuantity = rows.reduce((sum, row) => sum + row.quantity, 0)

  const toolbar = adding ? (
    <>
      <CatalogueSearch catalogue={catalogue} onAdded={(variationId) => setLastAdded(variationId)} />
      {/* OX's "Закрыть режим": back to the lines, with their own search. */}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="border-danger/40 text-danger hover:bg-danger-soft order-last"
        onClick={() => {
          setAdding(false)
          setLastAdded(null)
        }}
      >
        <X />
        {t('Close mode')}
      </Button>
    </>
  ) : (
    <>
      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder={t('Search by barcode, SKU or name…')}
      />
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <Button type="button" variant="primary" size="sm" className="order-last">
            <Plus />
            {t('Add products')}
            <ChevronDown />
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={4}
            className="rounded-control border-border bg-surface shadow-popover z-50 min-w-64 border p-1"
          >
            {[
              {
                label: t('From {label}', { label: catalogue.label }),
                hint: t('Search or scan, and add straight to the list'),
                icon: PackagePlus,
                onSelect: () => {
                  setSearch('')
                  setAdding(true)
                },
              } satisfies AddAction,
              ...addActions,
            ].map((action) => (
              <DropdownMenu.Item
                key={action.label}
                disabled={action.disabled}
                onSelect={action.onSelect}
                className="data-[highlighted]:bg-surface-muted flex cursor-pointer items-start gap-2 rounded px-2 py-1.5 text-sm outline-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50"
              >
                <action.icon className="text-fg-muted mt-0.5 size-4 shrink-0" />
                <span>
                  <span className="text-fg block">{action.label}</span>
                  {action.hint ? (
                    <span className="text-fg-subtle text-2xs block">{action.hint}</span>
                  ) : null}
                </span>
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </>
  )

  return (
    <DataTable
      storageKey={storageKey}
      columns={allColumns}
      data={shown}
      total={shown.length}
      getRowId={(row) => row.key}
      rowClassName={(row) => (row.variationId === lastAdded ? 'bg-success-soft' : undefined)}
      initialHidden={['brand', 'category']}
      toolbar={toolbar}
      emptyState={
        search && !adding ? (
          <EmptyState title={t('No line matches that search')} />
        ) : (
          <EmptyState
            title={emptyTitle}
            description={
              adding
                ? t('Search or scan above — each product you pick lands here.')
                : emptyDescription
            }
          />
        )
      }
      footer={
        // The totals OX keeps under its lines.
        <div className="border-border text-fg-muted flex flex-wrap items-center gap-5 border-t px-4 py-3 text-sm">
          <span className="flex items-center gap-2">
            {t('Total quantity')}
            <Count value={totalQuantity} />
          </span>
          <span className="flex items-center gap-2">
            {t('Product variations')}
            <Count value={rows.length} />
          </span>
          {totals?.map((total) => (
            <span key={total.label} className="flex items-center gap-2">
              {total.label}
              <span className="text-fg font-semibold tabular-nums">{total.value}</span>
            </span>
          ))}
          {error ? <span className="text-danger ml-auto text-sm">{error}</span> : null}
        </div>
      }
    />
  )
}

/**
 * The add-mode search box and its dropdown.
 *
 * Focus lands here on entering the mode and comes back after every pick, and
 * Enter adds the highlighted result — so a scanner, which types a barcode and
 * presses Enter, adds a line per scan without anyone touching the mouse.
 */
function CatalogueSearch({
  catalogue,
  onAdded,
}: {
  catalogue: CatalogueSource
  onAdded: (variationId: string) => void
}) {
  const [term, setTerm] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => inputRef.current?.focus(), [])

  const hits = useMemo(() => catalogue.search(term), [catalogue, term])
  useEffect(() => setActive(0), [term])

  /*
   * The dropdown is portalled and placed under the box by hand: the table it
   * sits in clips its overflow (rounded corners), which would cut the list off.
   */
  const [anchor, setAnchor] = useState<{ left: number; top: number } | null>(null)
  const open = Boolean(term.trim())
  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const r = inputRef.current?.getBoundingClientRect()
      if (r) setAnchor({ left: r.left, top: r.bottom + 4 })
    }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open])

  const pick = (hit: CatalogueHit | undefined) => {
    if (!hit || hit.disabled) return
    const landed = catalogue.onPick(hit.id)
    if (landed) onAdded(landed)
    setTerm('')
    inputRef.current?.focus()
  }

  return (
    <div className="relative w-full max-w-xl">
      <ScanLine className="text-fg-subtle pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
      <Input
        ref={inputRef}
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setActive((i) => Math.min(i + 1, hits.length - 1))
          } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            setActive((i) => Math.max(i - 1, 0))
          } else if (event.key === 'Enter') {
            event.preventDefault()
            pick(hits[active])
          } else if (event.key === 'Escape') {
            setTerm('')
          }
        }}
        placeholder={t('Search or scan barcode…')}
        aria-label={t('Search or scan a product to add')}
        className="pl-8"
      />

      {open && anchor
        ? createPortal(
            <div
              style={{ left: anchor.left, top: anchor.top }}
              className="rounded-card border-border bg-surface shadow-popover fixed z-50 max-h-[28rem] w-[min(40rem,calc(100vw-2rem))] overflow-y-auto border"
            >
              {hits.length === 0 ? (
                <p className="text-fg-muted p-4 text-center text-sm">
                  {t('Nothing matches “')}
                  {term.trim()}”
                </p>
              ) : (
                <ul className="divide-border divide-y">
                  {hits.map((hit, index) => (
                    <li key={hit.id}>
                      <button
                        type="button"
                        disabled={hit.disabled}
                        onMouseEnter={() => setActive(index)}
                        // mousedown, so the input keeps focus and the dropdown does
                        // not close before the click lands.
                        onMouseDown={(event) => {
                          event.preventDefault()
                          pick(hit)
                        }}
                        className={cn(
                          'flex w-full items-start gap-3 px-3 py-2.5 text-left disabled:cursor-not-allowed disabled:opacity-60',
                          index === active && !hit.disabled && 'bg-surface-muted',
                        )}
                      >
                        <ProductThumb src={hit.imageUrl} size="md" />
                        <span className="min-w-0 flex-1">
                          <span className="text-fg block text-sm font-semibold">{hit.name}</span>
                          {hit.codes.length ? (
                            <span className="text-fg-muted text-2xs flex items-center gap-1 font-mono">
                              <Barcode className="size-3" />
                              {hit.codes.join(' · ')}
                            </span>
                          ) : null}
                          {hit.details.length ? (
                            <span className="text-fg-subtle text-2xs block">
                              {hit.details.join(' · ')}
                            </span>
                          ) : null}
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="text-fg-muted block text-sm font-medium tabular-nums">
                            {hit.price}
                          </span>
                          {hit.note ? (
                            <span
                              className={cn(
                                'text-2xs block',
                                hit.note.tone === 'danger' && 'text-danger',
                                hit.note.tone === 'info' && 'text-info',
                                hit.note.tone === 'muted' && 'text-fg-subtle',
                              )}
                            >
                              {hit.note.text}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}

function Count({ value }: { value: number }): ReactNode {
  return (
    <span className="bg-primary text-primary-fg text-2xs min-w-6 rounded-full px-1.5 py-0.5 text-center font-semibold tabular-nums">
      {formatNumber(value)}
    </span>
  )
}
