import { Info, Trash2 } from 'lucide-react'
import { NumberField } from '@/shared/components/NumberField'
import { ProductThumb } from '@/shared/components/ProductThumb'
import type { TableColumn } from '@/shared/components/table/features'
import { Button } from '@/shared/ui/Button'
import { Select } from '@/shared/ui/Select'
import { formatMoney, formatNumber } from '@/shared/lib/format'
import {
  buildProductFieldColumns,
  PRODUCT_FIELD_COLUMN_IDS,
} from '@/features/products/components/productFieldColumns'
import type { VariationRow } from '@/features/products/model/product'
import { toUzs, type Currency, type OrderLine } from '../model/order'

const CURRENCIES = [
  { value: 'USD', label: 'USD' },
  { value: 'UZS', label: 'UZS' },
]

/**
 * A row on the order's product step.
 *
 * Like a receipt's, it is not always a line of the order: while the order is a
 * draft the whole catalogue is on screen waiting for quantities, and typing
 * one is what puts a row on the document.
 */
export interface OrderRow {
  key: string
  line: OrderLine | null
  /** Where the line sits on the order, or -1 when it is not on it yet. */
  index: number
  variation: VariationRow | undefined
  name: string
  quantity: number
  unitCost: number
  costCurrency: Currency
  /** They list it and we have never stocked it — there is nothing to order against. */
  newToUs: boolean
  stockHere: { locationName: string; quantity: number }[]
}

const variationOf = (row: OrderRow) => row.variation

/** What a row *is*. The order's own columns go straight after these. */
const IDENTITY_COLUMNS = PRODUCT_FIELD_COLUMN_IDS.slice(
  0,
  PRODUCT_FIELD_COLUMN_IDS.indexOf('stock'),
)

/**
 * The catalogue's Quantity column, with the per-location split on the number.
 *
 * On an order this is the figure the decision is made from — "we have 8, how
 * many do we want" — and "8 where" is the immediate next question.
 */
function StockCell({ row }: { row: OrderRow }) {
  const total = row.stockHere.reduce((sum, s) => sum + s.quantity, 0)
  return (
    <span
      className="inline-flex items-center gap-1 tabular-nums"
      title={
        row.stockHere.length
          ? row.stockHere.map((s) => `${s.locationName}: ${formatNumber(s.quantity)}`).join('\n')
          : 'Nothing on any shelf yet'
      }
    >
      {formatNumber(total)}
      <Info className="text-info size-3.5" aria-hidden />
    </span>
  )
}

function adapt(fields: TableColumn<OrderRow>[]) {
  return fields.map((column) => {
    if (column.id === 'stock') {
      return {
        ...column,
        cell: ({ row }: { row: { original: OrderRow } }) => <StockCell row={row.original} />,
      }
    }
    // A supplier lists things we have never carried. Nothing was removed —
    // it was never ours — so their name for it is all there is to show.
    if (column.id === 'productName') {
      return {
        ...column,
        cell: ({ row }: { row: { original: OrderRow } }) =>
          row.original.variation ? (
            <span className="font-medium">{row.original.variation.productName}</span>
          ) : (
            <span className="text-fg-muted" title="Their listing — we have never stocked this">
              {row.original.name}
            </span>
          ),
      }
    }
    return column
  })
}

/**
 * The order's lines over the product list's own fields.
 *
 * The three the document owns sit straight after the row's identity: how many
 * are wanted, what price was agreed, and what the line comes to. The agreed
 * price is editable and starts from the catalogue's, because an order is where
 * a price is *agreed* — it is the number a delivery gets checked against, and
 * taking it from a price list without letting anyone change it would make the
 * check meaningless.
 */
