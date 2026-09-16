import { useMemo } from 'react'
import { useNavigate } from 'react-router'
import { PageHeader } from '@/shared/components/PageHeader'
import { DataTable } from '@/shared/components/DataTable'
import { SearchInput } from '@/shared/components/SearchInput'
import { EmptyState } from '@/shared/components/EmptyState'
import { StatusChips } from '@/shared/components/StatusChips'
import { FilterSelect } from '@/shared/components/FilterSelect'
import { Badge } from '@/shared/ui/Badge'
import type { TableColumn } from '@/shared/components/table/features'
import { useListQuery } from '@/shared/hooks/useListQuery'
import { useSession } from '@/app/providers/SessionProvider'
import { paths } from '@/shared/config/paths'
import { formatDate, formatMoney, formatNumber, formatPercent } from '@/shared/lib/format'
import { useDataStore } from '@/data/store'
import { USD_RATE } from '@/data/seed'
import {
  orderedUnits,
  orderValue,
  outstandingUnits,
  partnerStatusLabel,
  partnerStatusTone,
  shippedRatio,
  shippedUnits,
  type PartnerOrder,
} from '../model/partnerOrder'
import { usePartnerOrderStatusCounts, usePartnerOrders } from '../api/partnerOrders'

/**
 * Orders other businesses have placed with us.
 *
 * The queue a person works down: what arrived and has not been answered, what
 * has been accepted and not yet sent, what has gone and not yet been counted.
 * Sorted newest first, because an order placed this morning is the one
 * somebody is waiting on.
 */
export default function PartnerOrdersListPage() {
  const navigate = useNavigate()
  const { can } = useSession()
  const { query, setQuery } = useListQuery()
  const clients = useDataStore((s) => s.clients)
  const canSeeMoney = can('sales.orders.view')

  const scope = { search: query.search, client: query.client }
  const { data, isLoading } = usePartnerOrders(query)
  const { data: counts } = usePartnerOrderStatusCounts(scope)

  const columns = useMemo<TableColumn<PartnerOrder>[]>(
    () => [
      {
        accessorKey: 'number',
        header: 'Number',
        enableHiding: false,
        cell: ({ row }) => <span className="text-2xs font-mono">{row.original.number}</span>,
      },
      {
        accessorKey: 'placedAt',
        header: 'Placed',
        cell: ({ row }) => formatDate(row.original.placedAt),
      },
      {
        accessorKey: 'clientName',
        header: 'From',
        enableHiding: false,
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <Badge tone={partnerStatusTone(row.original.status)}>
            {partnerStatusLabel(row.original.status)}
          </Badge>
        ),
      },
      {
        id: 'ordered',
        header: 'Ordered',
        meta: { align: 'right' },
        cell: ({ row }) => formatNumber(orderedUnits(row.original)),
      },
      {
        id: 'shipped',
        header: 'Sent',
        enableHiding: false,
        cell: ({ row }) => {
          const ratio = shippedRatio(row.original)
          return (
            <div
              className="flex items-center gap-2"
              title={`${formatNumber(shippedUnits(row.original))} of ${formatNumber(
                orderedUnits(row.original),
              )} units have gone`}
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
        id: 'outstanding',
        header: 'Still to send',
        meta: { align: 'right' },
        cell: ({ row }) => {
          const left = outstandingUnits(row.original)
          if (row.original.status === 'cancelled') return <span className="text-fg-subtle">—</span>
          return left > 0 ? (
            <span className="text-warning font-medium">{formatNumber(left)}</span>
          ) : (
            <span className="text-success">complete</span>
          )
        },
      },
      ...(canSeeMoney
        ? ([
            {
              id: 'value',
              header: 'Value',
              meta: { align: 'right' as const },
              cell: ({ row }: { row: { original: PartnerOrder } }) =>
                formatMoney(Math.round(orderValue(row.original, USD_RATE))),
            },
          ] as TableColumn<PartnerOrder>[])
        : []),
      {
        accessorKey: 'wantedBy',
        header: 'Wanted by',
        cell: ({ row }) =>
          row.original.wantedBy ? (
            formatDate(row.original.wantedBy)
          ) : (
            <span className="text-fg-subtle">Not said</span>
          ),
      },
      {
        accessorKey: 'comment',
        header: 'Note',
        cell: ({ row }) => row.original.comment ?? <span className="text-fg-subtle">—</span>,
      },
    ],
    [canSeeMoney],
  )

  return (
    <>
      <PageHeader
        title="Partner orders"
        description="What other businesses have ordered from us. They place it, we accept it and send it — in as many loads as it takes — and they tell us what arrived."
        below={
          <div className="flex flex-wrap items-center gap-2">
            <StatusChips
              options={[
                { value: null, label: 'All' },
                { value: 'new', label: 'New' },
                { value: 'confirmed', label: 'Confirmed' },
                { value: 'partial', label: 'Part shipped' },
                { value: 'shipped', label: 'Shipped' },
                { value: 'cancelled', label: 'Cancelled' },
              ]}
              value={(query.status as string | null) ?? null}
              onChange={(next) => setQuery({ status: next, page: null })}
              counts={counts}
            />
            <FilterSelect
              aria-label="Filter by business"
              label="From"
              allLabel="Anyone"
              value={(query.client as string | null) ?? null}
              options={clients
                .filter((client) => client.type === 'business')
                .map((client) => ({ value: client.id, label: client.name }))}
              onChange={(next) => setQuery({ client: next, page: null })}
            />
          </div>
        }
      />

      <DataTable
        storageKey="partner-orders"
        columns={columns}
        initialHidden={['wantedBy', 'comment']}
        data={data?.items ?? []}
        total={data?.total ?? 0}
        isLoading={isLoading}
        toolbar={
          <SearchInput
            value={String(query.search ?? '')}
            onChange={(search) => setQuery({ search })}
            placeholder="Search by number, business or product…"
          />
        }
        pagination={{ page: Number(query.page ?? 1), pageSize: Number(query.pageSize ?? 25) }}
        onPaginationChange={({ page, pageSize }) => setQuery({ page, pageSize })}
        onRowClick={(order) => navigate(paths.sales.partnerOrderDetail(order.id))}
        emptyState={
          query.search || query.status || query.client ? (
            <EmptyState title="No orders match these filters" />
          ) : (
            <EmptyState
              title="Nobody has ordered from you yet"
              description="When a business on the platform places an order with you, it arrives here."
            />
          )
        }
      />
    </>
  )
}
