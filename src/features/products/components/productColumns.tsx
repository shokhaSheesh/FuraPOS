import { Pencil, Trash2 } from 'lucide-react'
import { Badge } from '@/shared/ui/Badge'
import { RowActions } from '@/shared/components/RowActions'
import { ProductThumb } from '@/shared/components/ProductThumb'
import type { TableColumn } from '@/shared/components/table/features'
import { formatMoney, formatNumber } from '@/shared/lib/format'
import { plainText } from '@/shared/ui/RichTextEditor'
import type { VariationRow } from '../model/product'
import { t } from '@/shared/i18n'

const Empty = () => <span className="text-fg-subtle">—</span>

const text = (value: string | null) => value ?? <Empty />

/** Prices are invoiced in USD as often as in UZS, so they carry their currency. */
const money = (amount: number, currency: VariationRow['costCurrency']) =>
  currency === 'USD' ? `${formatNumber(amount)} USD` : formatMoney(amount)

/**
 * The catalogue's columns — the twenty the business asked for, in its own
 * order, and nothing else. Status and the row actions are not fields: they are
 * how a row is worked with, so they sit at the end.
 *
 * The mapping to OX's Russian headings is in docs/OX-NAVIGATION-MAP.md.
 */
export function buildProductColumns({
  onEdit,
  onDelete,
  canEdit,
  canDelete,
  canSeeCost,
  stockColumnsFor = [],
}: {
  onEdit: (row: VariationRow) => void
  onDelete: (row: VariationRow) => void
  canEdit: boolean
  canDelete: boolean
  canSeeCost: boolean
  /** One quantity column per location, placed right after Quantity. Empty for none. */
  stockColumnsFor?: readonly { id: string; name: string }[]
}): TableColumn<VariationRow>[] {
  const columns: TableColumn<VariationRow>[] = [
    // Рисунок
    {
      id: 'image',
      header: t('Image'),
      enableSorting: false,
      cell: ({ row }) => <ProductThumb src={row.original.imageUrl} size="sm" />,
    },
    // Штрих-код
    {
      accessorKey: 'barcode',
      header: t('Barcode'),
      cell: ({ row }) =>
        row.original.barcode ? (
          <span className="text-2xs font-mono">{row.original.barcode}</span>
        ) : (
          <Empty />
        ),
    },
    // Артикул
    {
      accessorKey: 'sku',
      header: t('SKU'),
      enableHiding: false,
      cell: ({ row }) => <span className="text-2xs font-mono">{row.original.sku}</span>,
    },
    // Продажная цена
    {
      accessorKey: 'salePrice',
      header: t('Sale price'),
      meta: { align: 'right' },
      cell: ({ row }) => money(row.original.salePrice, row.original.saleCurrency),
    },
    // Цена поставщика — only for roles allowed to see what we pay
    ...(canSeeCost
      ? ([
          {
            accessorKey: 'costPrice',
            header: t('Supplier price'),
            meta: { align: 'right' },
            cell: ({ row }) => money(row.original.costPrice, row.original.costCurrency),
          },
        ] as TableColumn<VariationRow>[])
      : []),
    // Поставщик
    {
      accessorKey: 'brandName',
      header: t('Supplier'),
      cell: ({ row }) => text(row.original.brandName),
    },
    // Название продукта
    {
      accessorKey: 'productName',
      header: t('Product name'),
      enableHiding: false,
      cell: ({ row }) => <span className="font-medium">{row.original.productName}</span>,
    },
    // Название вариации продукта
    {
      accessorKey: 'name',
      header: t('Variation name'),
      cell: ({ row }) => text(row.original.name),
    },
    // Часть
    {
      accessorKey: 'partSide',
      header: t('Part'),
      cell: ({ row }) => text(row.original.partSide),
    },
    // OEM
    {
      accessorKey: 'oem',
      header: t('OEM'),
      cell: ({ row }) =>
        row.original.oem ? (
          <span className="text-2xs font-mono">{row.original.oem}</span>
        ) : (
          <Empty />
        ),
    },
    // Описание — written as formatted text, listed as words
    {
      accessorKey: 'description',
      header: t('Description'),
      cell: ({ row }) => {
        const words = plainText(row.original.description)
        return words ? <span title={words}>{words}</span> : <Empty />
      },
    },
    // Фактическое кол-во
    {
      accessorKey: 'stock',
      header: t('Quantity'),
      meta: { align: 'right' },
      cell: ({ row }) => {
        const { stock, lowStockThreshold, unit } = row.original
        // Low stock is "needs attention" (warning), out of stock is a problem
        // (danger). Neither is blue — blue is the brand.
        const low = lowStockThreshold !== null && stock <= lowStockThreshold
        const out = stock === 0
        return (
          <span
            className={
              out ? 'text-danger font-medium' : low ? 'text-warning font-medium' : undefined
            }
          >
            {formatNumber(stock)} {unit}
          </span>
        )
      },
    },
    ...stockColumnsFor.map((location): TableColumn<VariationRow> => ({
      id: `stockAt:${location.id}`,
      header: `Qty · ${location.name}`,
      enableSorting: false,
      meta: { align: 'right' },
      cell: ({ row }) => {
        const at = row.original.stockByLocation.find((s) => s.locationId === location.id)
        if (!at) return <Empty />
        return (
          <span className={at.quantity === 0 ? 'text-danger font-medium' : undefined}>
            {formatNumber(at.quantity)}
          </span>
        )
      },
    })),
    // Локация — where this stock is
    {
      id: 'location',
      header: t('Location'),
      enableSorting: false,
      cell: ({ row }) => {
        const at = row.original.stockByLocation.filter((entry) => entry.quantity > 0)
        if (!at.length) return <Empty />
        // Every place by name. A narrow column clips the list with an ellipsis
        // rather than counting the rest, and the full split is on hover.
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
    // Адрес товара — the exact bin, as a picker reads it: "1-A-23-4"
    {
      accessorKey: 'shelfAddress',
      header: t('Storage address'),
      cell: ({ row }) =>
        row.original.shelfAddress ? (
          <span className="text-2xs font-mono">{row.original.shelfAddress}</span>
        ) : (
          <Empty />
        ),
    },
    // Категория
    {
      accessorKey: 'categoryPath',
      header: t('Category'),
      cell: ({ row }) => row.original.categoryPath,
    },
    // Вес карго
    {
      accessorKey: 'cargoWeightKg',
      header: t('Cargo weight'),
      meta: { align: 'right' },
      cell: ({ row }) =>
        row.original.cargoWeightKg ? `${formatNumber(row.original.cargoWeightKg)} kg` : <Empty />,
    },
    // Размер карго
    {
      accessorKey: 'cargoSize',
      header: t('Cargo size'),
      cell: ({ row }) => text(row.original.cargoSize),
    },
    // Марка
    {
      accessorKey: 'vehicleMakes',
      header: t('Make'),
      cell: ({ row }) =>
        row.original.vehicleMakes.length ? row.original.vehicleMakes.join(', ') : <Empty />,
    },
    // Модель
    {
      id: 'vehicleModels',
      header: t('Model'),
      cell: ({ row }) =>
        row.original.vehicleModels.length ? row.original.vehicleModels.join(', ') : <Empty />,
    },
    // Категория конечное
    {
      accessorKey: 'categoryName',
      header: t('End category'),
      cell: ({ row }) => row.original.categoryName,
    },
    // Бренд товара
    {
      accessorKey: 'manufacturer',
      header: t('Product brand'),
      cell: ({ row }) => text(row.original.manufacturer),
    },
    // Not fields: how a row is worked with.
    {
      accessorKey: 'status',
      header: t('Status'),
      cell: ({ row }) =>
        row.original.status === 'active' ? (
          <Badge tone="success">{t('Active')}</Badge>
        ) : row.original.status === 'draft' ? (
          <Badge tone="warning">{t('Draft')}</Badge>
        ) : (
          <Badge>{t('Archived')}</Badge>
        ),
    },
    {
      id: 'actions',
      header: '',
      enableHiding: false,
      meta: { align: 'right' },
      cell: ({ row }) => (
        <RowActions
          actions={[
            {
              label: t('Edit'),
              icon: Pencil,
              onSelect: () => onEdit(row.original),
              hidden: !canEdit,
            },
            {
              label: t('Delete'),
              icon: Trash2,
              destructive: true,
              onSelect: () => onDelete(row.original),
              hidden: !canDelete,
            },
          ]}
        />
      ),
    },
  ]

  // Most useful first — see PRODUCT_COLUMN_ORDER.
  return [...columns].sort((a, b) => rank(a) - rank(b))
}

const rank = (column: TableColumn<VariationRow>) => {
  const id = (column.id ?? (column as { accessorKey?: string }).accessorKey ?? '') as string
  const index = PRODUCT_COLUMN_ORDER.indexOf(id)
  return index === -1 ? PRODUCT_COLUMN_ORDER.length : index
}

/**
 * The order the list opens in, most useful first: what the row *is*, then
 * where it is and how many, then money, then the details that only matter
 * once you are looking at one part. Each user can rearrange it from the
 * Columns menu, and their order is remembered.
 */
export const PRODUCT_COLUMN_ORDER = [
  // What the row is
  'image',
  'productName',
  'name',
  'sku',
  'barcode',
  // Where it is and how many
  'stock',
  'location',
  // Where on the shelf, right after which shelf: the two answer one question.
  'shelfAddress',
  // What it is worth
  'salePrice',
  'costPrice',
  'brandName',
  // How it is classified
  'categoryPath',
  'partSide',
  'oem',
  'vehicleMakes',
  'vehicleModels',
  'manufacturer',
  'categoryName',
  // The rest
  'cargoWeightKg',
  'cargoSize',
  'description',
  'status',
  'actions',
]

/**
 * Hidden on first open. The list is now short enough to show nearly all of it;
 * only the second name columns and the cargo pair start off.
 */
export const PRODUCT_COLUMNS_HIDDEN_BY_DEFAULT = [
  'name',
  'cargoWeightKg',
  'cargoSize',
  'categoryName',
  'description',
]
