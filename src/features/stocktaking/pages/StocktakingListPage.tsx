import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { DataTable } from '@/shared/components/DataTable'
import { ColumnFilterSearch } from '@/shared/components/ColumnFilterSearch'
import { STOCKTAKE_FILTER_OVERRIDES } from '../model/stocktakeFilterFields'
import { EmptyState } from '@/shared/components/EmptyState'
import { StatusChips } from '@/shared/components/StatusChips'
import { FilterSelect } from '@/shared/components/FilterSelect'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { RowActions } from '@/shared/components/RowActions'
import { Ban } from 'lucide-react'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { toast } from '@/shared/ui/toast'
import { useListQuery } from '@/shared/hooks/useListQuery'
import { useSession } from '@/app/providers/SessionProvider'
import { paths } from '@/shared/config/paths'
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatNumber,
  formatPercent,
} from '@/shared/lib/format'
import type { TableColumn } from '@/shared/components/table/features'
import { useDataStore } from '@/data/store'
import { USD_RATE } from '@/data/seed'
import { useStocktakeStatusCounts, useStocktakes, useStocktakeActions } from '../api/stocktakes'
import {
  accuracy,
  discrepancies,
  scopeDetail,
  scopeType,
  netCostValue,
  progress,
  shortUnits,
  stocktakeStatusLabel,
  stocktakeStatusTone,
  surplusUnits,
  type Stocktake,
} from '../model/stocktake'
import { t } from '@/shared/i18n'

/**
 * Counts, past and in progress.
 *
 * The headline is accuracy rather than loss, because that is what a stocktake
 * is for. A warehouse that finds a small discrepancy every month is working; a
 * warehouse whose counts agree eighty per cent of the time cannot trust any
 * number on any other screen, however small the money looks.
 */
