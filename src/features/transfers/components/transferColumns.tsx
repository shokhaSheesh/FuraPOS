import { ArrowRight, Trash2 } from 'lucide-react'
import { Badge } from '@/shared/ui/Badge'
import { RowActions } from '@/shared/components/RowActions'
import type { TableColumn } from '@/shared/components/table/features'
import { formatDate, formatNumber } from '@/shared/lib/format'
import {
  canCancel,
  transferQuantity,
  transferStatusLabel,
  transferStatusTone,
  type Transfer,
} from '../model/transfer'

const Empty = () => <span className="text-fg-subtle">—</span>

/**
 * Column order follows DESIGN_RULES § 5.2: identifier → name → categorisation
 * → quantities → status → actions. The "name" of a transfer is its route, so
 * From → To is one column rather than two — reading a movement as a single
 * phrase is the whole point of the screen.
 */
export function buildTransferColumns({
  onCancel,
  canCancelTransfers,
}: {
  onCancel: (transfer: Transfer) => void
  canCancelTransfers: boolean
}): TableColumn<Transfer>[] {
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
      id: 'route',
      header: 'Route',
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
      header: 'Items',
      meta: { align: 'right' },
      cell: ({ row }) => formatNumber(row.original.lines.length),
    },
    {
      id: 'quantity',
      header: 'Units',
      meta: { align: 'right' },
      cell: ({ row }) => formatNumber(transferQuantity(row.original)),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge tone={transferStatusTone(row.original.status)}>
          {transferStatusLabel(row.original.status)}
        </Badge>
      ),
    },
    {
      accessorKey: 'sentAt',
      header: 'Sent',
      cell: ({ row }) => (row.original.sentAt ? formatDate(row.original.sentAt) : <Empty />),
    },
    {
      accessorKey: 'receivedAt',
      header: 'Received',
      cell: ({ row }) =>
        row.original.receivedAt ? formatDate(row.original.receivedAt) : <Empty />,
    },
    {
      accessorKey: 'createdBy',
      header: 'Created by',
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
            canCancelTransfers && canCancel(row.original.status)
              ? [
                  {
                    label: 'Cancel transfer',
                    icon: Trash2,
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

/** Dates and provenance start hidden: the route and its state are the story. */
export const TRANSFER_COLUMNS_HIDDEN_BY_DEFAULT = ['sentAt', 'receivedAt', 'createdBy', 'comment']
