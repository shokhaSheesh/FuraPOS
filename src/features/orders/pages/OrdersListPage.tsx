import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { Download, Plus } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { DataTable } from '@/shared/components/DataTable'
import { ColumnFilterSearch } from '@/shared/components/ColumnFilterSearch'
import { ORDER_FILTER_OVERRIDES } from '../model/orderFilterFields'
import { EmptyState } from '@/shared/components/EmptyState'
import { RowActions } from '@/shared/components/RowActions'
import { toast } from '@/shared/ui/toast'
import { downloadCsv } from '@/shared/lib/csv'
import { StatusChips } from '@/shared/components/StatusChips'
import { FilterSelect } from '@/shared/components/FilterSelect'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { useListQuery } from '@/shared/hooks/useListQuery'
import { useSession } from '@/app/providers/SessionProvider'
import { paths } from '@/shared/config/paths'
import { formatDate, formatMoney, formatNumber } from '@/shared/lib/format'
import type { TableColumn } from '@/shared/components/table/features'
import { useDataStore } from '@/data/store'
import { USD_RATE } from '@/data/seed'
import { useCreateOrder, useOrderStatusCounts, useOrders } from '../api/orders'
import { NewOrderDialog } from '../components/NewOrderDialog'
import {
  daysLate,
  deliveredRatio,
  orderSource,
  orderStatusLabel,
  orderStatusTone,
  orderValue,
  orderedUnits,
  outstandingUnits,
  outstandingValue,
  receivedUnits,
  type PurchaseOrder,
} from '../model/order'
import { t } from '@/shared/i18n'

/**
 * What has been ordered and has not arrived.
 *
 * Late first, then still-open, then by date — because nobody opens an orders
 * screen to admire the completed ones. The column that matters is what is
 * *still coming*, not what was ordered.
 */
