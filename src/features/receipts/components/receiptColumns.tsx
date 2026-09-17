import { Link } from 'react-router'
import { Ban, Download } from 'lucide-react'
import { Badge } from '@/shared/ui/Badge'
import { RowActions } from '@/shared/components/RowActions'
import type { TableColumn } from '@/shared/components/table/features'
import { paths } from '@/shared/config/paths'
import { PROCUREMENT_KINDS } from '@/shared/types'
import { formatDateTime, formatMoney, formatNumber, formatPercent } from '@/shared/lib/format'
import {
  canCancel,
  landedTotal,
  receiptOrdered,
  receiptReceived,
  receiptSource,
  receiptStatusLabel,
  receiptStatusTone,
  retailValue,
  soldThrough,
  supplierTotal,
  type GoodsReceipt,
} from '../model/receipt'

const Empty = () => <span className="text-fg-subtle">—</span>

/**
 * The goods-receipt list, column for column as the reference product has it.
 *
 * The one that earns its place is "Sold" — how much of a delivery has moved
 * since it landed. It is what turns a list of deliveries into a judgement about
 * them: a container at 6% after three months was a bad buy, and no other column
 * here says so.
 */
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
      header: 'ID',
      enableHiding: false,
      cell: ({ row }) => <span className="text-2xs font-mono">{row.original.number}</span>,
    },
    {
      accessorKey: 'createdAt',
      header: 'Date',
      cell: ({ row }) => formatDateTime(row.original.createdAt),
    },
    {
      id: 'quantity',
      header: 'Quantity',
      meta: { align: 'right' },
      cell: ({ row }) =>
        formatNumber(
          row.original.status === 'draft'
            ? receiptOrdered(row.original)
            : receiptReceived(row.original),
        ),
    },
    /*
      An estimate, and knowingly so — see `soldThrough`. It is drawn as a bar
      and a rounded percentage rather than a unit count, so it never reads as a
      figure somebody could reconcile to the penny.
    */
    {
      id: 'soldThrough',
      header: 'Sold',
      enableHiding: false,
      cell: ({ row }) => {
        const { received, sold, ratio } = soldThrough(row.original, stockAt)
        if (received === 0) return <Empty />
        return (
          <div
            className="flex items-center gap-2"
            title={`About ${formatNumber(sold)} of the ${formatNumber(
              received,
            )} units in this delivery have sold since it arrived`}
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
    {
      accessorKey: 'locationName',
      header: 'Location',
    },
    {
      accessorKey: 'createdBy',
      header: 'User',
    },
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
      accessorKey: 'kind',
      header: 'Type',
      cell: ({ row }) => (
        <Badge tone="neutral">
          {PROCUREMENT_KINDS.find((k) => k.value === row.original.kind)?.label ?? row.original.kind}
        </Badge>
      ),
    },
    {
      accessorKey: 'supplierName',
      header: 'Suppliers',
      enableHiding: false,
      // A market or China buy has no supplier record, so the source phrase
      // stands in — an unlabelled dash would read as "we don't know".
      cell: ({ row }) => <Badge tone="neutral">{receiptSource(row.original)}</Badge>,
    },
    /*
      Which order this delivery came against, when one did. A receipt with no
      order behind it is the ordinary case — goods turn up and somebody books
      them in — so an empty cell here is not a gap in the data.
    */
    {
      accessorKey: 'orderNumber',
      header: 'Order',
      cell: ({ row }) =>
        row.original.orderId && row.original.orderNumber ? (
          <Link
            to={paths.procurement.orderDetail(row.original.orderId)}
            onClick={(event) => event.stopPropagation()}
            className="text-primary text-2xs font-mono hover:underline"
          >
            {row.original.orderNumber}
          </Link>
        ) : (
          <Empty />
        ),
    },
    {
      accessorKey: 'comment',
      header: 'Note',
      cell: ({ row }) => row.original.comment ?? <Empty />,
    },
    ...(canSeeCost
      ? [
          {
            id: 'landed',
            header: 'Cost price',
            meta: { align: 'right' as const },
            cell: ({ row }: { row: { original: GoodsReceipt } }) => (
              <span className="font-medium">{formatMoney(landedTotal(row.original, usdRate))}</span>
            ),
          },
          {
            id: 'retail',
            header: 'Sale price',
            meta: { align: 'right' as const },
            cell: ({ row }: { row: { original: GoodsReceipt } }) =>
              formatMoney(retailValue(row.original, salePriceOf)),
          },
          {
            id: 'supplierTotal',
            header: 'Supply price',
            meta: { align: 'right' as const },
            cell: ({ row }: { row: { original: GoodsReceipt } }) =>
              formatMoney(supplierTotal(row.original, usdRate)),
          },
        ]
      : []),
    {
      id: 'actions',
      header: '',
      enableHiding: false,
      cell: ({ row }) => (
        <RowActions
          actions={[
            {
              label: 'Download',
              icon: Download,
              onSelect: () => onDownload(row.original),
            },
            {
              label: 'Delete receipt',
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

/**
 * The three money columns start hidden, exactly as the reference has them: they
 * are the ones a manager turns on for a review and nobody needs day to day.
 */
export const RECEIPT_COLUMNS_HIDDEN_BY_DEFAULT = ['landed', 'retail', 'supplierTotal']
