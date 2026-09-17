import { useMemo } from 'react'
import { useNavigate } from 'react-router'
import { Boxes, Clock, Globe, Wallet } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { DataTable } from '@/shared/components/DataTable'
import { ColumnFilterSearch } from '@/shared/components/ColumnFilterSearch'
import { ONLINE_SALE_FILTER_OVERRIDES } from '../model/onlineSaleFilterFields'
import { EmptyState } from '@/shared/components/EmptyState'
import { StatusChips } from '@/shared/components/StatusChips'
import { FilterSelect } from '@/shared/components/FilterSelect'
import { Badge } from '@/shared/ui/Badge'
import { Card } from '@/shared/ui/Card'
import { DateRangePicker } from '@/shared/ui/DateRangePicker'
import type { TableColumn } from '@/shared/components/table/features'
import { useListQuery } from '@/shared/hooks/useListQuery'
import { paths } from '@/shared/config/paths'
import { formatDateTime, formatMoney, formatNumber } from '@/shared/lib/format'
import { useDataStore } from '@/data/store'
import { useOnlineSaleCounts, useOnlineSales, useOnlineSalesSummary } from '../api/onlineSales'
import {
  DELIVERY_LABEL,
  ONLINE_SALE_STATUSES,
  PAYMENT_STATUS_META,
  PROVIDER_LABEL,
  onlineStatusMeta,
  orderTotal,
  unitsOf,
  type OnlineSale,
} from '../model/onlineSale'

/**
 * Online sales — orders placed in the e-commerce app.
 *
 * View only, on purpose, with no "+ Add" and no row actions: these are created
 * and moved along in the app. They are here because they take stock off our
 * shelves and because they are money in, and both of those have to be visible
 * next to everything else that does the same.
 */
