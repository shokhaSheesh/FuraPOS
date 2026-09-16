import { Info, Trash2 } from 'lucide-react'
import { NumberField } from '@/shared/components/NumberField'
import { ProductThumb } from '@/shared/components/ProductThumb'
import { Button } from '@/shared/ui/Button'
import type { TableColumn } from '@/shared/components/table/features'
import { formatMoney, formatNumber } from '@/shared/lib/format'
import type { ReceiptLine } from '../model/receipt'

export interface LineRow extends ReceiptLine {
  /** Where the row sits, so an edit knows which line it changed. */
  index: number
  /** What is on the shelf right now, per location — the reference's tooltip. */
  stockHere: { locationName: string; quantity: number }[]
  barcode: string
  productName: string
  brandName: string | null
  categoryPath: string | null
  salePrice: number
}

const Empty = () => <span className="text-fg-subtle">—</span>

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
 * The lines of a receipt while it is being built — the reference product's
 * first step, column for column, with our own catalogue fields in place of
 * theirs.
 *
 * The received quantity is the only editable cell: everything else describes a
 * product that already exists, and changing it here would be editing the
 * catalogue from inside a delivery note.
 */
export function buildReceiptLineColumns({
  editable,
  onQuantityChange,
  onRemove,
  cards,
}: {
  editable: boolean
  onQuantityChange: (index: number, quantity: number) => void
  onRemove: (index: number) => void
  /** Collapses the product columns into one rich cell, as OX's grid view does. */
  cards: boolean
}): TableColumn<LineRow>[] {
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

  const quantity: TableColumn<LineRow>[] = [
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
    {
      id: 'currentStock',
      header: 'Current stock',
      meta: { align: 'right' },
      cell: ({ row }) => <StockCell row={row.original} />,
    },
    {
      id: 'salePrice',
      header: 'Sale price',
      meta: { align: 'right' },
      cell: ({ row }) => formatMoney(row.original.salePrice),
    },
    {
      id: 'supplyPrice',
      header: 'Supplier price',
      meta: { align: 'right' },
      cell: ({ row }) => (
        <span className="tabular-nums">
          {row.original.costCurrency === 'USD'
            ? `${row.original.unitCost.toFixed(2)} USD`
            : formatMoney(row.original.unitCost)}
        </span>
      ),
    },
  ]

  if (cards) {
    return [
      {
        id: 'product',
        header: 'Product',
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex items-start gap-3">
            <ProductThumb src={row.original.imageUrl} />
            <div className="min-w-0">
              <p className="text-fg text-sm font-medium">{row.original.name}</p>
              <p className="text-fg-subtle text-2xs mt-0.5">
                {[
                  row.original.barcode,
                  row.original.sku,
                  row.original.categoryPath,
                  row.original.brandName,
                  row.original.productName,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
          </div>
        ),
      },
      ...quantity,
      ...actions,
    ]
  }

  return [
    {
      id: 'id',
      header: 'ID',
      cell: ({ row }) => <span className="text-2xs font-mono">{row.original.variationId}</span>,
    },
    {
      id: 'name',
      header: 'Variation name',
      enableHiding: false,
      cell: ({ row }) => row.original.name,
    },
    {
      id: 'barcode',
      header: 'Barcode',
      cell: ({ row }) =>
        row.original.barcode ? (
          <span className="text-2xs font-mono">{row.original.barcode}</span>
        ) : (
          <Empty />
        ),
    },
    {
      id: 'sku',
      header: 'SKU',
      cell: ({ row }) => <span className="text-2xs font-mono">{row.original.sku}</span>,
    },
    {
      id: 'productName',
      header: 'Product name',
      cell: ({ row }) => row.original.productName,
    },
    ...quantity,
    ...actions,
  ]
}

/**
 * The review step's columns. Deliberately not the same list: this is the
 * before-and-after view — what was expected against what turned up, and the
 * cost price each line is about to be written to the catalogue with.
 */
export function buildReceiptReviewColumns({
  landedCostOf,
  costLabel,
}: {
  landedCostOf: (row: LineRow) => string
  costLabel: string
}): TableColumn<LineRow>[] {
  return [
    {
      id: 'id',
      header: 'ID',
      cell: ({ row }) => <span className="text-2xs font-mono">{row.original.variationId}</span>,
    },
    {
      id: 'barcode',
      header: 'Barcode',
      cell: ({ row }) =>
        row.original.barcode ? (
          <span className="text-2xs font-mono">{row.original.barcode}</span>
        ) : (
          <Empty />
        ),
    },
    {
      id: 'productName',
      header: 'Product name',
      enableHiding: false,
      cell: ({ row }) => row.original.productName,
    },
    {
      id: 'sku',
      header: 'SKU',
      cell: ({ row }) => <span className="text-2xs font-mono">{row.original.sku}</span>,
    },
    {
      id: 'name',
      header: 'Variation name',
      cell: ({ row }) => row.original.name,
    },
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
    {
      id: 'salePrice',
      header: 'Sale price',
      meta: { align: 'right' },
      cell: ({ row }) => formatMoney(row.original.salePrice),
    },
    {
      id: 'landed',
      header: costLabel,
      enableHiding: false,
      meta: { align: 'right' },
      cell: ({ row }) => (
        <span className="text-fg font-medium tabular-nums">{landedCostOf(row.original)}</span>
      ),
    },
  ]
}
