import { Pencil, Trash2 } from 'lucide-react'
import { Badge } from '@/shared/ui/Badge'
import { RowActions } from '@/shared/components/RowActions'
import type { TableColumn } from '@/shared/components/table/features'
import { formatMoney, formatNumber, formatPercent } from '@/shared/lib/format'
import { marginRatio, type Product } from '../model/product'

/**
 * Column order follows DESIGN_RULES § 5.2:
 * identifier → name → categorisation → quantities → money → status → actions.
 */
export function buildProductColumns({
  onEdit,
  onDelete,
  canEdit,
  canDelete,
}: {
  onEdit: (product: Product) => void
  onDelete: (product: Product) => void
  canEdit: boolean
  canDelete: boolean
}): TableColumn<Product>[] {
  return [
    {
      accessorKey: 'sku',
      header: 'SKU',
      cell: ({ row }) => <span className="font-mono text-2xs">{row.original.sku}</span>,
      enableHiding: false,
    },
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <div className="min-w-48">
          <p className="font-medium">{row.original.name}</p>
          {row.original.brandName ? (
            <p className="text-2xs text-fg-muted">{row.original.brandName}</p>
          ) : null}
        </div>
      ),
      enableHiding: false,
    },
    {
      accessorKey: 'categoryName',
      header: 'Category',
      cell: ({ row }) => row.original.categoryName || <Empty />,
    },
    {
      accessorKey: 'stock',
      header: 'Stock',
      meta: { align: 'right' },
      cell: ({ row }) => {
        const { stock, lowStockThreshold, unit } = row.original
        // Low stock is "needs attention", so it is warning-orange, never yellow
        // (yellow is the brand) and never danger-red (that is out of stock).
        const low = lowStockThreshold !== null && stock <= lowStockThreshold
        const out = stock === 0
        return (
          <span
            className={out ? 'font-medium text-danger' : low ? 'font-medium text-warning' : undefined}
          >
            {formatNumber(stock)} {unit}
          </span>
        )
      },
    },
    {
      accessorKey: 'costPrice',
      header: 'Cost',
      meta: { align: 'right' },
      cell: ({ row }) => formatMoney(row.original.costPrice),
    },
    {
      accessorKey: 'salePrice',
      header: 'Price',
      meta: { align: 'right' },
      cell: ({ row }) => formatMoney(row.original.salePrice),
    },
    {
      id: 'margin',
      header: 'Margin',
      meta: { align: 'right' },
      cell: ({ row }) => (
        <span className="text-fg-muted">{formatPercent(marginRatio(row.original))}</span>
      ),
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
            {
              label: 'Edit',
              icon: Pencil,
              onSelect: () => onEdit(row.original),
              hidden: !canEdit,
            },
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

/** Empty cells render an em dash, never a blank (DESIGN_RULES § 5.1). */
function Empty() {
  return <span className="text-fg-subtle">—</span>
}
