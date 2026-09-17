import { Link } from 'react-router'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { ProductThumb } from '@/shared/components/ProductThumb'
import type { TableColumn } from '@/shared/components/table/features'
import { Button } from '@/shared/ui/Button'
import { paths } from '@/shared/config/paths'
import { formatDateTime, formatNumber } from '@/shared/lib/format'
import { logKindLabel, type StockLogEntry } from '../model/log'

/** Where each kind of document lives, so a row can be clicked through. */
export const documentPath = (entry: StockLogEntry) => {
  switch (entry.kind) {
    case 'receipt':
      return paths.products.goodsReceiptDetail(entry.documentId)
    case 'transfer_in':
    case 'transfer_out':
      return paths.products.transferDetail(entry.documentId)
    case 'correction':
    case 'stocktake':
      return paths.products.correctionDetail(entry.documentId)
    case 'sale':
      return paths.sales.orderDetail(entry.documentId)
    case 'online_sale':
      return paths.sales.onlineDetail(entry.documentId)
  }
}

/**
 * The log's columns, shared by the Product logs page and a product's own Log
 * tab so the two can never read differently.
 *
 * `subject` is the only difference: across every product the first column says
 * which product moved; inside one product it only needs to say which
 * variation, since the product is the page you are on.
 */
export function buildLogColumns({
  subject,
}: {
  subject: 'product' | 'variation'
}): TableColumn<StockLogEntry>[] {
  return [
    {
      accessorKey: 'name',
      header: subject === 'product' ? 'Product' : 'Variation',
      enableHiding: false,
      cell: ({ row }) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <ProductThumb src={row.original.imageUrl} size="sm" />
          <div className="min-w-0">
            <p className="text-fg truncate font-medium">{row.original.name}</p>
            <p className="text-fg-subtle text-2xs truncate font-mono">{row.original.sku}</p>
          </div>
        </div>
      ),
    },
    { accessorKey: 'locationName', header: 'Location' },
    {
      id: 'delta',
      header: 'Change',
      meta: { align: 'right' },
      enableHiding: false,
      cell: ({ row }) => {
        const up = row.original.delta > 0
        return (
          <div>
            <p
              className={`flex items-center justify-end gap-1 font-medium tabular-nums ${
                up ? 'text-success' : 'text-danger'
              }`}
            >
              {up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
              {up ? '+' : '−'}
              {formatNumber(Math.abs(row.original.delta))}
            </p>
            <p className="text-fg-subtle text-2xs tabular-nums">
              {row.original.balanceAfter === null
                ? '—'
                : `→ ${formatNumber(row.original.balanceAfter)}`}
            </p>
          </div>
        )
      },
    },
    {
      id: 'document',
      header: 'Because of',
      enableHiding: false,
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="text-fg-muted text-2xs">{logKindLabel(row.original.kind)}</p>
          {/* OX shows a grey icon here. A number you can click is the point
              of an audit trail — the next question is always "show me". */}
          <Button variant="link" size="sm" className="h-auto px-0 font-mono" asChild>
            <Link to={documentPath(row.original)} onClick={(event) => event.stopPropagation()}>
              {row.original.documentNumber}
            </Link>
          </Button>
        </div>
      ),
    },
    {
      accessorKey: 'reason',
      header: 'Reason',
      cell: ({ row }) => row.original.reason ?? <span className="text-fg-subtle">—</span>,
    },
    { accessorKey: 'by', header: 'Who' },
    {
      accessorKey: 'at',
      header: 'When',
      enableHiding: false,
      cell: ({ row }) => formatDateTime(row.original.at),
    },
  ]
}
