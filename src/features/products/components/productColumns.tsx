import { Pencil, Trash2 } from 'lucide-react'
import { Badge } from '@/shared/ui/Badge'
import { RowActions } from '@/shared/components/RowActions'
import { Switch } from '@/shared/ui/Switch'
import { useDataStore } from '@/data/store'
import { ProductThumb } from '@/shared/components/ProductThumb'
import type { TableColumn } from '@/shared/components/table/features'
import { formatMoney, formatNumber, formatPercent } from '@/shared/lib/format'
import {
  costInUzs,
  discountAmount,
  effectivePrice,
  marginRatio,
  PART_SIDES,
  type VariationRow,
} from '../model/product'

const Empty = () => <span className="text-fg-subtle">—</span>

/** Cost may be quoted in USD, so it is always shown with its currency. */
const cost = (v: VariationRow) =>
  v.costCurrency === 'USD' ? `${formatNumber(v.costPrice)} USD` : formatMoney(v.costPrice)

/**
 * Column order follows DESIGN_RULES § 5.2:
 * identifier → name → categorisation → quantities → money → status → actions.
 */
export function buildProductColumns({
  usdRate,
  onEdit,
  onDelete,
  canEdit,
  canDelete,
  canSeeCost,
}: {
  usdRate: number
  onEdit: (row: VariationRow) => void
  onDelete: (row: VariationRow) => void
  canEdit: boolean
  canDelete: boolean
  canSeeCost: boolean
}): TableColumn<VariationRow>[] {
  return [
    {
      accessorKey: 'sku',
      header: 'SKU',
      cell: ({ row }) => <span className="text-2xs font-mono">{row.original.sku}</span>,
      enableHiding: false,
    },
    {
      accessorKey: 'fullName',
      header: 'Name',
      cell: ({ row }) => (
        <div className="flex items-center gap-2.5">
          <ProductThumb src={row.original.imageUrl} size="sm" />
          <div className="min-w-0">
            <span className="font-medium">{row.original.productName}</span>
            {row.original.name !== 'Standard' ? (
              <span className="text-fg-muted"> · {row.original.name}</span>
            ) : null}
          </div>
        </div>
      ),
      enableHiding: false,
    },
    {
      accessorKey: 'id',
      header: 'Variation ID',
      cell: ({ row }) => (
        <span className="text-fg-muted text-2xs font-mono">{row.original.id}</span>
      ),
    },
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
    {
      accessorKey: 'description',
      header: 'OEM / description',
      cell: ({ row }) => row.original.description ?? <Empty />,
    },
    {
      accessorKey: 'brandName',
      header: 'Brand',
      cell: ({ row }) => row.original.brandName ?? <Empty />,
    },
    {
      accessorKey: 'manufacturer',
      header: 'Manufacturer',
      cell: ({ row }) => row.original.manufacturer ?? <Empty />,
    },
    {
      accessorKey: 'categoryPath',
      header: 'Category',
      cell: ({ row }) => <span title={row.original.categoryPath}>{row.original.categoryName}</span>,
    },
    {
      accessorKey: 'vehicleMake',
      header: 'Make',
      cell: ({ row }) => row.original.vehicleMake ?? <Empty />,
    },
    {
      id: 'vehicleModels',
      header: 'Model',
      cell: ({ row }) =>
        row.original.vehicleModels.length ? row.original.vehicleModels.join(', ') : <Empty />,
    },
    {
      accessorKey: 'partSide',
      header: 'Side',
      cell: ({ row }) =>
        PART_SIDES.find((s) => s.value === row.original.partSide)?.label ?? <Empty />,
    },
    {
      accessorKey: 'tags',
      header: 'Tags',
      cell: ({ row }) =>
        row.original.tags.length ? (
          <div className="flex gap-1">
            {row.original.tags.map((tag) => (
              <Badge key={tag}>{tag}</Badge>
            ))}
          </div>
        ) : (
          <Empty />
        ),
    },
    {
      accessorKey: 'shelfAddress',
      header: 'Shelf',
      cell: ({ row }) => row.original.shelfAddress ?? <Empty />,
    },
    {
      accessorKey: 'stock',
      header: 'Stock',
      meta: { align: 'right' },
      cell: ({ row }) => {
        const { stock, lowStockThreshold, unit } = row.original
        // Low stock is "needs attention" (warning), out of stock is a problem
        // (danger). Neither is yellow — yellow is the brand.
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
    {
      id: 'location',
      header: 'Location',
      cell: ({ row }) => {
        const at = row.original.stockByLocation
        if (!at.length) return <Empty />
        // One location reads as itself; several read as a count, with the
        // breakdown on hover rather than a cell nobody can fit.
        return at.length === 1 ? (
          at[0]!.locationName
        ) : (
          <span title={at.map((s) => `${s.locationName}: ${s.quantity}`).join('\n')}>
            {at.length} locations
          </span>
        )
      },
    },
    {
      accessorKey: 'moq',
      header: 'MOQ',
      meta: { align: 'right' },
      cell: ({ row }) => (row.original.moq ? formatNumber(row.original.moq) : <Empty />),
    },
    ...(canSeeCost
      ? ([
          {
            accessorKey: 'costPrice',
            header: 'Cost',
            meta: { align: 'right' },
            cell: ({ row }) => cost(row.original),
          },
          {
            id: 'costValue',
            header: 'Stock at cost',
            meta: { align: 'right' },
            cell: ({ row }) => {
              return formatMoney(costInUzs(row.original, usdRate) * row.original.stock)
            },
          },
        ] as TableColumn<VariationRow>[])
      : []),
    {
      accessorKey: 'salePrice',
      header: 'Price',
      meta: { align: 'right' },
      cell: ({ row }) => formatMoney(row.original.salePrice),
    },
    {
      accessorKey: 'discountPrice',
      header: 'Discounted',
      meta: { align: 'right' },
      cell: ({ row }) =>
        row.original.discountPrice ? (
          <span className="text-warning">{formatMoney(row.original.discountPrice)}</span>
        ) : (
          <Empty />
        ),
    },
    {
      accessorKey: 'discount',
      header: 'Discount',
      meta: { align: 'right' },
      cell: ({ row }) => {
        const off = discountAmount(row.original)
        return off > 0 ? <span className="text-warning">− {formatMoney(off)}</span> : <Empty />
      },
    },
    {
      id: 'saleValue',
      header: 'Stock at sale',
      meta: { align: 'right' },
      cell: ({ row }) => formatMoney(effectivePrice(row.original) * row.original.stock),
    },
    ...(canSeeCost
      ? ([
          {
            id: 'margin',
            header: 'Margin',
            meta: { align: 'right' },
            cell: ({ row }) => (
              <span className="text-fg-muted">
                {formatPercent(marginRatio(row.original, usdRate))}
              </span>
            ),
          },
        ] as TableColumn<VariationRow>[])
      : []),
    {
      accessorKey: 'cargoWeightKg',
      header: 'Weight',
      meta: { align: 'right' },
      cell: ({ row }) =>
        row.original.cargoWeightKg ? `${formatNumber(row.original.cargoWeightKg)} kg` : <Empty />,
    },
    {
      accessorKey: 'cargoSize',
      header: 'Size',
      cell: ({ row }) => row.original.cargoSize ?? <Empty />,
    },
    {
      accessorKey: 'isShippable',
      header: 'Shippable',
      cell: ({ row }) => <FlagToggle row={row.original} flag="isShippable" label="Shippable" />,
    },
    {
      accessorKey: 'showOnline',
      header: 'Online',
      cell: ({ row }) => <FlagToggle row={row.original} flag="showOnline" label="Show online" />,
    },
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

/** Dense by design: the least-used columns are off until someone asks. */
export const PRODUCT_COLUMNS_HIDDEN_BY_DEFAULT = [
  'id',
  'manufacturer',
  'discount',
  'location',
  'description',
  'vehicleModels',
  'partSide',
  'tags',
  'shelfAddress',
  'moq',
  'costValue',
  'discountPrice',
  'saleValue',
  'cargoWeightKg',
  'cargoSize',
  'isShippable',
  'showOnline',
]

/**
 * Shippable and Online are edited in place, as in the reference product. Both
 * live on the *product*, so flipping one moves every variation of that part —
 * which is why the store updates them together rather than per row.
 */
function FlagToggle({
  row,
  flag,
  label,
}: {
  row: VariationRow
  flag: 'isShippable' | 'showOnline'
  label: string
}) {
  const setFlag = useDataStore((s) => s.setProductFlag)
  return (
    <Switch
      checked={row[flag]}
      onCheckedChange={(value) => setFlag(row.productId, flag, value)}
      aria-label={`${label} — ${row.fullName}`}
    />
  )
}
