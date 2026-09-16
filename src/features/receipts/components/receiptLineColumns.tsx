import { Info, Trash2 } from 'lucide-react'
import { NumberField } from '@/shared/components/NumberField'
import { ProductThumb } from '@/shared/components/ProductThumb'
import type { TableColumn } from '@/shared/components/table/features'
import { Button } from '@/shared/ui/Button'
import { formatMoney, formatNumber } from '@/shared/lib/format'
import {
  buildProductFieldColumns,
  PRODUCT_FIELD_COLUMN_IDS,
} from '@/features/products/components/productFieldColumns'
import type { VariationRow } from '@/features/products/model/product'
import type { ReceiptLine } from '../model/receipt'

export interface LineRow extends ReceiptLine {
  /** Where the row sits, so an edit knows which line it changed. */
  index: number
  /** The catalogue row this line points at, for the product columns. */
  variation: VariationRow | undefined
  /** What is on the shelf right now, per location — the reference's tooltip. */
  stockHere: { locationName: string; quantity: number }[]
}

const variationOf = (row: LineRow) => row.variation

/** What a row *is*. The receipt's own columns go straight after these. */
const IDENTITY_COLUMNS = PRODUCT_FIELD_COLUMN_IDS.slice(
  0,
  PRODUCT_FIELD_COLUMN_IDS.indexOf('stock'),
)

const totalStock = (row: LineRow) => row.stockHere.reduce((sum, s) => sum + s.quantity, 0)

/**
 * What is on the shelf now, broken down by location.
 *
 * The number alone is the one people mistrust — "10 where?" — so the breakdown
 * sits on the number itself rather than in a column nobody would turn on.
 */
function StockCell({ row }: { row: LineRow }) {
  return (
    <span
      className="inline-flex items-center gap-1 tabular-nums"
      title={
        row.stockHere.length
          ? row.stockHere.map((s) => `${s.locationName}: ${formatNumber(s.quantity)}`).join('\n')
          : 'Nothing on any shelf yet'
      }
    >
      {formatNumber(totalStock(row))}
      <Info className="text-info size-3.5" aria-hidden />
    </span>
  )
}

/**
 * The catalogue's Quantity column, with the per-location breakdown on it.
 *
 * On a delivery note the number people mistrust is this one — "31 where?" —
 * so the split sits on the figure itself. The catalogue's own list answers it
 * with a Location column instead, which is enough when you are not standing in
 * front of an open box.
 */
function withStockBreakdown(fields: TableColumn<LineRow>[]) {
  return fields.map((column) =>
    column.id === 'stock'
      ? {
          ...column,
          cell: ({ row }: { row: { original: LineRow } }) => <StockCell row={row.original} />,
        }
      : column,
  )
}

/** Splits the catalogue's columns either side of the document's own. */
function split(fields: TableColumn<LineRow>[]) {
  const is = (column: TableColumn<LineRow>) => IDENTITY_COLUMNS.includes(column.id ?? '')
  return { identity: fields.filter(is), rest: fields.filter((column) => !is(column)) }
}

/**
 * The lines of a receipt while it is being built.
 *
 * The product columns are the product list's, field for field — see
 * `buildProductFieldColumns` for why. On top of them sit the three the
 * document owns: what was counted, what is on the shelf already, and what the
 * supplier invoiced for *this* delivery, which is not necessarily the
 * catalogue's last known cost.
 *
 * The counted quantity is the only editable cell: everything else describes a
 * product that already exists, and changing it here would be editing the
 * catalogue from inside a delivery note.
 */
