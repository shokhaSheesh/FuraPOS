import { Ban } from 'lucide-react'
import { Badge } from '@/shared/ui/Badge'
import { RowActions } from '@/shared/components/RowActions'
import type { TableColumn } from '@/shared/components/table/features'
import { formatDate, formatMoney, formatNumber, formatPercent } from '@/shared/lib/format'
import {
  canCancel,
  extraCostsTotal,
  landedTotal,
  landedUplift,
  receiptOrdered,
  receiptReceived,
  receiptShortfall,
  receiptStatusLabel,
  receiptStatusTone,
  supplierTotal,
  type GoodsReceipt,
} from '../model/receipt'

const Empty = () => <span className="text-fg-subtle">—</span>

export function buildReceiptColumns({
  onCancel,
  canCancelReceipts,
  canSeeCost,
  usdRate,
}: {
  onCancel: (receipt: GoodsReceipt) => void
  canCancelReceipts: boolean
  canSeeCost: boolean
  usdRate: number
}): TableColumn<GoodsReceipt>[] {
  return [
    {
      accessorKey: 'number',
      header: 'Number',
      cell: ({ row }) => <span className="text-2xs font-mono">{row.original.number}</span>,
      enableHiding: false,
    },
    {
      accessorKey: 'createdAt',
      header: 'Created',
      cell: ({ row }) => formatDate(row.original.createdAt),
    },
    {
      accessorKey: 'supplierName',
      header: 'Supplier',
      enableHiding: false,
      cell: ({ row }) => row.original.supplierName ?? <Empty />,
    },
    {
      accessorKey: 'invoiceNumber',
      header: 'Invoice',
      cell: ({ row }) =>
        row.original.invoiceNumber ? (
          <span className="text-2xs font-mono">{row.original.invoiceNumber}</span>
        ) : (
          <Empty />
        ),
    },
    {
      accessorKey: 'locationName',
      header: 'Landed at',
    },
    {
      id: 'items',
      header: 'Items',
      meta: { align: 'right' },
      cell: ({ row }) => formatNumber(row.original.lines.length),
    },
    {
      id: 'ordered',
      header: 'Invoiced',
      meta: { align: 'right' },
      cell: ({ row }) => formatNumber(receiptOrdered(row.original)),
    },
    {
      id: 'received',
      header: 'Received',
      meta: { align: 'right' },
      cell: ({ row }) => {
        if (row.original.receivedAt === null) return <Empty />
        const short = receiptShortfall(row.original)
        return (
          // Short of the invoice is a claim against the supplier, not a loss —
          // so it is flagged, but not in the same red as stock that vanished.
          <span className={short > 0 ? 'text-warning font-medium' : undefined}>
            {formatNumber(receiptReceived(row.original))}
            {short > 0 ? ` (−${formatNumber(short)})` : ''}
          </span>
        )
      },
    },
    ...(canSeeCost
      ? [
          {
            id: 'supplierTotal',
            header: 'Supplier total',
            meta: { align: 'right' as const },
            cell: ({ row }: { row: { original: GoodsReceipt } }) =>
              formatMoney(supplierTotal(row.original, usdRate)),
          },
          {
            id: 'extras',
            header: 'Freight & duty',
            meta: { align: 'right' as const },
            cell: ({ row }: { row: { original: GoodsReceipt } }) => {
              const extras = extraCostsTotal(row.original, usdRate)
              return extras > 0 ? formatMoney(extras) : <Empty />
            },
          },
          {
            id: 'landed',
            header: 'Landed total',
            meta: { align: 'right' as const },
            cell: ({ row }: { row: { original: GoodsReceipt } }) => (
              <span className="font-medium">{formatMoney(landedTotal(row.original, usdRate))}</span>
            ),
          },
          {
            id: 'uplift',
            header: 'Uplift',
            meta: { align: 'right' as const },
            cell: ({ row }: { row: { original: GoodsReceipt } }) => {
              const uplift = landedUplift(row.original, usdRate)
              return uplift > 0 ? formatPercent(uplift) : <Empty />
            },
          },
        ]
      : []),
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge tone={receiptStatusTone(row.original.status)}>
          {receiptStatusLabel(row.original.status)}
        </Badge>
      ),
    },
    {
      accessorKey: 'receivedAt',
      header: 'Received on',
      cell: ({ row }) =>
        row.original.receivedAt ? formatDate(row.original.receivedAt) : <Empty />,
    },
    {
      accessorKey: 'createdBy',
      header: 'Created by',
    },
    {
      accessorKey: 'receivedBy',
      header: 'Received by',
      cell: ({ row }) => row.original.receivedBy ?? <Empty />,
    },
    {
      accessorKey: 'comment',
      header: 'Comment',
      cell: ({ row }) => row.original.comment ?? <Empty />,
    },
    {
      id: 'actions',
      header: '',
      enableHiding: false,
      cell: ({ row }) => (
        <RowActions
          actions={
            canCancelReceipts && canCancel(row.original.status)
              ? [
                  {
                    label: 'Cancel receipt',
                    icon: Ban,
                    destructive: true,
                    onSelect: () => onCancel(row.original),
                  },
                ]
              : []
          }
        />
      ),
    },
  ]
}

/** The money is the point, so it stays; the provenance columns start hidden. */
export const RECEIPT_COLUMNS_HIDDEN_BY_DEFAULT = [
  'invoiceNumber',
  'supplierTotal',
  'extras',
  'receivedAt',
  'createdBy',
  'receivedBy',
  'comment',
]
