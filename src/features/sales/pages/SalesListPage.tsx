import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router'
import { Download, Plus } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { DataTable } from '@/shared/components/DataTable'
import { SearchInput } from '@/shared/components/SearchInput'
import { EmptyState } from '@/shared/components/EmptyState'
import { StatusChips } from '@/shared/components/StatusChips'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { DateRangePicker } from '@/shared/ui/DateRangePicker'
import { toast } from '@/shared/ui/toast'
import type { TableColumn } from '@/shared/components/table/features'
import { useListQuery } from '@/shared/hooks/useListQuery'
import { useSession } from '@/app/providers/SessionProvider'
import { paths } from '@/shared/config/paths'
import { downloadCsv } from '@/shared/lib/csv'
import { formatDate, formatDateTime, formatMoney, formatNumber } from '@/shared/lib/format'
import { useSales, useSalesSummary } from '../api/sales'
import { SalesSummaryStrip } from '../components/SalesSummaryStrip'
import {
  PAYMENT_METHODS,
  SALE_CHANNELS,
  SALE_STATUSES,
  type Sale,
  type SaleStatus,
} from '../model/sale'

const Empty = () => <span className="text-fg-subtle">—</span>

const columns: TableColumn<Sale>[] = [
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
    accessorKey: 'updatedAt',
    header: 'Updated',
    cell: ({ row }) => formatDateTime(row.original.updatedAt),
  },
  {
    accessorKey: 'finishedAt',
    header: 'Finished',
    cell: ({ row }) =>
      row.original.finishedAt ? formatDateTime(row.original.finishedAt) : <Empty />,
  },
  {
    accessorKey: 'expiresAt',
    header: 'Expires',
    cell: ({ row }) =>
      row.original.expiresAt ? formatDateTime(row.original.expiresAt) : <Empty />,
  },
  {
    accessorKey: 'clientName',
    header: 'Client',
    cell: ({ row }) => row.original.clientName ?? <span className="text-fg-subtle">Walk-in</span>,
  },
  { accessorKey: 'locationName', header: 'Location' },
  { accessorKey: 'sellerName', header: 'Seller' },
  {
    accessorKey: 'channel',
    header: 'Channel',
    cell: ({ row }) => SALE_CHANNELS.find((c) => c.value === row.original.channel)?.label ?? '—',
  },
  {
    accessorKey: 'paymentMethod',
    header: 'Payment',
    cell: ({ row }) =>
      PAYMENT_METHODS.find((m) => m.value === row.original.paymentMethod)?.label ?? '—',
  },
  {
    id: 'items',
    header: 'Items',
    meta: { align: 'right' },
    cell: ({ row }) =>
      formatNumber(row.original.lines.reduce((sum, line) => sum + line.quantity, 0)),
  },
  {
    accessorKey: 'total',
    header: 'Total',
    meta: { align: 'right' },
    cell: ({ row }) => formatMoney(row.original.total),
  },
  {
    accessorKey: 'deliveryCost',
    header: 'Delivery',
    meta: { align: 'right' },
    cell: ({ row }) =>
      row.original.deliveryCost > 0 ? formatMoney(row.original.deliveryCost) : <Empty />,
  },
  {
    accessorKey: 'debt',
    header: 'Debt',
    meta: { align: 'right' },
    cell: ({ row }) =>
      row.original.debt > 0 ? (
        <span className="text-danger font-medium">{formatMoney(row.original.debt)}</span>
      ) : (
        <Empty />
      ),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const status = SALE_STATUSES.find((s) => s.value === row.original.status)
      return <Badge tone={status?.tone ?? 'neutral'}>{status?.label ?? row.original.status}</Badge>
    },
  },
]

/** Dense by design; the least-used columns are off until someone asks. */
const HIDDEN_BY_DEFAULT = ['updatedAt', 'finishedAt', 'expiresAt', 'deliveryCost']

const statusOptions = [
  { value: null, label: 'All' },
  ...SALE_STATUSES.map((s) => ({ value: s.value, label: s.label })),
]

/**
 * One component behind every sales list — All, Open, Postponed, Deleted. They
 * are the same table over a different status filter, so they must not drift
 * into four hand-built screens.
 */
