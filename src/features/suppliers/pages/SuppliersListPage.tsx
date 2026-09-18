import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { DataTable } from '@/shared/components/DataTable'
import { ColumnFilterSearch } from '@/shared/components/ColumnFilterSearch'
import { SUPPLIER_FILTER_OVERRIDES } from '../model/supplierFilterFields'
import { EmptyState } from '@/shared/components/EmptyState'
import { StatusChips } from '@/shared/components/StatusChips'
import { FilterSelect } from '@/shared/components/FilterSelect'
import { Badge } from '@/shared/ui/Badge'
import { Card } from '@/shared/ui/Card'
import { Button } from '@/shared/ui/Button'
import { useListQuery } from '@/shared/hooks/useListQuery'
import { useSession } from '@/app/providers/SessionProvider'
import { paths } from '@/shared/config/paths'
import { formatDate, formatMoney, formatNumber, formatPercent } from '@/shared/lib/format'
import type { TableColumn } from '@/shared/components/table/features'
import { useDataStore } from '@/data/store'
import {
  useSupplierLensCounts,
  useSuppliers,
  useSuppliersSummary,
  type SupplierRow,
} from '../api/suppliers'
import {
  daysOverdue,
  isDormant,
  portalState,
  portalStateLabel,
  portalStateTone,
} from '../model/supplier'
import { t } from '@/shared/i18n'

/**
 * Who we buy from — and, mostly, what that relationship is costing.
 *
 * OX's version is the most substantial screen in the product and it is right
 * about why: a supplier list is not a contact book. Every column here is money
 * or movement. The name is how you find the row; the debt is why you opened it.
 */
/** Every supplier, unfiltered — the search panel reads its pick-lists from these. */
const EVERY_ROW = { page: 1, pageSize: 100_000 }

