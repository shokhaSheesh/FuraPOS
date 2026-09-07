import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router'
import { Plus, Truck, Clock, PackageOpen } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { DataTable } from '@/shared/components/DataTable'
import { SearchInput } from '@/shared/components/SearchInput'
import { EmptyState } from '@/shared/components/EmptyState'
import { StatusChips } from '@/shared/components/StatusChips'
import { FilterSelect } from '@/shared/components/FilterSelect'
import { Badge } from '@/shared/ui/Badge'
import { Card } from '@/shared/ui/Card'
import { Button } from '@/shared/ui/Button'
import { useListQuery } from '@/shared/hooks/useListQuery'
import { useSession } from '@/app/providers/SessionProvider'
import { paths } from '@/shared/config/paths'
import { formatDate, formatMoney, formatNumber } from '@/shared/lib/format'
import type { TableColumn } from '@/shared/components/table/features'
import { useDataStore } from '@/data/store'
import { USD_RATE } from '@/data/seed'
import { useOrderStatusCounts, useOrders, useOrdersSummary } from '../api/orders'
import {
  daysLate,
  deliveredRatio,
  orderStatusLabel,
  orderStatusTone,
  orderValue,
  orderedUnits,
  outstandingUnits,
  outstandingValue,
  receivedUnits,
  type PurchaseOrder,
} from '../model/order'

/**
 * What has been ordered and has not arrived.
 *
 * Late first, then still-open, then by date — because nobody opens an orders
 * screen to admire the completed ones. The column that matters is what is
 * *still coming*, not what was ordered.
 */