export function buildOrderLineColumns({
  editable,
  canSeeCost,
  cards,
  usdRate,
  onQuantityChange,
  onCostChange,
  onCurrencyChange,
  onRemove,
}: {
  editable: boolean
  canSeeCost: boolean
  /** Collapses the identity columns into one rich cell. */
  cards: boolean
  usdRate: number
  onQuantityChange: (row: OrderRow, quantity: number) => void
  onCostChange: (row: OrderRow, unitCost: number) => void
  onCurrencyChange: (row: OrderRow, currency: Currency) => void
  onRemove: (row: OrderRow) => void
}): TableColumn<OrderRow>[] {
  const fields = adapt(buildProductFieldColumns<OrderRow>({ variationOf, canSeeCost }))
  const is = (column: TableColumn<OrderRow>) => IDENTITY_COLUMNS.includes(column.id ?? '')
  const identity = fields.filter(is)
  const rest = fields.filter((column) => !is(column))

  const lead: TableColumn<OrderRow>[] = cards
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

  const own: TableColumn<OrderRow>[] = [
    {
      id: 'quantity',
      // Not just "Quantity": the catalogue's own stock column sits on this
      // table too, and two columns under that heading mean neither is read.
      header: 'Ordering',
      enableHiding: false,
      meta: { align: 'right' },
      cell: ({ row }) => {
        if (row.original.newToUs) {
          return (
            <span
              className="text-fg-subtle text-2xs"
              title="They list it, we have never stocked it — add it to the catalogue before ordering any"
            >
              new to us
            </span>
          )
        }
        return editable ? (
          <div className="flex justify-end">
            <NumberField
              className="w-24"
              nullable={false}
              min={0}
              aria-label={`Ordering ${row.original.name}`}
              value={row.original.quantity}
              onChange={(next) => onQuantityChange(row.original, next ?? 0)}
            />
          </div>
        ) : (
          formatNumber(row.original.quantity)
        )
      },
    },
    ...(canSeeCost
      ? ([
          {
            id: 'agreedPrice',
            header: 'Agreed price',
            enableHiding: false,
            meta: { align: 'right' as const },
            cell: ({ row }) =>
              // Only once the line is on the order. Before that it is their
              // asking price, which is theirs to set.
              editable && row.original.line ? (
                <div className="flex items-center justify-end gap-1.5">
                  <NumberField
                    className="w-28"
                    nullable={false}
                    min={0}
                    step="any"
                    aria-label={`Agreed price of ${row.original.name}`}
                    value={row.original.unitCost}
                    onChange={(next) => onCostChange(row.original, next ?? 0)}
                  />
                  <Select
                    className="w-20"
                    aria-label={`Agreed currency of ${row.original.name}`}
                    value={row.original.costCurrency}
                    onChange={(next) => onCurrencyChange(row.original, next as Currency)}
                    options={CURRENCIES}
                  />
                </div>
              ) : (
                <span className="tabular-nums">
                  {row.original.costCurrency === 'USD'
                    ? `${row.original.unitCost.toFixed(2)} USD`
                    : formatMoney(row.original.unitCost)}
                </span>
              ),
          },
          {
            id: 'lineTotal',
            header: 'Line total',
            meta: { align: 'right' as const },
            cell: ({ row }) =>
              row.original.line ? (
                <span className="text-fg font-medium tabular-nums">
                  {formatMoney(
                    Math.round(
                      row.original.quantity *
                        toUzs(row.original.unitCost, row.original.costCurrency, usdRate),
                    ),
                  )}
                </span>
              ) : (
                <span className="text-fg-subtle">—</span>
              ),
          },
        ] as TableColumn<OrderRow>[])
      : []),
  ]

  const actions: TableColumn<OrderRow>[] = editable
    ? [
        {
          id: 'rowActions',
          header: '',
          enableHiding: false,
          cell: ({ row }) =>
            row.original.line ? (
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${row.original.name} from this order`}
                  title="Remove from this order"
                  className="hover:text-danger"
                  onClick={() => onRemove(row.original)}
                >
                  <Trash2 />
                </Button>
              </div>
            ) : null,
        },
      ]
    : []

  return [...lead, ...own, ...rest, ...actions]
}
