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
import type { Currency, ReceiptLine } from '../model/receipt'

const CURRENCIES = [
  { value: 'USD', label: 'USD' },
  { value: 'UZS', label: 'UZS' },
]

/**
 * A row on the product step.
 *
 * It is **not** always a line of the receipt. When the delivery is from a
 * supplier we hold a catalogue for, every one of their products is a row from
 * the moment the receipt is created, waiting for a quantity — typing one is
 * what puts it on the receipt, and clearing it is what takes it off. That is
 * how a delivery is actually checked in: their invoice is in one hand and
 * their catalogue is on the screen, in their order, not ours.
 */
export interface LineRow {
  /** Stable across renders, so a quantity being typed keeps focus. */
  key: string
  /** The receipt's line, or null while this is only an offer of theirs. */
  line: ReceiptLine | null
  /** Where the line sits on the receipt, or -1 when it is not on it yet. */
  index: number
  /** The catalogue row this points at, for the product columns. */
  variation: VariationRow | undefined
  name: string
  /** What is being received. Zero means the row is not on the receipt. */
  quantity: number
  /** What was expected, from the order behind the delivery. */
  expected: number
  unitCost: number
  costCurrency: Currency
  /** Their code for it, which is what their invoice says — not our SKU. */
  supplierSku: string | null
  /**
   * They list it and we have never stocked it. It cannot be received: there is
   * no product to add the stock to, and inventing one from a delivery note is
   * how a catalogue fills up with duplicates.
   */
  newToUs: boolean
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
  return fields.map((column) => {
    if (column.id === 'stock') {
      return {
        ...column,
        cell: ({ row }: { row: { original: LineRow } }) => <StockCell row={row.original} />,
      }
    }
    /*
      A supplier lists things we have never carried, and those rows have no
      variation behind them. The catalogue's own fallback reads "Removed
      product", which is the opposite of true here — nothing was removed, it
      was never ours. Their name for it is all there is, so that is what shows.
    */
    if (column.id === 'productName') {
      return {
        ...column,
        cell: ({ row }: { row: { original: LineRow } }) =>
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
  onCostChange,
  onCurrencyChange,
  onRemove,
}: {
  editable: boolean
  canSeeCost: boolean
  /** Collapses the identity columns into one rich cell, as OX's grid view does. */
  cards: boolean
  onQuantityChange: (row: LineRow, quantity: number) => void
  onCostChange: (row: LineRow, unitCost: number) => void
  onCurrencyChange: (row: LineRow, currency: Currency) => void
  onRemove: (row: LineRow) => void
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
      cell: ({ row }) => {
        if (row.original.newToUs) {
          return (
            <span
              className="text-fg-subtle text-2xs"
              title="They list it, we have never stocked it — add it to the catalogue before receiving any"
            >
              new to us
            </span>
          )
        }
        return editable ? (
          <div className="flex justify-end">
            <NumberField
              className="w-20"
              nullable={false}
              min={0}
              aria-label={`Actual quantity of ${row.original.name}`}
              value={row.original.quantity}
              onChange={(v) => onQuantityChange(row.original, v ?? 0)}
            />
          </div>
        ) : (
          formatNumber(row.original.quantity)
        )
      },
    },
    /*
      What the supplier charged for *this* delivery — not the catalogue's last
      known cost, which is only what it is pre-filled from. It is the one
      figure a receipt exists to capture: everything downstream, the landed
      cost and the debt and the margin on every screen after it, is built on
      this number, and the number it starts as is the one most likely to be
      stale.
    */
    ...(canSeeCost
      ? ([
          {
            id: 'lineCost',
            header: 'Invoiced price',
            enableHiding: false,
            meta: { align: 'right' as const },
            cell: ({ row }) =>
              // Only once the row is actually on the receipt. Before that the
              // figure is the supplier's asking price, which is theirs to set
              // and ours to disagree with only by receiving some.
              editable && row.original.line ? (
                <div className="flex items-center justify-end gap-1.5">
                  <NumberField
                    className="w-28"
                    nullable={false}
                    min={0}
                    step="any"
                    aria-label={`Invoiced price of ${row.original.name}`}
                    value={row.original.unitCost}
                    onChange={(v) => onCostChange(row.original, v ?? 0)}
                  />
                  <Select
                    className="w-20"
                    aria-label={`Invoiced currency of ${row.original.name}`}
                    value={row.original.costCurrency}
                    onChange={(v) => onCurrencyChange(row.original, v as Currency)}
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
          cell: ({ row }) =>
            // A catalogue row that is not on the receipt has nothing to remove;
            // its quantity is already zero.
            row.original.line ? (
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${row.original.name} from this receipt`}
                  title="Remove from this receipt"
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
  const { identity, rest } = split(
    withStockBreakdown(buildProductFieldColumns<LineRow>({ variationOf, canSeeCost })),
  )

  const own: TableColumn<LineRow>[] = [
    {
      id: 'count',
      header: 'Actual quantity',
      meta: { align: 'right' },
      cell: ({ row }) => formatNumber(row.original.quantity),
    },
    {
      id: 'expected',
      header: 'Expected quantity',
      meta: { align: 'right' },
      cell: ({ row }) => formatNumber(row.original.expected),
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
