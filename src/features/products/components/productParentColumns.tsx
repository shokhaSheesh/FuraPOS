import { Badge } from '@/shared/ui/Badge'
import { ProductThumb } from '@/shared/components/ProductThumb'
import type { TableColumn } from '@/shared/components/table/features'
import { formatMoney, formatNumber } from '@/shared/lib/format'
import { productPriceRange, productStock, type Product } from '../model/product'

const Empty = () => <span className="text-fg-subtle">—</span>

/**
 * The parent view. A product is not sellable — its variations are — so this
 * table aggregates rather than pretending a product has one stock and one
 * price: a count of variations, total stock, and a price *range*.
 */
export const productParentColumns: TableColumn<Product>[] = [
  {
    accessorKey: 'name',
    header: 'Product',
    cell: ({ row }) => (
      <div className="flex items-center gap-2.5">
        <ProductThumb src={row.original.variations[0]?.imageUrl} size="sm" />
        <div className="min-w-0">
          <p className="font-medium">{row.original.name}</p>
          {row.original.description ? (
            <p className="text-fg-subtle text-2xs">OEM {row.original.description}</p>
          ) : null}
        </div>
      </div>
    ),
    enableHiding: false,
  },
  {
    id: 'variations',
    header: 'Variations',
    meta: { align: 'right' },
    cell: ({ row }) => formatNumber(row.original.variations.length),
  },
  {
    accessorKey: 'brandName',
    header: 'Brand',
    cell: ({ row }) => row.original.brandName ?? <Empty />,
  },
  {
    accessorKey: 'categoryName',
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
    id: 'stock',
    header: 'Stock',
    meta: { align: 'right' },
    cell: ({ row }) => {
      const stock = productStock(row.original)
      return (
        <span className={stock === 0 ? 'text-danger font-medium' : undefined}>
          {formatNumber(stock)} {row.original.unit}
        </span>
      )
    },
  },
  {
    id: 'price',
    header: 'Price',
    meta: { align: 'right' },
    cell: ({ row }) => {
      const { min, max } = productPriceRange(row.original)
      // A range, because variations of one part are not always priced alike.
      return min === max ? formatMoney(min) : `${formatMoney(min)} – ${formatMoney(max)}`
    },
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) =>
      row.original.status === 'active' ? (
        <Badge tone="success">Active</Badge>
      ) : (
        <Badge>Archived</Badge>
      ),
  },
]
