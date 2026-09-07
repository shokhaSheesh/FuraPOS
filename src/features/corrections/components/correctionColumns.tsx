import { Undo2 } from 'lucide-react'
import { Badge } from '@/shared/ui/Badge'
import { RowActions } from '@/shared/components/RowActions'
import type { TableColumn } from '@/shared/components/table/features'
import { formatDate, formatMoney, formatNumber } from '@/shared/lib/format'
import {
  correctionReasonLabel,
  correctionStatusLabel,
  correctionStatusTone,
  netCostValue,
  netUnits,
  writtenOff,
  writtenOn,
  type Correction,
} from '../model/correction'

const Empty = () => <span className="text-fg-subtle">—</span>

/** A signed quantity, coloured by direction. Losses are the ones that matter. */
function Delta({ value, suffix }: { value: number; suffix?: string }) {
  if (value === 0) return <Empty />
  return (
    <span className={value < 0 ? 'text-danger font-medium' : 'text-success font-medium'}>
      {value > 0 ? '+' : '−'}
      {formatNumber(Math.abs(value))}
      {suffix ? ` ${suffix}` : ''}
    </span>
  )
}

export function buildCorrectionColumns({
  onCancel,
  canCancel,
  canSeeCost,
  usdRate,
}: {
  onCancel: (correction: Correction) => void
  canCancel: boolean
  canSeeCost: boolean
  usdRate: number
}): TableColumn<Correction>[] {
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
      accessorKey: 'locationName',
      header: 'Location',
    },
    {
      accessorKey: 'reason',
      header: 'Reason',
      enableHiding: false,
      cell: ({ row }) => correctionReasonLabel(row.original.reason),
    },
    {
      id: 'items',
      header: 'Items',
      meta: { align: 'right' },
      cell: ({ row }) => formatNumber(row.original.lines.length),
    },
    {
      id: 'net',
      header: 'Change',
      meta: { align: 'right' },
      enableHiding: false,
      cell: ({ row }) => <Delta value={netUnits(row.original)} />,
    },
    // Both directions in one document is rare but real — a recount that finds
    // three of one part and loses two of another. A single net figure would
    // hide it, so the two are available as their own columns.
    {
      id: 'writtenOff',
      header: 'Written off',
      meta: { align: 'right' },
      cell: ({ row }) => {
        const off = writtenOff(row.original)
        return off > 0 ? formatNumber(off) : <Empty />
      },
    },
    {
      id: 'writtenOn',
      header: 'Written on',
      meta: { align: 'right' },
      cell: ({ row }) => {
        const on = writtenOn(row.original)
        return on > 0 ? formatNumber(on) : <Empty />
      },
    },
    ...(canSeeCost
      ? [
          {
            id: 'value',
            header: 'Value at cost',
            meta: { align: 'right' as const },
            cell: ({ row }: { row: { original: Correction } }) => {
              const value = netCostValue(row.original, usdRate)
              return (
                <span className={value < 0 ? 'text-danger' : undefined}>
                  {value < 0 ? '−' : ''}
                  {formatMoney(Math.abs(value))}
                </span>
              )
            },
          },
        ]
      : []),
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge tone={correctionStatusTone(row.original.status)}>
          {correctionStatusLabel(row.original.status)}
        </Badge>
      ),
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
            canCancel && row.original.status === 'applied'
              ? [
                  {
                    label: 'Reverse correction',
                    icon: Undo2,
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

export const CORRECTION_COLUMNS_HIDDEN_BY_DEFAULT = [
  'writtenOff',
  'writtenOn',
  'createdBy',
  'comment',
]
