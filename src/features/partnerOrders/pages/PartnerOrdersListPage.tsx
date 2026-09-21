import { useMemo } from 'react'
import { useNavigate } from 'react-router'
import { PageHeader } from '@/shared/components/PageHeader'
import { DataTable } from '@/shared/components/DataTable'
import { ColumnFilterSearch } from '@/shared/components/ColumnFilterSearch'
import { PARTNER_ORDER_FILTER_OVERRIDES } from '../model/partnerOrderFilterFields'
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
import { t } from '@/shared/i18n'
import { RouteTabs } from '@/shared/components/RouteTabs'
import { SALES_TABS } from '@/shared/config/navigation'

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
  const allPartnerOrders = useDataStore((s) => s.partnerOrders)
  const clients = useDataStore((s) => s.clients)
  const canSeeMoney = can('sales.orders.view')

  const scope = { f: query.f, search: query.search, client: query.client }
  const { data, isLoading } = usePartnerOrders(query)
  const { data: counts } = usePartnerOrderStatusCounts(scope)

  const columns = useMemo<TableColumn<PartnerOrder>[]>(
    () => [
      {
        accessorKey: 'number',
        header: t('Number'),
        enableHiding: false,
        cell: ({ row }) => <span className="text-2xs font-mono">{row.original.number}</span>,
      },
      {
        accessorKey: 'placedAt',
        header: t('Placed'),
        cell: ({ row }) => formatDate(row.original.placedAt),
      },
      {
        accessorKey: 'clientName',
        header: t('From'),
        enableHiding: false,
      },
      {
        accessorKey: 'status',
        header: t('Status'),
        cell: ({ row }) => (
          <Badge tone={partnerStatusTone(row.original.status)}>
            {partnerStatusLabel(row.original.status)}
          </Badge>
        ),
      },
      {
        id: 'ordered',
        header: t('Ordered'),
        meta: { align: 'right' },
        cell: ({ row }) => formatNumber(orderedUnits(row.original)),
      },
      {
        id: 'shipped',
        header: t('Sent'),
        enableHiding: false,
        cell: ({ row }) => {
          const ratio = shippedRatio(row.original)
          return (
            <div
              className="flex items-center gap-2"
              title={t('{p0} of {p1} units have gone', {
                p0: formatNumber(shippedUnits(row.original)),
                p1: formatNumber(orderedUnits(row.original)),
              })}
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
        header: t('Still to send'),
        meta: { align: 'right' },
        cell: ({ row }) => {
          const left = outstandingUnits(row.original)
          if (row.original.status === 'cancelled') return <span className="text-fg-subtle">—</span>
          return left > 0 ? (
            <span className="text-warning font-medium">{formatNumber(left)}</span>
          ) : (
            <span className="text-success">{t('complete')}</span>
          )
        },
      },
      ...(canSeeMoney
        ? ([
            {
              id: 'value',
              header: t('Value'),
              meta: { align: 'right' as const },
              cell: ({ row }: { row: { original: PartnerOrder } }) =>
                formatMoney(Math.round(orderValue(row.original, USD_RATE))),
            },
          ] as TableColumn<PartnerOrder>[])
        : []),
      {
        accessorKey: 'wantedBy',
        header: t('Wanted by'),
        cell: ({ row }) =>
          row.original.wantedBy ? (
            formatDate(row.original.wantedBy)
          ) : (
            <span className="text-fg-subtle">{t('Not said')}</span>
          ),
      },
      {
        accessorKey: 'comment',
        header: t('Note'),
        cell: ({ row }) => row.original.comment ?? <span className="text-fg-subtle">—</span>,
      },
    ],
    [canSeeMoney],
  )

  return (
    <>
      <PageHeader
        title={t('Sales')}
        tabs={<RouteTabs tabs={SALES_TABS} />}
        description={t(
          'What other businesses have ordered from us. They place it, we accept it and send it — in as many loads as it takes — and they tell us what arrived.',
        )}
        below={
          <div className="flex flex-wrap items-center gap-2">
            <StatusChips
              options={[
                { value: null, label: t('All') },
                { value: 'new', label: t('New') },
                { value: 'confirmed', label: t('Confirmed') },
                { value: 'partial', label: t('Part shipped') },
                { value: 'shipped', label: t('Shipped') },
                { value: 'cancelled', label: t('Cancelled') },
              ]}
              value={(query.status as string | null) ?? null}
              onChange={(next) => setQuery({ status: next, page: null })}
              counts={counts}
            />
            <FilterSelect
              aria-label={t('Filter by business')}
              label={t('From')}
              allLabel={t('Anyone')}
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
          <ColumnFilterSearch
            columns={columns}
            rows={allPartnerOrders}
            overrides={PARTNER_ORDER_FILTER_OVERRIDES}
            query={query}
            setQuery={setQuery}
          />
        }
        pagination={{ page: Number(query.page ?? 1), pageSize: Number(query.pageSize ?? 25) }}
        onPaginationChange={({ page, pageSize }) => setQuery({ page, pageSize })}
        onRowClick={(order) => navigate(paths.sales.partnerOrderDetail(order.id))}
        emptyState={
          query.search || query.f || query.status || query.client ? (
            <EmptyState title={t('No orders match these filters')} />
          ) : (
            <EmptyState
              title={t('Nobody has ordered from you yet')}
              description={t(
                'When a business on the platform places an order with you, it arrives here.',
              )}
            />
          )
        }
      />
    </>
  )
}
