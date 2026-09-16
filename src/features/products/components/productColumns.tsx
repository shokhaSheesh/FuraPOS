import { Pencil, Trash2 } from 'lucide-react'
import { Badge } from '@/shared/ui/Badge'
import { RowActions } from '@/shared/components/RowActions'
import { ProductThumb } from '@/shared/components/ProductThumb'
import type { TableColumn } from '@/shared/components/table/features'
import { formatMoney, formatNumber } from '@/shared/lib/format'
import { plainText } from '@/shared/ui/RichTextEditor'
import type { VariationRow } from '../model/product'

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
  return [
    // Рисунок
    {
      id: 'image',
      header: 'Image',
      enableSorting: false,
      cell: ({ row }) => <ProductThumb src={row.original.imageUrl} size="sm" />,
    },
    // Штрих-код
    {
      accessorKey: 'barcode',
      header: 'Barcode',
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
      header: 'SKU',
      enableHiding: false,
      cell: ({ row }) => <span className="text-2xs font-mono">{row.original.sku}</span>,
    },
    // Продажная цена
    {
      accessorKey: 'salePrice',
      header: 'Sale price',
      meta: { align: 'right' },
      cell: ({ row }) => money(row.original.salePrice, row.original.saleCurrency),
    },
    // Цена поставщика — only for roles allowed to see what we pay
    ...(canSeeCost
      ? ([
          {
            accessorKey: 'costPrice',
            header: 'Supplier price',
            meta: { align: 'right' },
            cell: ({ row }) => money(row.original.costPrice, row.original.costCurrency),
          },
        ] as TableColumn<VariationRow>[])
      : []),
    // Поставщик
    {
      accessorKey: 'brandName',
      header: 'Supplier',
      cell: ({ row }) => text(row.original.brandName),
    },
    // Название продукта
    {
      accessorKey: 'productName',
      header: 'Product name',
      enableHiding: false,
      cell: ({ row }) => <span className="font-medium">{row.original.productName}</span>,
    },
    // Название вариации продукта
    {
      accessorKey: 'name',
      header: 'Variation name',
      cell: ({ row }) => text(row.original.name),
    },
    // Часть
    {
      accessorKey: 'partSide',
      header: 'Part',
      cell: ({ row }) => text(row.original.partSide),
    },
    // OEM
    {
      accessorKey: 'oem',
      header: 'OEM',
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
      header: 'Description',
      cell: ({ row }) => {
        const words = plainText(row.original.description)
        return words ? <span title={words}>{words}</span> : <Empty />
      },
    },
    // Фактическое кол-во
    {
      accessorKey: 'stock',
      header: 'Quantity',
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
    // Категория
    {
      accessorKey: 'categoryPath',
      header: 'Category',
      cell: ({ row }) => row.original.categoryPath,
    },
    // Вес карго
    {
      accessorKey: 'cargoWeightKg',
      header: 'Cargo weight',
      meta: { align: 'right' },
      cell: ({ row }) =>
        row.original.cargoWeightKg ? `${formatNumber(row.original.cargoWeightKg)} kg` : <Empty />,
    },
    // Размер карго
    {
      accessorKey: 'cargoSize',
      header: 'Cargo size',
      cell: ({ row }) => text(row.original.cargoSize),
    },
    // Марка
    {
      accessorKey: 'vehicleMake',
      header: 'Make',
      cell: ({ row }) => text(row.original.vehicleMake),
    },
    // Модель
    {
      id: 'vehicleModels',
      header: 'Model',
      cell: ({ row }) =>
        row.original.vehicleModels.length ? row.original.vehicleModels.join(', ') : <Empty />,
    },
    // Категория конечное
    {
      accessorKey: 'categoryName',
      header: 'End category',
      cell: ({ row }) => row.original.categoryName,
    },
    // Бренд товара
    {
      accessorKey: 'manufacturer',
      header: 'Product brand',
      cell: ({ row }) => text(row.original.manufacturer),
    },
    // Not fields: how a row is worked with.
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) =>
        row.original.status === 'active' ? (
          <Badge tone="success">Active</Badge>
        ) : row.original.status === 'draft' ? (
          <Badge tone="warning">Draft</Badge>
        ) : (
          <Badge>Archived</Badge>
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
            { label: 'Edit', icon: Pencil, onSelect: () => onEdit(row.original), hidden: !canEdit },
            {
              label: 'Delete',
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
}

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