export default function SuppliersListPage() {
  const navigate = useNavigate()
  const { can } = useSession()
  const { query, setQuery } = useListQuery()
  const { data: everySupplier } = useSuppliers(EVERY_ROW)
  const suppliers = useDataStore((s) => s.suppliers)
  const roles = useDataStore((s) => s.roles)
  const roleName = (id: string | null) => roles.find((role) => role.id === id)?.name ?? null

  const scope = { f: query.f, search: query.search, zone: query.zone }
  const { data, isLoading } = useSuppliers(query)
  const { data: counts } = useSupplierLensCounts(scope)
  const summary = useSuppliersSummary(scope)
  const canSeeCost = can('products.cost.view')
  const canSeePortal = can('products.supplierPortal.view')

  const zones = useMemo(
    () => [...new Set(suppliers.map((s) => s.zone).filter(Boolean))] as string[],
    [suppliers],
  )

  const columns = useMemo<TableColumn<SupplierRow>[]>(
    () => [
      {
        id: 'name',
        header: t('Supplier'),
        enableHiding: false,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="text-fg font-medium">{row.original.supplier.name}</p>
            {row.original.supplier.contactName ? (
              <p className="text-fg-subtle text-2xs">{row.original.supplier.contactName}</p>
            ) : null}
          </div>
        ),
      },
      {
        id: 'debt',
        header: t('We owe'),
        meta: { align: 'right' },
        enableHiding: false,
        cell: ({ row }) => {
          const { supplier } = row.original
          if (supplier.debt <= 0) return <Badge tone="success">{t('Nothing owed')}</Badge>
          const overdue = daysOverdue(supplier)
          return (
            <div>
              <p className="text-danger font-medium tabular-nums">{formatMoney(supplier.debt)}</p>
              {/* Overdue only means something once terms were agreed. */}
              {overdue ? (
                <p className="text-danger text-2xs">
                  {formatNumber(overdue)} {t('days past terms')}
                </p>
              ) : null}
            </div>
          )
        },
      },
      {
        id: 'lastPayment',
        header: t('Last paid'),
        cell: ({ row }) =>
          row.original.supplier.lastPaymentAt ? (
            formatDate(row.original.supplier.lastPaymentAt)
          ) : (
            <span className="text-fg-subtle">{t('Never')}</span>
          ),
      },
      {
        id: 'sold',
        header: t('Sold on'),
        enableHiding: false,
        cell: ({ row }) => {
          const { soldRatio, purchased } = row.original.stats
          if (purchased === 0) return <span className="text-fg-subtle">—</span>
          return (
            <div className="flex items-center gap-2">
              <span className="bg-surface-inset h-1.5 w-16 shrink-0 overflow-hidden rounded-full">
                <span
                  className={`block h-full rounded-full ${soldRatio >= 1 ? 'bg-success' : 'bg-info'}`}
                  style={{ width: `${Math.min(100, Math.round(soldRatio * 100))}%` }}
                />
              </span>
              <span className="text-fg-muted text-2xs tabular-nums">
                {formatPercent(soldRatio)}
              </span>
            </div>
          )
        },
      },
      {
        id: 'onHand',
        header: t('Still on the shelf'),
        meta: { align: 'right' },
        cell: ({ row }) => {
          const { onHandUnits, onHandValue } = row.original.stats
          if (onHandUnits === 0) return <span className="text-fg-subtle">—</span>
          return (
            <div>
              <p className="text-fg tabular-nums">{formatNumber(onHandUnits)} units</p>
              {canSeeCost ? (
                <p className="text-fg-subtle text-2xs tabular-nums">{formatMoney(onHandValue)}</p>
              ) : null}
            </div>
          )
        },
      },
      ...(canSeeCost
        ? [
            {
              id: 'purchased',
              header: t('Bought from them'),
              meta: { align: 'right' as const },
              cell: ({ row }: { row: { original: SupplierRow } }) =>
                row.original.stats.purchased === 0 ? (
                  <span className="text-fg-subtle">—</span>
                ) : (
                  formatMoney(row.original.stats.purchased)
                ),
            },
          ]
        : []),
      {
        id: 'products',
        header: t('Products'),
        meta: { align: 'right' },
        cell: ({ row }) => formatNumber(row.original.stats.products),
      },
      {
        id: 'zone',
        header: t('Zone'),
        cell: ({ row }) => row.original.supplier.zone ?? <span className="text-fg-subtle">—</span>,
      },
      ...(canSeePortal
        ? [
            {
              id: 'portal',
              header: t('Portal login'),
              cell: ({ row }: { row: { original: SupplierRow } }) => {
                const state = portalState(row.original.supplier)
                return (
                  <div className="min-w-0">
                    <Badge tone={portalStateTone(state)}>{portalStateLabel(state)}</Badge>
                    {/* The login underneath when there is one — a supplier with
                        no account at all has nothing to show but the status. */}
                    {row.original.supplier.username ? (
                      <p className="text-fg-subtle text-2xs mt-0.5 truncate">
                        <span className="font-mono">{row.original.supplier.username}</span>
                        {roleName(row.original.supplier.roleId)
                          ? ` · ${roleName(row.original.supplier.roleId)}`
                          : ''}
                      </p>
                    ) : null}
                  </div>
                )
              },
            },
          ]
        : []),
      {
        id: 'activity',
        header: t('Activity'),
        cell: ({ row }) => {
          const { stats } = row.original
          if (isDormant(stats)) {
            return <Badge tone="warning">{t('Nothing in 90 days')}</Badge>
          }
          return (
            <span className="text-fg-muted text-2xs">
              {stats.lastReceiptAt ? `Last delivery ${formatDate(stats.lastReceiptAt)}` : '—'}
            </span>
          )
        },
      },
      {
        accessorKey: 'phone',
        header: t('Phone'),
        cell: ({ row }) => row.original.supplier.phone ?? <span className="text-fg-subtle">—</span>,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canSeeCost, canSeePortal, roles],
  )

  return (
    <>
      <PageHeader
        title={t('Suppliers')}
        description={t(
          'Who we buy from, what we still owe them, and how much of what they sent us has actually sold.',
        )}
        action={
          can('products.suppliers.create') ? (
            <Button variant="primary" asChild>
              <Link to={paths.products.newSupplier}>
                <Plus />
                {t('Add supplier')}
              </Link>
            </Button>
          ) : null
        }
        below={
          <div className="flex flex-wrap items-center gap-2">
            <StatusChips
              ariaLabel={t('Which suppliers to show')}
              options={[
                { value: null, label: t('All') },
                { value: 'owed', label: t('We owe them') },
                { value: 'dormant', label: t('Gone quiet') },
              ]}
              value={(query.lens as string | null) ?? null}
              onChange={(next) => setQuery({ lens: next, page: null })}
              counts={counts}
            />
            {zones.length > 1 ? (
              <FilterSelect
                aria-label={t('Filter by zone')}
                label={t('In')}
                allLabel={t('Every zone')}
                value={(query.zone as string | null) ?? null}
                options={zones.map((zone) => ({ value: zone, label: zone }))}
                onChange={(next) => setQuery({ zone: next, page: null })}
              />
            ) : null}
          </div>
        }
      />

      {/* OX shows this as a "Без поставщика" row in the table; it reads better
          as a note, because it is a data-quality problem rather than a supplier. */}
      {canSeeCost && summary.unattributedValue > 0 ? (
        <Card>
          <div className="text-fg-muted p-4 text-sm">
            {formatMoney(summary.unattributedValue)}{' '}
            {t(
              'of stock came in on receipts with no supplier recorded, so none of the figures above can account for it.',
            )}
          </div>
        </Card>
      ) : null}

      <DataTable
        reorderableColumns
        storageKey="suppliers"
        columns={columns}
        initialHidden={['phone', 'products']}
        data={data?.items ?? []}
        total={data?.total ?? 0}
        isLoading={isLoading}
        toolbar={
          <ColumnFilterSearch
            columns={columns}
            rows={everySupplier?.items ?? []}
            overrides={SUPPLIER_FILTER_OVERRIDES}
            query={query}
            setQuery={setQuery}
          />
        }
        pagination={{ page: Number(query.page ?? 1), pageSize: Number(query.pageSize ?? 25) }}
        onPaginationChange={({ page, pageSize }) => setQuery({ page, pageSize })}
        onRowClick={(row) => navigate(paths.products.supplierDetail(row.supplier.id))}
        emptyState={
          query.search || query.f || query.lens || query.zone ? (
            <EmptyState title={t('No suppliers match these filters')} />
          ) : (
            <EmptyState
              title={t('No suppliers yet')}
              description={t(
                'A supplier is who a goods receipt came from. Adding them is what lets the app answer what you owe and what you bought.',
              )}
              action={
                can('products.suppliers.create') ? (
                  <Button variant="primary" asChild>
                    <Link to={paths.products.newSupplier}>
                      <Plus />
                      {t('Add supplier')}
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