export default function OrdersListPage() {
  const navigate = useNavigate()
  const createOrder = useCreateOrder()
  const [creating, setCreating] = useState(false)
  const { can } = useSession()
  const { query, setQuery } = useListQuery()
  const allOrders = useDataStore((s) => s.orders)
  const suppliers = useDataStore((s) => s.suppliers)
  const locations = useDataStore((s) => s.locations)

  const scope = {
    f: query.f,
    search: query.search,
    supplier: query.supplier,
    location: query.location,
  }
  const { data, isLoading } = useOrders(query)
  const { data: counts } = useOrderStatusCounts(scope)
  const canSeeCost = can('products.cost.view')

  /** The order's lines as a spreadsheet — what was ordered, what came, what is still coming. */
  const downloadOrder = (order: PurchaseOrder) => {
    downloadCsv(
      `${order.number}.csv`,
      [
        'SKU',
        'Product',
        'Unit',
        'Ordered',
        'Delivered',
        'Still coming',
        ...(canSeeCost ? ['Agreed price', 'Currency'] : []),
      ],
      order.lines.map((line) => [
        line.sku,
        line.name,
        line.unit,
        line.orderedQuantity,
        line.receivedQuantity,
        Math.max(0, line.orderedQuantity - line.receivedQuantity),
        ...(canSeeCost ? [line.unitCost, line.costCurrency] : []),
      ]),
    )
    toast.success(t('{number} downloaded', { number: order.number }))
  }

  const columns = useMemo<TableColumn<PurchaseOrder>[]>(
    () => [
      {
        accessorKey: 'number',
        header: t('Order'),
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
        header: t('From'),
        enableHiding: false,
        // A market run has no supplier; it says where it was bought instead.
        cell: ({ row }) => orderSource(row.original),
      },
      {
        accessorKey: 'locationName',
        header: t('Landing at'),
      },
      {
        id: 'expected',
        header: t('Expected'),
        enableHiding: false,
        cell: ({ row }) => {
          const late = daysLate(row.original)
          if (!row.original.expectedAt)
            return <span className="text-fg-subtle">{t('Not promised')}</span>
          return (
            <div className="min-w-0">
              <p className={late ? 'text-danger font-medium' : 'text-fg'}>
                {formatDate(row.original.expectedAt)}
              </p>
              {late ? (
                <p className="text-danger text-2xs">
                  {formatNumber(late)} {t('days late')}
                </p>
              ) : null}
            </div>
          )
        },
      },
      {
        id: 'delivered',
        header: t('Delivered'),
        enableHiding: false,
        cell: ({ row }) => {
          const ratio = deliveredRatio(row.original)
          return (
            <div
              className="flex items-center gap-2"
              title={t('{p0} of {p1} units', {
                p0: receivedUnits(row.original),
                p1: orderedUnits(row.original),
              })}
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
        header: t('Still coming'),
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
              header: t('Order value'),
              meta: { align: 'right' as const },
              cell: ({ row }: { row: { original: PurchaseOrder } }) =>
                formatMoney(Math.round(orderValue(row.original, USD_RATE))),
            },
          ]
        : []),
      {
        accessorKey: 'status',
        header: t('Status'),
        cell: ({ row }) => (
          <Badge tone={orderStatusTone(row.original.status)}>
            {orderStatusLabel(row.original.status)}
          </Badge>
        ),
      },
      { accessorKey: 'createdBy', header: t('Raised by') },
      {
        accessorKey: 'comment',
        header: t('Note'),
        cell: ({ row }) => row.original.comment ?? <span className="text-fg-subtle">—</span>,
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
                onSelect: () => downloadOrder(row.original),
              },
            ]}
          />
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canSeeCost],
  )

  return (
    <>
      <PageHeader
        title={t('Orders')}
        description={t(
          'What has been ordered from suppliers and has not arrived yet. Deliveries are booked against an order, which is how a goods receipt gets checked rather than just recorded.',
        )}
        action={
          can('procurement.orders.create') ? (
            <Button variant="primary" onClick={() => setCreating(true)}>
              <Plus />
              {t('Add')}
            </Button>
          ) : null
        }
        below={
          <div className="flex flex-wrap items-center gap-2">
            <StatusChips
              ariaLabel={t('Which orders to show')}
              options={[
                { value: null, label: t('All') },
                { value: 'open', label: t('Still open') },
                { value: 'late', label: t('Late') },
              ]}
              value={(query.lens as string | null) ?? null}
              onChange={(next) => setQuery({ lens: next, status: null, page: null })}
              counts={counts}
            />
            <FilterSelect
              aria-label={t('Filter by supplier')}
              label={t('From')}
              allLabel={t('Any supplier')}
              value={(query.supplier as string | null) ?? null}
              options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
              onChange={(next) => setQuery({ supplier: next, page: null })}
            />
            <FilterSelect
              aria-label={t('Filter by location')}
              label={t('Into')}
              allLabel={t('Everywhere')}
              value={(query.location as string | null) ?? null}
              options={locations.map((l) => ({ value: l.id, label: l.name }))}
              onChange={(next) => setQuery({ location: next, page: null })}
            />
          </div>
        }
      />

      <DataTable
        reorderableColumns
        storageKey="orders"
        columns={columns}
        initialHidden={['locationName', 'createdBy', 'comment']}
        data={data?.items ?? []}
        total={data?.total ?? 0}
        isLoading={isLoading}
        toolbar={
          <ColumnFilterSearch
            columns={columns}
            rows={allOrders}
            overrides={ORDER_FILTER_OVERRIDES}
            query={query}
            setQuery={setQuery}
          />
        }
        pagination={{ page: Number(query.page ?? 1), pageSize: Number(query.pageSize ?? 25) }}
        onPaginationChange={({ page, pageSize }) => setQuery({ page, pageSize })}
        onRowClick={(order) => navigate(paths.procurement.orderDetail(order.id))}
        emptyState={
          query.search || query.f || query.lens || query.supplier || query.location ? (
            <EmptyState title={t('No orders match these filters')} />
          ) : (
            <EmptyState
              title={t('Nothing on order')}
              description={t(
                'An order records what you asked a supplier for, so a delivery can be checked against it instead of taken on trust.',
              )}
              action={
                can('procurement.orders.create') ? (
                  <Button variant="primary" onClick={() => setCreating(true)}>
                    <Plus />
                    {t('Add')}
                  </Button>
                ) : null
              }
            />
          )
        }
      />
      <NewOrderDialog
        open={creating}
        onOpenChange={setCreating}
        onCreate={(draft) =>
          createOrder.mutate(
            {
              kind: draft.kind,
              supplierId: draft.supplierId ?? '',
              boughtFrom: draft.boughtFrom,
              locationId: draft.locationId,
              expectedAt: draft.expectedAt,
              comment: draft.comment,
              lines: [],
              status: 'draft',
            },
            {
              onSuccess: (created) => {
                setCreating(false)
                navigate(paths.procurement.orderDetail(created.id))
              },
            },
          )
        }
      />
    </>
  )
}
