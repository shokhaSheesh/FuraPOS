import { Ban, Download } from 'lucide-react'
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
  retailValue,
  soldThrough,
  supplierTotal,
  type GoodsReceipt,
} from '../model/receipt'

const Empty = () => <span className="text-fg-subtle">—</span>

export function buildReceiptColumns({
  onCancel,
  onDownload,
  canCancelReceipts,
  canSeeCost,
  usdRate,
  stockAt,
  salePriceOf,
}: {
  onCancel: (receipt: GoodsReceipt) => void
  onDownload: (receipt: GoodsReceipt) => void
  canCancelReceipts: boolean
  canSeeCost: boolean
  usdRate: number
  /** Live stock, for the sell-through estimate. */
  stockAt: (variationId: string, locationId: string) => number
  salePriceOf: (variationId: string) => number
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
    /*
      OX's `Реализовано`: how much of the delivery has sold through. The most
      useful column on the screen, because it says whether a container was a
      good buy rather than merely that it arrived. It is an estimate — see
      `soldThrough` — so it is drawn as a bar and a rounded percentage, never as
      a precise unit count pretending to be exact.
    */
    {
      id: 'soldThrough',
      header: 'Sold through',
      enableHiding: false,
      cell: ({ row }) => {
        const { received, sold, ratio } = soldThrough(row.original, stockAt)
        if (received === 0) return <Empty />
        return (
          <div
            className="flex items-center gap-2"
            title={`About ${formatNumber(sold)} of ${formatNumber(received)} sold`}
          >
            <span className="bg-surface-inset h-1.5 w-20 shrink-0 overflow-hidden rounded-full">
              <span
                className={`block h-full rounded-full ${ratio >= 1 ? 'bg-success' : 'bg-info'}`}
                style={{ width: `${Math.min(100, Math.round(ratio * 100))}%` }}
              />
            </span>
            <span className="text-fg-muted text-2xs tabular-nums">{formatPercent(ratio)}</span>
          </div>
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
            id: 'retail',
            header: 'Value at sale',
            meta: { align: 'right' as const },
            cell: ({ row }: { row: { original: GoodsReceipt } }) =>
              formatMoney(retailValue(row.original, salePriceOf)),
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
          actions={[
            {
              label: 'Download as CSV',
              icon: Download,
              onSelect: () => onDownload(row.original),
            },
            {
              label: 'Cancel receipt',
              icon: Ban,
              destructive: true,
              hidden: !canCancelReceipts || !canCancel(row.original.status),
              onSelect: () => onCancel(row.original),
            },
          ]}
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
  'retail',
  'receivedAt',
  'createdBy',
  'receivedBy',
  'comment',
]