export function SalesListPage({
  title,
  description,
  lockedStatus,
}: {
  title: string
  description: string
  /** Set on the dedicated sub-pages, which are one status and hide the chips. */
  lockedStatus?: SaleStatus
}) {
  const navigate = useNavigate()
  const { can } = useSession()
  const { query, setQuery } = useListQuery()

  const status = lockedStatus ?? (query.status as SaleStatus | undefined) ?? undefined
  const from = query.from ? String(query.from) : undefined
  const to = query.to ? String(query.to) : undefined

  const filters = useMemo(() => ({ ...query, status, from, to }), [query, status, from, to])
  const { data, isLoading } = useSales(filters)
  const { data: summary, isLoading: summaryLoading } = useSalesSummary({
    search: query.search,
    status,
    from,
    to,
  })

  const showCreate = can('sales.orders.create')
  const isFiltered = Boolean(query.search || query.status || from)

  const range = {
    from: from ? new Date(from) : null,
    to: to ? new Date(to) : null,
  }

  const exportCsv = () => {
    const rows = data?.items ?? []
    if (!rows.length) return toast.error('Nothing to export with these filters')
    downloadCsv(
      `sales-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        'Number',
        'Created',
        'Client',
        'Location',
        'Seller',
        'Channel',
        'Payment',
        'Total',
        'Debt',
        'Status',
      ],
      rows.map((sale) => [
        sale.number,
        sale.createdAt.slice(0, 10),
        sale.clientName ?? 'Walk-in',
        sale.locationName,
        sale.sellerName,
        sale.channel,
        sale.paymentMethod,
        sale.total,
        sale.debt,
        sale.status,
      ]),
    )
    toast.success(`Exported ${rows.length} sales`)
  }

  return (
    <>
      <PageHeader
        title={title}
        description={description}
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={exportCsv}>
              <Download />
              Export
            </Button>
            {showCreate ? (
              <Button variant="primary" asChild>
                <Link to={paths.sales.newSale}>
                  <Plus />
                  New sale
                </Link>
              </Button>
            ) : null}
          </div>
        }
        below={
          <div className="flex flex-wrap items-center gap-2">
            {lockedStatus ? null : (
              <StatusChips
                options={statusOptions}
                value={(query.status as SaleStatus | null) ?? null}
                onChange={(next) => setQuery({ status: next })}
              />
            )}
            <DateRangePicker
              value={range}
              onChange={(next) =>
                setQuery({
                  from: next.from ? next.from.toISOString().slice(0, 10) : null,
                  to: next.to ? next.to.toISOString().slice(0, 10) : null,
                })
              }
              className="h-8"
              placeholder="Any date"
            />
          </div>
        }
      />

      <SalesSummaryStrip summary={summary} loading={summaryLoading} />

      <DataTable
        storageKey={`sales-${lockedStatus ?? 'all'}`}
        columns={columns}
        initialHidden={HIDDEN_BY_DEFAULT}
        data={data?.items ?? []}
        total={data?.total ?? 0}
        isLoading={isLoading}
        toolbar={
          <SearchInput
            value={String(query.search ?? '')}
            onChange={(search) => setQuery({ search })}
            placeholder="Search by number, client, location or seller…"
          />
        }
        pagination={{ page: Number(query.page ?? 1), pageSize: Number(query.pageSize ?? 25) }}
        onPaginationChange={({ page, pageSize }) => setQuery({ page, pageSize })}
        sorting={query.sort ? [{ id: String(query.sort), desc: query.order === 'desc' }] : []}
        onSortingChange={(sorting) => {
          const next = sorting[0]
          setQuery({ sort: next?.id ?? null, order: next ? (next.desc ? 'desc' : 'asc') : null })
        }}
        onRowClick={(sale) => navigate(paths.sales.orderDetail(sale.id))}
        emptyState={
          isFiltered ? (
            <EmptyState
              title="No sales match these filters"
              description="Try a different search term or period, or clear the filters to see everything."
              action={
                <Button
                  variant="secondary"
                  onClick={() => setQuery({ search: null, status: null, from: null, to: null })}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              title="No sales yet"
              description="Record the first sale taken at the desk, by phone or on delivery."
              action={
                showCreate ? (
                  <Button variant="primary" asChild>
                    <Link to={paths.sales.newSale}>
                      <Plus />
                      New sale
                    </Link>
                  </Button>
                ) : null
              }
            />
          )
        }
      />
    </>
  )
}

export default function AllSalesPage() {
  return <SalesListPage title="All sales" description="Every sale, across every location." />
}
