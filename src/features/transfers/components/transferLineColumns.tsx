import { Info, Trash2 } from 'lucide-react'
import { NumberField } from '@/shared/components/NumberField'
import { ProductThumb } from '@/shared/components/ProductThumb'
import type { TableColumn } from '@/shared/components/table/features'
import { Button } from '@/shared/ui/Button'
import { formatNumber } from '@/shared/lib/format'
import {
  buildProductFieldColumns,
  PRODUCT_FIELD_COLUMN_IDS,
} from '@/features/products/components/productFieldColumns'
import type { VariationRow } from '@/features/products/model/product'

/**
 * A row on a transfer's product step.
 *
 * Like a receipt's or an order's, it is not always a line of the document.
 * The table **is the source's shelf**: everything that location holds is a row
 * from the moment the route is chosen, waiting for a quantity, and typing one
 * is what puts it on the transfer.
 *
 * That also removes a whole class of mistake for free. You cannot move what a
 * shelf does not have, so a part the source is out of is simply not on the
 * screen — rather than something you can add, be warned about, and send
 * anyway.
 */
export interface TransferRow {
  /** Stable across renders, so a quantity being typed keeps focus. */
  key: string
  variation: VariationRow
  /** Where the line sits on the transfer, or -1 when it is not on it yet. */
  index: number
  /** How many are being moved. Zero means the row is not on the transfer. */
  quantity: number
  /** What the source can actually spare. */
  atSource: number
  /** What the destination already holds. */
  atDestination: number
  /** Units sold at whichever end receives the goods, over 3 and 6 months. */
  demand: { 3: number; 6: number }
  stalled: boolean
}

/** What a row *is*. The transfer's own columns go straight after these. */
const IDENTITY_COLUMNS = PRODUCT_FIELD_COLUMN_IDS.slice(
  0,
  PRODUCT_FIELD_COLUMN_IDS.indexOf('stock'),
)

function adapt(fields: TableColumn<TransferRow>[]) {
  /*
    The catalogue's Quantity column is stock across the whole business, which
    on this screen is the least interesting of the three numbers — what the
    source holds and what the destination holds are what the decision is made
    from, and both are columns of their own. It stays, with the per-location
    split on it, but it is no longer doing the work.
  */
  return fields.map((column) =>
    column.id === 'stock'
      ? {
          ...column,
          cell: ({ row }: { row: { original: TransferRow } }) => (
            <span
              className="inline-flex items-center gap-1 tabular-nums"
              title={row.original.variation.stockByLocation
                .map((s) => `${s.locationName}: ${formatNumber(s.quantity)}`)
                .join('\n')}
            >
              {formatNumber(row.original.variation.stock)}
              <Info className="text-info size-3.5" aria-hidden />
            </span>
          ),
        }
      : column,
  )
}

/**
 * The transfer's lines over the product list's own fields.
 *
 * Both ends are named rather than called "source" and "destination" — nobody
 * should have to remember which is which — and the sales column follows
 * whoever *receives* the goods, since that is whose demand justifies the move.
 */
export function buildTransferLineColumns({
  canSeeCost,
  cards,
  fromName,
  toName,
  demandName,
  onQuantityChange,
  onRemove,
}: {
  canSeeCost: boolean
  /** Collapses the identity columns into one rich cell. */
  cards: boolean
  fromName: string
  toName: string
  demandName: string
  onQuantityChange: (row: TransferRow, quantity: number) => void
  onRemove: (row: TransferRow) => void
}): TableColumn<TransferRow>[] {
  const fields = adapt(
    buildProductFieldColumns<TransferRow>({
      variationOf: (row) => row.variation,
      canSeeCost,
    }),
  )
  const is = (column: TableColumn<TransferRow>) => IDENTITY_COLUMNS.includes(column.id ?? '')
  const identity = fields.filter(is)
  const rest = fields.filter((column) => !is(column))

  const lead: TableColumn<TransferRow>[] = cards
    ? [
        {
          id: 'product',
          header: 'Product',
          enableHiding: false,
          cell: ({ row }) => {
            const v = row.original.variation
            return (
              <div className="flex items-start gap-3">
                <ProductThumb src={v.imageUrl} />
                <div className="min-w-0">
                  <p className="text-fg text-sm font-medium">{v.fullName}</p>
                  <p className="text-fg-subtle text-2xs mt-0.5">
                    {[v.barcode, v.sku, v.categoryPath, v.brandName, v.productName]
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

  const own: TableColumn<TransferRow>[] = [
    {
      id: 'atFrom',
      header: `At ${fromName}`,
      meta: { align: 'right' },
      cell: ({ row }) => (
        <span className="text-fg-muted tabular-nums">{formatNumber(row.original.atSource)}</span>
      ),
    },
    {
      id: 'atTo',
      header: `At ${toName}`,
      meta: { align: 'right' },
      cell: ({ row }) => (
        <span className="text-fg-muted tabular-nums">
          {formatNumber(row.original.atDestination)}
        </span>
      ),
    },
    {
      id: 'sold',
      header: `Sold at ${demandName}`,
      meta: { align: 'right' },
      cell: ({ row }) => (
        <div className="leading-tight">
          <p className="text-fg tabular-nums">{formatNumber(row.original.demand[3])} in 3 months</p>
          <p className="text-fg-subtle text-2xs tabular-nums">
            {formatNumber(row.original.demand[6])} in 6 months
          </p>
          {row.original.stalled ? (
            <p className="text-warning text-2xs">not selling lately</p>
          ) : null}
        </div>
      ),
    },
    {
      id: 'move',
      header: 'Move',
      enableHiding: false,
      meta: { align: 'right' },
      cell: ({ row }) => (
        <div className="flex justify-end">
          <NumberField
            className="w-24"
            nullable={false}
            min={0}
            aria-label={`Move ${row.original.variation.fullName}`}
            value={row.original.quantity}
            // Never more than the shelf holds: a transfer that cannot be
            // picked is one somebody has to unpick later.
            onChange={(next) =>
              onQuantityChange(
                row.original,
                Math.min(row.original.atSource, Math.max(0, next ?? 0)),
              )
            }
          />
        </div>
      ),
    },
  ]

  const actions: TableColumn<TransferRow>[] = [
    {
      id: 'rowActions',
      header: '',
      enableHiding: false,
      cell: ({ row }) =>
        row.original.index > -1 ? (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Remove ${row.original.variation.fullName} from this transfer`}
              title="Remove from this transfer"
              className="hover:text-danger"
              onClick={() => onRemove(row.original)}
            >
              <Trash2 />
            </Button>
          </div>
        ) : null,
    },
  ]

  return [...lead, ...own, ...rest, ...actions]
}