export function buildReceiptLineColumns({
  editable,
  canSeeCost,
  cards,
  onQuantityChange,
  onRemove,
}: {
  editable: boolean
  canSeeCost: boolean
  /** Collapses the identity columns into one rich cell, as OX's grid view does. */
  cards: boolean
  onQuantityChange: (index: number, quantity: number) => void
  onRemove: (index: number) => void
}): TableColumn<LineRow>[] {
  const { identity, rest } = split(
    withStockBreakdown(buildProductFieldColumns<LineRow>({ variationOf, canSeeCost })),
  )

  // The card view folds *only* the identity block into one cell. Everything
  // else stays a column, so switching view never loses a field.
  const lead: TableColumn<LineRow>[] = cards
    ? [
        {
          id: 'product',
          header: 'Product',
          enableHiding: false,
          cell: ({ row }) => {
            const v = row.original.variation
            return (
              <div className="flex items-start gap-3">
                <ProductThumb src={v?.imageUrl ?? null} />
                <div className="min-w-0">
                  <p className="text-fg text-sm font-medium">{v?.fullName ?? row.original.name}</p>
                  <p className="text-fg-subtle text-2xs mt-0.5">
                    {[v?.barcode, v?.sku, v?.categoryPath, v?.brandName, v?.productName]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
              </div>
            )
          },
        },
      ]
    : identity

  const own: TableColumn<LineRow>[] = [
    {
      id: 'count',
      header: 'Actual quantity',
      enableHiding: false,
      meta: { align: 'right' },
      cell: ({ row }) =>
        editable ? (
          <div className="flex justify-end">
            <NumberField
              className="w-20"
              nullable={false}
              min={0}
              aria-label={`Actual quantity of ${row.original.name}`}
              value={row.original.receivedQuantity ?? row.original.orderedQuantity}
              onChange={(v) => onQuantityChange(row.original.index, v ?? 0)}
            />
          </div>
        ) : (
          formatNumber(row.original.receivedQuantity ?? row.original.orderedQuantity)
        ),
    },
    ...(canSeeCost
      ? ([
          {
            id: 'lineCost',
            header: 'Invoiced price',
            meta: { align: 'right' as const },
            cell: ({ row }) => (
              <span className="tabular-nums">
                {row.original.costCurrency === 'USD'
                  ? `${row.original.unitCost.toFixed(2)} USD`
                  : formatMoney(row.original.unitCost)}
              </span>
            ),
          },
        ] as TableColumn<LineRow>[])
      : []),
  ]

  // Last, not first: removing a line is the least likely thing anyone does to
  // it, and a destructive control in the leading column is the one you hit by
  // accident on the way to the row.
  const actions: TableColumn<LineRow>[] = editable
    ? [
        {
          id: 'rowActions',
          header: '',
          enableHiding: false,
          cell: ({ row }) => (
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remove ${row.original.name} from this receipt`}
                title="Remove from this receipt"
                className="hover:text-danger"
                onClick={() => onRemove(row.original.index)}
              >
                <Trash2 />
              </Button>
            </div>
          ),
        },
      ]
    : []

  return [...lead, ...own, ...rest, ...actions]
}

/**
 * The review step's columns. The same catalogue fields again, with the
 * before-and-after the step exists for: what was expected against what turned
 * up, and the cost price each line is about to be written to the catalogue
 * with.
 */
export function buildReceiptReviewColumns({
  canSeeCost,
  landedCostOf,
  costLabel,
}: {
  canSeeCost: boolean
  landedCostOf: (row: LineRow) => string
  costLabel: string
}): TableColumn<LineRow>[] {
  const { identity, rest } = split(buildProductFieldColumns<LineRow>({ variationOf, canSeeCost }))

  const own: TableColumn<LineRow>[] = [
    {
      id: 'count',
      header: 'Actual quantity',
      meta: { align: 'right' },
      cell: ({ row }) =>
        formatNumber(row.original.receivedQuantity ?? row.original.orderedQuantity),
    },
    {
      id: 'expected',
      header: 'Expected quantity',
      meta: { align: 'right' },
      cell: ({ row }) => formatNumber(row.original.orderedQuantity),
    },
    ...(canSeeCost
      ? ([
          {
            id: 'landed',
            header: costLabel,
            enableHiding: false,
            meta: { align: 'right' as const },
            cell: ({ row }) => (
              <span className="text-fg font-medium tabular-nums">{landedCostOf(row.original)}</span>
            ),
          },
        ] as TableColumn<LineRow>[])
      : []),
  ]

  return [...identity, ...own, ...rest]
}
