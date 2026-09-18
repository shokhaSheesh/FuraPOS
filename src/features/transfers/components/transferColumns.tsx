import { ArrowRight, Download, Trash2 } from 'lucide-react'
import { Badge } from '@/shared/ui/Badge'
import { RowActions } from '@/shared/components/RowActions'
import { SoldBar } from '@/shared/components/SoldBar'
import type { TableColumn } from '@/shared/components/table/features'
import { formatDate, formatMoney, formatNumber } from '@/shared/lib/format'
import {
  canCancel,
  transferCostValue,
  transferInTransit,
  transferReceived,
  transferRequested,
  transferSaleValue,
  transferSent,
  transferShortfall,
  transferSoldThrough,
  transferStatusLabel,
  transferStatusTone,
  type Transfer,
} from '../model/transfer'
import { t } from '@/shared/i18n'

const Empty = () => <span className="text-fg-subtle">—</span>

/**
 * Column order follows DESIGN_RULES § 5.2: identifier → name → categorisation
 * → quantities → status → actions. The "name" of a transfer is its route, so
 * From → To is one column rather than two — reading a movement as a single
 * phrase is the whole point of the screen.
 */
export function buildTransferColumns({
  onCancel,
  onDownload,
  sales,
  canCancelTransfers,
  canSeeCost,
  usdRate,
}: {
  onCancel: (transfer: Transfer) => void
  onDownload: (transfer: Transfer) => void
  /** For how much of what arrived has sold at the destination. */
  sales: Parameters<typeof transferSoldThrough>[1]
  canCancelTransfers: boolean
  canSeeCost: boolean
  usdRate: number
}): TableColumn<Transfer>[] {
  return [
    {
      accessorKey: 'number',
      header: t('Number'),
      cell: ({ row }) => <span className="text-2xs font-mono">{row.original.number}</span>,
      enableHiding: false,
    },
    {
      accessorKey: 'createdAt',
      header: t('Created'),
      cell: ({ row }) => formatDate(row.original.createdAt),
    },
    {
      id: 'route',
      header: t('Route'),
      enableHiding: false,
      cell: ({ row }) => (
        <span className="flex items-center gap-1.5">
          <span className="text-fg-muted">{row.original.fromLocationName}</span>
          <ArrowRight className="text-fg-subtle size-3.5 shrink-0" />
          <span className="text-fg font-medium">{row.original.toLocationName}</span>
        </span>
      ),
    },
    {
      id: 'items',
      header: t('Items'),
      meta: { align: 'right' },
      cell: ({ row }) => formatNumber(row.original.lines.length),
    },
    /*
      OX's four quantity columns, kept as four because the gaps between them
      are the information: ordered vs sent is what the warehouse could not
      meet, sent vs received is what went missing on the road.
    */
    {
      id: 'requested',
      header: t('Ordered'),
      meta: { align: 'right' },
      cell: ({ row }) => formatNumber(transferRequested(row.original)),
    },
    {
      id: 'sent',
      header: t('Sent'),
      meta: { align: 'right' },
      cell: ({ row }) =>
        row.original.status === 'draft' ? <Empty /> : formatNumber(transferSent(row.original)),
    },
    {
      id: 'received',
      header: t('Received'),
      meta: { align: 'right' },
      cell: ({ row }) => {
        const short = transferShortfall(row.original)
        if (row.original.receivedAt === null) return <Empty />
        return (
          <span className={short > 0 ? 'text-danger font-medium' : undefined}>
            {formatNumber(transferReceived(row.original))}
            {short > 0 ? ` (−${formatNumber(short)})` : ''}
          </span>
        )
      },
    },
    {
      id: 'inTransit',
      header: t('In transit'),
      meta: { align: 'right' },
      cell: ({ row }) => {
        const moving = transferInTransit(row.original)
        return moving > 0 ? formatNumber(moving) : <Empty />
      },
    },
    // An estimate, drawn as a bar like a goods receipt's — see `transferSoldThrough`.
    {
      id: 'sold',
      header: t('Sold'),
      enableHiding: false,
      cell: ({ row }) => (
        <SoldBar
          {...transferSoldThrough(row.original, sales)}
          place={`at ${row.original.toLocationName} since it arrived`}
        />
      ),
    },
    {
      accessorKey: 'status',
      header: t('Status'),
      cell: ({ row }) => (
        <Badge tone={transferStatusTone(row.original.status)}>
          {transferStatusLabel(row.original.status)}
        </Badge>
      ),
    },
    {
      accessorKey: 'sentAt',
      header: t('Sent'),
      cell: ({ row }) => (row.original.sentAt ? formatDate(row.original.sentAt) : <Empty />),
    },
    {
      accessorKey: 'receivedAt',
      header: t('Received'),
      cell: ({ row }) =>
        row.original.receivedAt ? formatDate(row.original.receivedAt) : <Empty />,
    },
    {
      accessorKey: 'createdBy',
      header: t('Created by'),
    },
    {
      accessorKey: 'sentBy',
      header: t('Sent by'),
      cell: ({ row }) => row.original.sentBy ?? <Empty />,
    },
    {
      accessorKey: 'receivedBy',
      header: t('Received by'),
      cell: ({ row }) => row.original.receivedBy ?? <Empty />,
    },
    // What is riding on the truck, valued. Cost is permission-gated exactly as
    // it is in the catalogue.
    ...(canSeeCost
      ? [
          {
            id: 'costValue',
            header: t('Value at cost'),
            meta: { align: 'right' as const },
            cell: ({ row }: { row: { original: Transfer } }) =>
              formatMoney(transferCostValue(row.original, usdRate)),
          },
        ]
      : []),
    {
      id: 'saleValue',
      header: t('Value at sale'),
      meta: { align: 'right' },
      cell: ({ row }) => formatMoney(transferSaleValue(row.original)),
    },
    {
      accessorKey: 'comment',
      header: t('Comment'),
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
              label: t('Download'),
              icon: Download,
              onSelect: () => onDownload(row.original),
            },
            {
              label: t('Cancel transfer'),
              icon: Trash2,
              destructive: true,
              hidden: !canCancelTransfers || !canCancel(row.original.status),
              onSelect: () => onCancel(row.original),
            },
          ]}
        />
      ),
    },
  ]
}

/**
 * The route, its state and what is moving are the story; timestamps, the people
 * and the money are one click away in the Columns menu.
 */
export const TRANSFER_COLUMNS_HIDDEN_BY_DEFAULT = [
  'sentAt',
  'receivedAt',
  'createdBy',
  'sentBy',
  'receivedBy',
  'comment',
  'requested',
  'costValue',
  'saleValue',
]