export default function OrdersListPage() {
  const navigate = useNavigate()
  const { can } = useSession()
  const { query, setQuery } = useListQuery()
  const suppliers = useDataStore((s) => s.suppliers)
  const locations = useDataStore((s) => s.locations)

  const scope = { search: query.search, supplier: query.supplier, location: query.location }
  const { data, isLoading } = useOrders(query)
  const { data: counts } = useOrderStatusCounts(scope)
  const summary = useOrdersSummary(scope)
  const canSeeCost = can('products.cost.view')

  const columns = useMemo<TableColumn<PurchaseOrder>[]>(
    () => [
      {
        accessorKey: 'number',
        header: 'Order',
        enableHiding: false,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="text-2xs font-mono">{row.original.number}</p>
            <p className="text-fg-subtle text-2xs">{formatDate(row.original.createdAt)}</p>
          </div>
        ),
      },
      {
        accessorKey: 'supplierName',
        header: 'Supplier',
        enableHiding: false,
        cell: ({ row }) => row.original.supplierName ?? <span className="text-fg-subtle">—</span>,
      },
      {
        accessorKey: 'locationName',
        header: 'Landing at',
      },
      {
        id: 'expected',
        header: 'Expected',
        enableHiding: false,
        cell: ({ row }) => {
          const late = daysLate(row.original)
          if (!row.original.expectedAt) return <span className="text-fg-subtle">Not promised</span>
          return (
            <div className="min-w-0">
              <p className={late ? 'text-danger font-medium' : 'text-fg'}>
                {formatDate(row.original.expectedAt)}
              </p>
              {late ? <p className="text-danger text-2xs">{formatNumber(late)} days late</p> : null}
            </div>
          )
        },
      },
      {
        id: 'delivered',
        header: 'Delivered',
        enableHiding: false,
        cell: ({ row }) => {
          const ratio = deliveredRatio(row.original)
          return (
            <div
              className="flex items-center gap-2"
              title={`${receivedUnits(row.original)} of ${orderedUnits(row.original)} units`}
            >
              <span className="bg-surface-inset h-1.5 w-16 shrink-0 overflow-hidden rounded-full">
                <span
                  className={`block h-full rounded-full ${ratio >= 1 ? 'bg-success' : 'bg-info'}`}
                  style={{ width: `${Math.round(ratio * 100)}%` }}
                />
              </span>
              <span className="text-fg-muted text-2xs tabular-nums">
                {formatNumber(receivedUnits(row.original))}/
                {formatNumber(orderedUnits(row.original))}
              </span>
            </div>
          )
        },
      },
      {
        id: 'outstanding',
        header: 'Still coming',
        meta: { align: 'right' },
        enableHiding: false,
        cell: ({ row }) => {
          const units = outstandingUnits(row.original)
          if (units === 0) return <span className="text-fg-subtle">—</span>
          return (
            <div>
              <p className="text-fg font-medium tabular-nums">{formatNumber(units)} units</p>
              {canSeeCost ? (
                <p className="text-fg-subtle text-2xs tabular-nums">
                  {formatMoney(Math.round(outstandingValue(row.original, USD_RATE)))}
                </p>
              ) : null}
            </div>
          )
        },
      },
      ...(canSeeCost
        ? [
            {
              id: 'value',
              header: 'Order value',
              meta: { align: 'right' as const },
              cell: ({ row }: { row: { original: PurchaseOrder } }) =>
                formatMoney(Math.round(orderValue(row.original, USD_RATE))),
            },
          ]
        : []),
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <Badge tone={orderStatusTone(row.original.status)}>
            {orderStatusLabel(row.original.status)}
          </Badge>
        ),
      },
      { accessorKey: 'createdBy', header: 'Raised by' },
      {
        accessorKey: 'comment',
        header: 'Note',
        cell: ({ row }) => row.original.comment ?? <span className="text-fg-subtle">—</span>,
      },
    ],
    [canSeeCost],
  )

  const tiles = [
    {
      icon: Truck,
      label: 'Still coming',
      value: formatNumber(summary.awaitingUnits),
      meta: canSeeCost
        ? `${formatMoney(Math.round(summary.openValue))} across ${formatNumber(summary.open)} open orders`
        : `${formatNumber(summary.open)} open orders`,
    },
    {
      icon: Clock,
      label: 'Late',
      value: formatNumber(summary.late),
      meta: canSeeCost
        ? `${formatMoney(Math.round(summary.lateValue))} promised and not here`
        : 'past the promised date',
      tone: summary.late > 0 ? ('danger' as const) : undefined,
    },
    {
      icon: PackageOpen,
      label: 'Open orders',
      value: formatNumber(summary.open),
      meta: 'sent, confirmed or part delivered',
    },
  ]

  return (
    <>
      <PageHeader
        title="Orders"
        description="What has been ordered from suppliers and has not arrived yet. Deliveries are booked against an order, which is how a goods receipt gets checked rather than just recorded."
        action={
          can('procurement.orders.create') ? (
            <Button variant="primary" asChild>
              <Link to={paths.procurement.newOrder}>
                <Plus />
                New order
              </Link>
            </Button>
          ) : null
        }
        below={
          <div className="flex flex-wrap items-center gap-2">
            <StatusChips
              ariaLabel="Which orders to show"
              options={[
                { value: null, label: 'All' },
                { value: 'open', label: 'Still open' },
                { value: 'late', label: 'Late' },
              ]}
              value={(query.lens as string | null) ?? null}
              onChange={(next) => setQuery({ lens: next, status: null, page: null })}
              counts={counts}
            />
            <FilterSelect
              aria-label="Filter by supplier"
              label="From"
              allLabel="Any supplier"
              value={(query.supplier as string | null) ?? null}
              options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
              onChange={(next) => setQuery({ supplier: next, page: null })}
            />
            <FilterSelect
              aria-label="Filter by location"
              label="Into"
              allLabel="Everywhere"
              value={(query.location as string | null) ?? null}
              options={locations.map((l) => ({ value: l.id, label: l.name }))}
              onChange={(next) => setQuery({ location: next, page: null })}
            />
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        {tiles.map((tile) => (
          <Card key={tile.label} className="flex items-start gap-3 p-4">
            <span className="bg-surface-inset text-fg-muted mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full">
              <tile.icon className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-fg-muted text-sm">{tile.label}</p>
              <p
                className={`mt-0.5 text-lg font-semibold ${
                  tile.tone === 'danger' ? 'text-danger' : 'text-fg'
                }`}
              >
                {tile.value}
              </p>
              <p className="text-fg-subtle text-2xs">{tile.meta}</p>
            </div>
          </Card>
        ))}
      </div>

      <DataTable
        storageKey="orders"
        columns={columns}
        initialHidden={['locationName', 'createdBy', 'comment']}
        data={data?.items ?? []}
        total={data?.total ?? 0}
        isLoading={isLoading}
        toolbar={
          <SearchInput
            value={String(query.search ?? '')}
            onChange={(search) => setQuery({ search })}
            placeholder="Search by number, supplier, SKU or product…"
          />
        }
        pagination={{ page: Number(query.page ?? 1), pageSize: Number(query.pageSize ?? 25) }}
        onPaginationChange={({ page, pageSize }) => setQuery({ page, pageSize })}
        onRowClick={(order) => navigate(paths.procurement.orderDetail(order.id))}
        emptyState={
          query.search || query.lens || query.supplier || query.location ? (
            <EmptyState title="No orders match these filters" />
          ) : (
            <EmptyState
              title="Nothing on order"
              description="An order records what you asked a supplier for, so a delivery can be checked against it instead of taken on trust."
              action={
                can('procurement.orders.create') ? (
                  <Button variant="primary" asChild>
                    <Link to={paths.procurement.newOrder}>
                      <Plus />
                      New order
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
