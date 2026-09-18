import { useMemo } from 'react'
import { useNavigate } from 'react-router'
import { Globe } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { DataTable } from '@/shared/components/DataTable'
import { ColumnFilterSearch } from '@/shared/components/ColumnFilterSearch'
import { ONLINE_SALE_FILTER_OVERRIDES } from '../model/onlineSaleFilterFields'
import { EmptyState } from '@/shared/components/EmptyState'
import { StatusChips } from '@/shared/components/StatusChips'
import { FilterSelect } from '@/shared/components/FilterSelect'
import { Badge } from '@/shared/ui/Badge'
import { DateRangePicker } from '@/shared/ui/DateRangePicker'
import type { TableColumn } from '@/shared/components/table/features'
import { useListQuery } from '@/shared/hooks/useListQuery'
import { paths } from '@/shared/config/paths'
import { formatDateTime, formatMoney, formatNumber } from '@/shared/lib/format'
import { useDataStore } from '@/data/store'
import { useOnlineSaleCounts, useOnlineSales } from '../api/onlineSales'
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
import { t } from '@/shared/i18n'

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

  const columns = useMemo<TableColumn<OnlineSale>[]>(
    () => [
      {
        accessorKey: 'number',
        header: t('Order'),
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
        header: t('Customer'),
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
        header: t('Items'),
        meta: { align: 'right' },
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatNumber(unitsOf(row.original))} {t('pcs')}
          </span>
        ),
      },
      {
        id: 'total',
        header: t('Total'),
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
        header: t('Payment'),
        enableHiding: false,
        cell: ({ row }) => {
          const meta = PAYMENT_STATUS_META[row.original.paymentStatus]
          return (
            <div>
              <Badge tone={meta.tone}>{t(meta.label)}</Badge>
              <p className="text-fg-subtle text-2xs mt-0.5">
                {t(PROVIDER_LABEL[row.original.paymentProvider])}
              </p>
            </div>
          )
        },
      },
      {
        id: 'delivery',
        header: t('Delivery'),
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="text-fg truncate">
              {t(DELIVERY_LABEL[row.original.deliveryMethod])}
              {row.original.express ? (
                <Badge tone="warning" className="ml-1.5">
                  {t('Express')}
                </Badge>
              ) : null}
            </p>
            <p className="text-fg-subtle text-2xs truncate">
              {row.original.deliveryMethod === 'pickup'
                ? t('At {locationName}', { locationName: row.original.locationName })
                : (row.original.pickupPoint ?? row.original.customerAddress ?? '—')}
            </p>
          </div>
        ),
      },
      {
        accessorKey: 'locationName',
        header: t('Picked from'),
        cell: ({ row }) => <span className="text-fg-muted">{row.original.locationName}</span>,
      },
      {
        accessorKey: 'status',
        header: t('Status'),
        enableHiding: false,
        cell: ({ row }) => {
          const meta = onlineStatusMeta(row.original.status)
          return <Badge tone={meta.tone}>{t(meta.label)}</Badge>
        },
      },
    ],
    [],
  )

  const filtered =
    query.search || query.f || query.status || query.location || query.payment || query.from

  return (
    <>
      <PageHeader
        title={t('Online sales')}
        description={t(
          'Orders placed in the e-commerce app. View only — they are managed in the app — but every one takes stock from the shop it is picked from.',
        )}
        below={
          <div className="flex flex-wrap items-center gap-2">
            <StatusChips
              ariaLabel={t('Filter by status')}
              options={[
                { value: null, label: t('All') },
                ...ONLINE_SALE_STATUSES.map((s) => ({ value: s.value, label: t(s.label) })),
              ]}
              value={(query.status as string | null) ?? null}
              onChange={(next) => setQuery({ status: next, page: null })}
              counts={counts}
            />
            <FilterSelect
              aria-label={t('Filter by payment')}
              label={t('Payment')}
              allLabel={t('Any')}
              value={(query.payment as string | null) ?? null}
              options={Object.entries(PAYMENT_STATUS_META).map(([value, meta]) => ({
                value,
                label: t(meta.label),
              }))}
              onChange={(next) => setQuery({ payment: next, page: null })}
            />
            <FilterSelect
              aria-label={t('Filter by location')}
              label={t('From')}
              allLabel={t('Every location')}
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
            <EmptyState title={t('No online orders match these filters')} />
          ) : (
            <EmptyState
              icon={Globe}
              title={t('No online orders yet')}
              description={t(
                'Orders placed in the e-commerce app appear here as soon as they are placed.',
              )}
            />
          )
        }
      />
    </>
  )
}
