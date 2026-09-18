import { Link } from 'react-router'
import { Ban, Download } from 'lucide-react'
import { Badge } from '@/shared/ui/Badge'
import { SoldBar } from '@/shared/components/SoldBar'
import { RowActions } from '@/shared/components/RowActions'
import type { TableColumn } from '@/shared/components/table/features'
import { paths } from '@/shared/config/paths'
import { PROCUREMENT_KINDS } from '@/shared/types'
import { formatDateTime, formatMoney, formatNumber } from '@/shared/lib/format'
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
import { t } from '@/shared/i18n'

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
      header: t('ID'),
      enableHiding: false,
      cell: ({ row }) => <span className="text-2xs font-mono">{row.original.number}</span>,
    },
    {
      accessorKey: 'createdAt',
      header: t('Date'),
      cell: ({ row }) => formatDateTime(row.original.createdAt),
    },
    {
      id: 'quantity',
      header: t('Quantity'),
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
      header: t('Sold'),
      enableHiding: false,
      cell: ({ row }) => (
        <SoldBar {...soldThrough(row.original, stockAt)} place={t('since this delivery arrived')} />
      ),
    },
    {
      accessorKey: 'locationName',
      header: t('Location'),
    },
    {
      accessorKey: 'createdBy',
      header: t('User'),
    },
    {
      accessorKey: 'status',
      header: t('Status'),
      cell: ({ row }) => (
        <Badge tone={receiptStatusTone(row.original.status)}>
          {receiptStatusLabel(row.original.status)}
        </Badge>
      ),
    },
    {
      accessorKey: 'kind',
      header: t('Type'),
      cell: ({ row }) => (
        <Badge tone="neutral">
          {t(
            PROCUREMENT_KINDS.find((k) => k.value === row.original.kind)?.label ??
              row.original.kind,
          )}
        </Badge>
      ),
    },
    {
      accessorKey: 'supplierName',
      header: t('Suppliers'),
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
      header: t('Order'),
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
      header: t('Note'),
      cell: ({ row }) => row.original.comment ?? <Empty />,
    },
    ...(canSeeCost
      ? [
          {
            id: 'landed',
            header: t('Cost price'),
            meta: { align: 'right' as const },
            cell: ({ row }: { row: { original: GoodsReceipt } }) => (
              <span className="font-medium">{formatMoney(landedTotal(row.original, usdRate))}</span>
            ),
          },
          {
            id: 'retail',
            header: t('Sale price'),
            meta: { align: 'right' as const },
            cell: ({ row }: { row: { original: GoodsReceipt } }) =>
              formatMoney(retailValue(row.original, salePriceOf)),
          },
          {
            id: 'supplierTotal',
            header: t('Supply price'),
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
              label: t('Download'),
              icon: Download,
              onSelect: () => onDownload(row.original),
            },
            {
              label: t('Delete receipt'),
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
