import { useMemo, useState, type ReactNode } from 'react'
import { ChevronDown, Plus, Trash2, type LucideIcon } from 'lucide-react'
import { DropdownMenu } from 'radix-ui'
import { DataTable } from '@/shared/components/DataTable'
import { SearchInput } from '@/shared/components/SearchInput'
import { EmptyState } from '@/shared/components/EmptyState'
import { ProductThumb } from '@/shared/components/ProductThumb'
import type { TableColumn } from '@/shared/components/table/features'
import { Button } from '@/shared/ui/Button'
import { matches } from '@/data/query'
import { useDataStore } from '@/data/store'
import { formatMoney, formatNumber } from '@/shared/lib/format'
import type { VariationRow } from '@/features/products/model/product'

/**
 * The lines of a document — a transfer, an order, a goods receipt — laid out
 * like the reference product's own screen.
 *
 * The lines are the page: a full-width table carrying the same columns the
 * product list does (ID, variation, barcode, SKU, product name, stock, price),
 * so a part reads the same everywhere it appears, with the document's own
 * editable columns slotted in after the name. Adding happens from one button
 * top-right rather than a search box above the table, and the totals sit
 * underneath where OX keeps them.
 *
 * The page supplies only what is specific to it: its editable columns, what
 * "Add products" offers, and how to remove a line.
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

const Empty = () => <span className="text-fg-subtle">—</span>

export function LineItemsTable<T extends LineRow>({
  rows,
  columns,
  addActions,
  onRemove,
  storageKey,
  emptyTitle = 'No products yet',
  emptyDescription = 'Use “Add products” to put the first line on.',
  error,
  totals,
}: {
  rows: T[]
  /** The document's own columns, placed after the product name. */
  columns: TableColumn<T>[]
  addActions: AddAction[]
  onRemove: (row: T) => void
  storageKey: string
  emptyTitle?: string
  emptyDescription?: string
  /** A form error about the lines as a whole, e.g. "Add at least one product". */
  error?: string
  /** Extra figures for the footer, beside the quantity — an order's value, say. */
  totals?: { label: string; value: string }[]
}) {
  const variations = useDataStore((s) => s.variations)
  const byId = useMemo(() => new Map(variations.map((v) => [v.id, v])), [variations])
  const [search, setSearch] = useState('')

  const variationOf = (row: T): VariationRow | undefined => byId.get(row.variationId)

  const shown = useMemo(
    () =>
      rows.filter((row) => {
        const v = byId.get(row.variationId)
        return matches([v?.fullName, v?.productName, v?.sku, v?.barcode, v?.description], search)
      }),
    [rows, byId, search],
  )

  const allColumns = useMemo<TableColumn<T>[]>(
    () => [
      {
        id: 'variationId',
        header: 'ID',
        cell: ({ row }) => (
          <span className="text-2xs text-fg-muted font-mono">{row.original.variationId}</span>
        ),
      },
      {
        id: 'variation',
        header: 'Variation',
        enableHiding: false,
        cell: ({ row }) => {
          const v = variationOf(row.original)
          return (
            <div className="flex max-w-72 items-center gap-2.5">
              <ProductThumb src={v?.imageUrl ?? null} size="sm" />
              <span className="text-fg truncate font-medium">
                {v?.fullName ?? 'Removed product'}
              </span>
            </div>
          )
        },
      },
      {
        id: 'barcode',
        header: 'Barcode',
        cell: ({ row }) => {
          const code = variationOf(row.original)?.barcode
          return code ? <span className="text-2xs font-mono">{code}</span> : <Empty />
        },
      },
      {
        id: 'sku',
        header: 'SKU',
        cell: ({ row }) => (
          <span className="text-2xs font-mono">{variationOf(row.original)?.sku ?? '—'}</span>
        ),
      },
      {
        id: 'productName',
        header: 'Product name',
        cell: ({ row }) => (
          <span className="text-fg-muted block max-w-56 truncate">
            {variationOf(row.original)?.productName ?? '—'}
          </span>
        ),
      },
      {
        id: 'brand',
        header: 'Brand',
        cell: ({ row }) => variationOf(row.original)?.brandName ?? <Empty />,
      },
      {
        id: 'category',
        header: 'Category',
        cell: ({ row }) => variationOf(row.original)?.categoryName ?? <Empty />,
      },
      ...columns,
      {
        id: 'stock',
        header: 'Current stock',
        meta: { align: 'right' },
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatNumber(variationOf(row.original)?.stock ?? 0)}
          </span>
        ),
      },
      {
        id: 'salePrice',
        header: 'Sale price',
        meta: { align: 'right' },
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatMoney(variationOf(row.original)?.salePrice ?? 0)}
          </span>
        ),
      },
      {
        id: 'remove',
        header: '',
        enableHiding: false,
        cell: ({ row }) => (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Remove ${variationOf(row.original)?.fullName ?? 'line'}`}
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

  return (
    <div className="space-y-2">
      <DataTable
        storageKey={storageKey}
        columns={allColumns}
        data={shown}
        total={shown.length}
        getRowId={(row) => row.key}
        initialHidden={['brand', 'category']}
        toolbar={
          <>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search by barcode, SKU or name…"
            />
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <Button type="button" variant="primary" size="sm" className="order-last">
                  <Plus />
                  Add products
                  <ChevronDown />
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  sideOffset={4}
                  className="rounded-control border-border bg-surface shadow-popover z-50 min-w-60 border p-1"
                >
                  {addActions.map((action) => (
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
        }
        emptyState={
          search ? (
            <EmptyState title="No line matches that search" />
          ) : (
            <EmptyState title={emptyTitle} description={emptyDescription} />
          )
        }
        footer={
          // The totals OX keeps under its lines.
          <div className="border-border text-fg-muted flex flex-wrap items-center gap-5 border-t px-4 py-3 text-sm">
            <span className="flex items-center gap-2">
              Total quantity
              <Count value={totalQuantity} />
            </span>
            <span className="flex items-center gap-2">
              Product variations
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
