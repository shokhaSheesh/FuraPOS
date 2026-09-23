import { ProductThumb } from '@/shared/components/ProductThumb'
import type { RowData } from '@tanstack/react-table'
import type { TableColumn } from '@/shared/components/table/features'
import { formatMoney, formatNumber } from '@/shared/lib/format'
import { plainText } from '@/shared/ui/RichTextEditor'
import type { VariationRow } from '../model/product'
import { PRODUCT_COLUMN_ORDER } from './productColumns'
import { t } from '@/shared/i18n'

const Empty = () => <span className="text-fg-subtle">—</span>

const text = (value: string | null | undefined) => value ?? <Empty />

const money = (amount: number, currency: VariationRow['costCurrency']) =>
  currency === 'USD' ? `${formatNumber(amount)} USD` : formatMoney(amount)

/**
 * The catalogue's own columns, for any table whose rows *point at* a product
 * rather than being one.
 *
 * **The rule this exists to keep:** wherever products are put on a document —
 * a transfer, a purchase order, a goods receipt — the table shows the same
 * fields as the product list. Somebody picking parts off a lorry is reading
 * the same catalogue as somebody managing it, and having half the fields in
 * one place and half in the other is how the wrong variation gets received.
 *
 * `buildProductColumns` stays the product list's own builder because its
 * columns carry `accessorKey`s the list sorts and filters on. The two sets are
 * held in step by a test that compares their column ids, so a field added to
 * the catalogue cannot quietly go missing from the documents.
 */
export function buildProductFieldColumns<T extends RowData>({
  variationOf,
  canSeeCost,
}: {
  variationOf: (row: T) => VariationRow | undefined
  /** Supplier price is hidden from roles that may not see what we pay. */
  canSeeCost: boolean
}): TableColumn<T>[] {
  const columns: TableColumn<T>[] = [
    {
      id: 'image',
      header: t('Image'),
      enableSorting: false,
      cell: ({ row }) => (
        <ProductThumb src={variationOf(row.original)?.imageUrl ?? null} size="sm" />
      ),
    },
    {
      id: 'productName',
      header: t('Product name'),
      enableHiding: false,
      cell: ({ row }) => (
        <span className="font-medium">
          {variationOf(row.original)?.productName ?? t('Removed product')}
        </span>
      ),
    },
    {
      id: 'name',
      header: t('Variation name'),
      cell: ({ row }) => text(variationOf(row.original)?.name),
    },
    {
      id: 'sku',
      header: t('SKU'),
      cell: ({ row }) => (
        <span className="text-2xs font-mono">{variationOf(row.original)?.sku ?? '—'}</span>
      ),
    },
    {
      id: 'barcode',
      header: t('Barcode'),
      cell: ({ row }) => {
        const code = variationOf(row.original)?.barcode
        return code ? <span className="text-2xs font-mono">{code}</span> : <Empty />
      },
    },
    {
      id: 'stock',
      header: t('Quantity'),
      meta: { align: 'right' },
      cell: ({ row }) => {
        const v = variationOf(row.original)
        if (!v) return <Empty />
        const low = v.lowStockThreshold !== null && v.stock <= v.lowStockThreshold
        return (
          <span
            className={
              v.stock === 0
                ? 'text-danger font-medium'
                : low
                  ? 'text-warning font-medium'
                  : undefined
            }
          >
            {formatNumber(v.stock)} {v.unit}
          </span>
        )
      },
    },
    {
      id: 'location',
      header: t('Location'),
      enableSorting: false,
      cell: ({ row }) => {
        const at = (variationOf(row.original)?.stockByLocation ?? []).filter((e) => e.quantity > 0)
        if (!at.length) return <Empty />
        return (
          <span
            className="block truncate"
            title={at.map((e) => `${e.locationName}: ${formatNumber(e.quantity)}`).join('\n')}
          >
            {at.map((entry) => entry.locationName).join(', ')}
          </span>
        )
      },
    },
    {
      id: 'shelfAddress',
      header: t('Storage address'),
      cell: ({ row }) => {
        const address = variationOf(row.original)?.shelfAddress
        return address ? <span className="text-2xs font-mono">{address}</span> : <Empty />
      },
    },
    {
      id: 'salePrice',
      header: t('Sale price'),
      meta: { align: 'right' },
      cell: ({ row }) => {
        const v = variationOf(row.original)
        return v ? money(v.salePrice, v.saleCurrency) : <Empty />
      },
    },
    ...(canSeeCost
      ? [
          {
            id: 'costPrice',
            header: t('Supplier price'),
            meta: { align: 'right' as const },
            cell: ({ row }: { row: { original: T } }) => {
              const v = variationOf(row.original)
              return v ? money(v.costPrice, v.costCurrency) : <Empty />
            },
          },
        ]
      : []),
    {
      id: 'brandName',
      header: t('Manufacturer brand'),
      cell: ({ row }) => text(variationOf(row.original)?.brandName),
    },
    {
      id: 'categoryPath',
      header: t('Category'),
      cell: ({ row }) => text(variationOf(row.original)?.categoryPath),
    },
    {
      id: 'partSide',
      header: t('Part'),
      cell: ({ row }) => text(variationOf(row.original)?.partSide),
    },
    {
      id: 'oem',
      header: t('OEM'),
      cell: ({ row }) => {
        const oem = variationOf(row.original)?.oem
        return oem ? <span className="text-2xs font-mono">{oem}</span> : <Empty />
      },
    },
    {
      id: 'vehicleMakes',
      header: t('Make'),
      cell: ({ row }) => {
        const makes = variationOf(row.original)?.vehicleMakes ?? []
        return makes.length ? makes.join(', ') : <Empty />
      },
    },
    {
      id: 'vehicleModels',
      header: t('Model'),
      cell: ({ row }) => {
        const models = variationOf(row.original)?.vehicleModels ?? []
        return models.length ? models.join(', ') : <Empty />
      },
    },
    {
      id: 'manufacturer',
      header: t('Product brand'),
      cell: ({ row }) => text(variationOf(row.original)?.manufacturer),
    },
    {
      id: 'categoryName',
      header: t('End category'),
      cell: ({ row }) => text(variationOf(row.original)?.categoryName),
    },
    {
      id: 'cargoWeightKg',
      header: t('Cargo weight'),
      meta: { align: 'right' },
      cell: ({ row }) => {
        const kg = variationOf(row.original)?.cargoWeightKg
        return kg ? `${formatNumber(kg)} kg` : <Empty />
      },
    },
    {
      id: 'cargoSize',
      header: t('Cargo size'),
      cell: ({ row }) => text(variationOf(row.original)?.cargoSize),
    },
    {
      id: 'description',
      header: t('Description'),
      cell: ({ row }) => {
        const words = plainText(variationOf(row.original)?.description ?? '')
        return words ? <span title={words}>{words}</span> : <Empty />
      },
    },
  ]

  const rank = (column: TableColumn<T>) => {
    const index = PRODUCT_COLUMN_ORDER.indexOf(column.id ?? '')
    return index === -1 ? PRODUCT_COLUMN_ORDER.length : index
  }
  return [...columns].sort((a, b) => rank(a) - rank(b))
}

/**
 * The fields a document's product table shows, in the product list's order.
 *
 * Exported so a document can place its own editable columns relative to them
 * — a receipt's counted quantity belongs next to the identity of the row, not
 * after nineteen catalogue fields.
 */
export const PRODUCT_FIELD_COLUMN_IDS = PRODUCT_COLUMN_ORDER.filter(
  // 'labels' is the list's label-printing control, not a field of a product.
  (id) => id !== 'status' && id !== 'actions' && id !== 'labels',
)