export default function OnlineSalesListPage() {
  const navigate = useNavigate()
  const { query, setQuery } = useListQuery()
  const allOnlineSales = useDataStore((s) => s.onlineSales)
  const locations = useDataStore((s) => s.locations)
  const { data, isLoading } = useOnlineSales(query)
  const counts = useOnlineSaleCounts(query)
  const summary = useOnlineSalesSummary(query)

  const columns = useMemo<TableColumn<OnlineSale>[]>(
    () => [
      {
        accessorKey: 'number',
        header: 'Order',
        enableHiding: false,
        cell: ({ row }) => (
          <div>
            <p className="text-2xs text-fg font-mono">{row.original.number}</p>
            <p className="text-fg-subtle text-2xs">{formatDateTime(row.original.createdAt)}</p>
          </div>
        ),
      },
      {
        accessorKey: 'customerName',
        header: 'Customer',
        enableHiding: false,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="text-fg truncate">{row.original.customerName}</p>
            <p className="text-fg-subtle text-2xs tabular-nums">{row.original.customerPhone}</p>
          </div>
        ),
      },
      {
        id: 'items',
        header: 'Items',
        meta: { align: 'right' },
        cell: ({ row }) => (
          <span className="tabular-nums">{formatNumber(unitsOf(row.original))} pcs</span>
        ),
      },
      {
        id: 'total',
        header: 'Total',
        meta: { align: 'right' },
        enableHiding: false,
        cell: ({ row }) => (
          <span className="text-fg font-medium tabular-nums">
            {formatMoney(orderTotal(row.original))}
          </span>
        ),
      },
      {
        id: 'payment',
        header: 'Payment',
        enableHiding: false,
        cell: ({ row }) => {
          const meta = PAYMENT_STATUS_META[row.original.paymentStatus]
          return (
            <div>
              <Badge tone={meta.tone}>{meta.label}</Badge>
              <p className="text-fg-subtle text-2xs mt-0.5">
                {PROVIDER_LABEL[row.original.paymentProvider]}
              </p>
            </div>
          )
        },
      },
      {
        id: 'delivery',
        header: 'Delivery',
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="text-fg truncate">
              {DELIVERY_LABEL[row.original.deliveryMethod]}
              {row.original.express ? (
                <Badge tone="warning" className="ml-1.5">
                  Express
                </Badge>
              ) : null}
            </p>
            <p className="text-fg-subtle text-2xs truncate">
              {row.original.deliveryMethod === 'pickup'
                ? `At ${row.original.locationName}`
                : (row.original.pickupPoint ?? row.original.customerAddress ?? '—')}
            </p>
          </div>
        ),
      },
      {
        accessorKey: 'locationName',
        header: 'Picked from',
        cell: ({ row }) => <span className="text-fg-muted">{row.original.locationName}</span>,
      },
      {
        accessorKey: 'status',
        header: 'Status',
        enableHiding: false,
        cell: ({ row }) => {
          const meta = onlineStatusMeta(row.original.status)
          return <Badge tone={meta.tone}>{meta.label}</Badge>
        },
      },
    ],
    [],
  )

  const tiles = [
    {
      icon: Globe,
      label: 'Orders',
      value: formatNumber(summary.orders),
      meta: 'from the e-commerce app',
    },
    {
      icon: Wallet,
      label: 'Money received',
      value: formatMoney(summary.received),
      meta: 'paid online, less refunds',
    },
    {
      icon: Clock,
      label: 'Still open',
      value: formatNumber(summary.open),
      meta: `${formatNumber(summary.unpaid)} not paid yet`,
    },
    {
      icon: Boxes,
      label: 'Units taken from stock',
      value: formatNumber(summary.units),
      meta: 'cancelled orders give theirs back',
    },
  ]

  const filtered =
    query.search || query.f || query.status || query.location || query.payment || query.from

  return (
    <>
      <PageHeader
        title="Online sales"
        description="Orders placed in the e-commerce app. View only — they are managed in the app — but every one takes stock from the shop it is picked from."
        below={
          <div className="flex flex-wrap items-center gap-2">
            <StatusChips
              ariaLabel="Filter by status"
              options={[
                { value: null, label: 'All' },
                ...ONLINE_SALE_STATUSES.map((s) => ({ value: s.value, label: s.label })),
              ]}
              value={(query.status as string | null) ?? null}
              onChange={(next) => setQuery({ status: next, page: null })}
              counts={counts}
            />
            <FilterSelect
              aria-label="Filter by payment"
              label="Payment"
              allLabel="Any"
              value={(query.payment as string | null) ?? null}
              options={Object.entries(PAYMENT_STATUS_META).map(([value, meta]) => ({
                value,
                label: meta.label,
              }))}
              onChange={(next) => setQuery({ payment: next, page: null })}
            />
            <FilterSelect
              aria-label="Filter by location"
              label="From"
              allLabel="Every location"
              value={(query.location as string | null) ?? null}
              options={locations.map((l) => ({ value: l.id, label: l.name }))}
              onChange={(next) => setQuery({ location: next, page: null })}
            />
            <DateRangePicker
              value={{
                from: query.from ? new Date(String(query.from)) : null,
                to: query.to ? new Date(String(query.to)) : null,
              }}
              onChange={(range) =>
                setQuery({
                  from: range.from ? range.from.toISOString().slice(0, 10) : null,
                  to: range.to ? range.to.toISOString().slice(0, 10) : null,
                  page: null,
                })
              }
            />
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((tile) => (
          <Card key={tile.label} className="flex items-start gap-3 p-4">
            <span className="bg-surface-inset text-fg-muted mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full">
              <tile.icon className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-fg-muted text-sm">{tile.label}</p>
              <p className="text-fg mt-0.5 text-lg font-semibold">{tile.value}</p>
              <p className="text-fg-subtle text-2xs">{tile.meta}</p>
            </div>
          </Card>
        ))}
      </div>

      <DataTable
        storageKey="online-sales"
        columns={columns}
        data={data.items}
        total={data.total}
        isLoading={isLoading}
        toolbar={
          <ColumnFilterSearch
            columns={columns}
            rows={allOnlineSales}
            overrides={ONLINE_SALE_FILTER_OVERRIDES}
            query={query}
            setQuery={setQuery}
          />
        }
        pagination={{ page: Number(query.page ?? 1), pageSize: Number(query.pageSize ?? 25) }}
        onPaginationChange={({ page, pageSize }) => setQuery({ page, pageSize })}
        onRowClick={(row) => navigate(paths.sales.onlineDetail(row.id))}
        emptyState={
          filtered ? (
            <EmptyState title="No online orders match these filters" />
          ) : (
            <EmptyState
              icon={Globe}
              title="No online orders yet"
              description="Orders placed in the e-commerce app appear here as soon as they are placed."
            />
          )
        }
      />
    </>
  )
}