export default function StocktakingListPage() {
  const navigate = useNavigate()
  const { can } = useSession()
  const { query, setQuery } = useListQuery()
  const allStocktakes = useDataStore((s) => s.stocktakes)
  const locations = useDataStore((s) => s.locations)

  const scope = { f: query.f, search: query.search, location: query.location }
  const { data, isLoading } = useStocktakes(query)
  const { data: counts } = useStocktakeStatusCounts(scope)
  const canSeeCost = can('products.cost.view')

  const [pendingCancel, setPendingCancel] = useState<Stocktake | null>(null)
  const pendingActions = useStocktakeActions(pendingCancel?.id ?? '')

  const columns = useMemo<TableColumn<Stocktake>[]>(
    () => [
      {
        accessorKey: 'number',
        header: t('Number'),
        cell: ({ row }) => <span className="text-2xs font-mono">{row.original.number}</span>,
        enableHiding: false,
      },
      {
        accessorKey: 'createdAt',
        header: t('Started'),
        cell: ({ row }) => formatDate(row.original.createdAt),
      },
      {
        accessorKey: 'locationName',
        header: t('Location'),
        enableHiding: false,
      },
      /*
        OX carries the scope as its own column (`Тип инвентаризации`) rather
        than as an empty cell, and it is right to: "Whole location" says a
        decision was made where a blank only says a field was left alone.
      */
      {
        id: 'scopeType',
        header: t('Counted by'),
        cell: ({ row }) => {
          const detail = scopeDetail(row.original)
          return (
            <div className="min-w-0">
              <p className="text-fg">{scopeType(row.original)}</p>
              {detail ? <p className="text-fg-subtle text-2xs">{detail}</p> : null}
            </div>
          )
        },
      },
      {
        accessorKey: 'appliedAt',
        header: t('Finished'),
        cell: ({ row }) =>
          row.original.appliedAt ? (
            formatDateTime(row.original.appliedAt)
          ) : (
            <span className="text-fg-subtle">—</span>
          ),
      },
      {
        id: 'progress',
        header: t('Counted'),
        enableHiding: false,
        cell: ({ row }) => {
          const { done, total, ratio } = progress(row.original)
          return (
            <div
              className="flex items-center gap-2"
              title={t('{done} of {total} lines', { done: done, total: total })}
            >
              <span className="bg-surface-inset h-1.5 w-16 shrink-0 overflow-hidden rounded-full">
                <span
                  className={`block h-full rounded-full ${ratio >= 1 ? 'bg-success' : 'bg-info'}`}
                  style={{ width: `${Math.round(ratio * 100)}%` }}
                />
              </span>
              <span className="text-fg-muted text-2xs tabular-nums">
                {formatNumber(done)}/{formatNumber(total)}
              </span>
            </div>
          )
        },
      },
      {
        id: 'accuracy',
        header: t('Agreed'),
        meta: { align: 'right' },
        cell: ({ row }) => {
          const { done } = progress(row.original)
          if (done === 0) return <span className="text-fg-subtle">—</span>
          const value = accuracy(row.original)
          return (
            <span className={value < 0.95 ? 'text-warning font-medium' : undefined}>
              {formatPercent(value)}
            </span>
          )
        },
      },
      {
        id: 'differs',
        header: t('Differs'),
        meta: { align: 'right' },
        cell: ({ row }) => formatNumber(discrepancies(row.original).length),
      },
      {
        id: 'missing',
        header: t('Missing'),
        meta: { align: 'right' },
        cell: ({ row }) => {
          const short = shortUnits(row.original)
          return short > 0 ? (
            <span className="text-danger font-medium">−{formatNumber(short)}</span>
          ) : (
            <span className="text-fg-subtle">—</span>
          )
        },
      },
      {
        id: 'found',
        header: t('Found'),
        meta: { align: 'right' },
        cell: ({ row }) => {
          const surplus = surplusUnits(row.original)
          return surplus > 0 ? (
            <span className="text-success font-medium">+{formatNumber(surplus)}</span>
          ) : (
            <span className="text-fg-subtle">—</span>
          )
        },
      },
      ...(canSeeCost
        ? [
            {
              id: 'value',
              header: t('Value at cost'),
              meta: { align: 'right' as const },
              cell: ({ row }: { row: { original: Stocktake } }) => {
                const value = netCostValue(row.original, USD_RATE)
                if (value === 0) return <span className="text-fg-subtle">—</span>
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
        header: t('Status'),
        cell: ({ row }) => (
          <Badge tone={stocktakeStatusTone(row.original.status)}>
            {stocktakeStatusLabel(row.original.status)}
          </Badge>
        ),
      },
      {
        accessorKey: 'createdBy',
        header: t('Started by'),
      },
      {
        accessorKey: 'comment',
        header: t('Comment'),
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
                label: t('Abandon count'),
                icon: Ban,
                destructive: true,
                hidden: row.original.status !== 'counting' || !can('products.stocktaking.delete'),
                onSelect: () => setPendingCancel(row.original),
              },
            ]}
          />
        ),
      },
    ],
    [can, canSeeCost],
  )

  return (
    <>
      <PageHeader
        title={t('Stocktaking')}
        description={t(
          'Someone counts what is really on the shelves, and the app compares it with what the system believes. The gap is stock you have lost without noticing.',
        )}
        action={
          can('products.stocktaking.create') ? (
            <Button variant="primary" asChild>
              <Link to={paths.products.newStocktake}>
                <Plus />
                {t('Start a count')}
              </Link>
            </Button>
          ) : null
        }
        below={
          <div className="flex flex-wrap items-center gap-2">
            <StatusChips
              options={[
                { value: null, label: t('All') },
                { value: 'counting', label: t('Counting') },
                { value: 'applied', label: t('Applied') },
                { value: 'cancelled', label: t('Abandoned') },
              ]}
              value={(query.status as string | null) ?? null}
              onChange={(next) => setQuery({ status: next, page: null })}
              counts={counts}
            />
            <FilterSelect
              aria-label={t('Filter by location')}
              label={t('At')}
              allLabel={t('All locations')}
              value={(query.location as string | null) ?? null}
              options={locations.map((item) => ({ value: item.id, label: item.name }))}
              onChange={(next) => setQuery({ location: next, page: null })}
            />
          </div>
        }
      />

      <DataTable
        reorderableColumns
        storageKey="stocktakes"
        columns={columns}
        initialHidden={['createdBy', 'comment', 'found', 'appliedAt']}
        data={data?.items ?? []}
        total={data?.total ?? 0}
        isLoading={isLoading}
        toolbar={
          <ColumnFilterSearch
            columns={columns}
            rows={allStocktakes}
            overrides={STOCKTAKE_FILTER_OVERRIDES}
            query={query}
            setQuery={setQuery}
          />
        }
        pagination={{ page: Number(query.page ?? 1), pageSize: Number(query.pageSize ?? 25) }}
        onPaginationChange={({ page, pageSize }) => setQuery({ page, pageSize })}
        onRowClick={(stocktake) => navigate(paths.products.stocktakeDetail(stocktake.id))}
        emptyState={
          query.search || query.f || query.status || query.location ? (
            <EmptyState title={t('No counts match these filters')} />
          ) : (
            <EmptyState
              title={t('Nothing has been counted')}
              description={t(
                "The system's numbers drift — things get broken, miscounted or taken without anyone recording it. Counting the shelves is the only way to find out by how much.",
              )}
              action={
                can('products.stocktaking.create') ? (
                  <Button variant="primary" asChild>
                    <Link to={paths.products.newStocktake}>
                      <Plus />
                      {t('Start a count')}
                    </Link>
                  </Button>
                ) : null
              }
            />
          )
        }
      />

      <ConfirmDialog
        open={pendingCancel !== null}
        onOpenChange={(open) => !open && setPendingCancel(null)}
        title={t('Abandon this count?')}
        confirmLabel={t('Abandon')}
        body={
          pendingCancel
            ? `Everything counted so far on ${pendingCancel.number} is discarded and no stock changes.`
            : null
        }
        onConfirm={() =>
          pendingActions.cancel({
            onSuccess: () => {
              toast.success(t('{number} abandoned', { number: pendingCancel?.number }))
              setPendingCancel(null)
            },
            onError: (message) => toast.error(message),
          })
        }
      />
    </>
  )
}
