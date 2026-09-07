import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Plus, ClipboardList, Target, TrendingDown } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { DataTable } from '@/shared/components/DataTable'
import { SearchInput } from '@/shared/components/SearchInput'
import { EmptyState } from '@/shared/components/EmptyState'
import { StatusChips } from '@/shared/components/StatusChips'
import { FilterSelect } from '@/shared/components/FilterSelect'
import { Badge } from '@/shared/ui/Badge'
import { Card } from '@/shared/ui/Card'
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
import {
  useStocktakeStatusCounts,
  useStocktakeSummary,
  useStocktakes,
  useStocktakeActions,
} from '../api/stocktakes'
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
  const locations = useDataStore((s) => s.locations)

  const scope = { search: query.search, location: query.location }
  const { data, isLoading } = useStocktakes(query)
  const { data: counts } = useStocktakeStatusCounts(scope)
  const summary = useStocktakeSummary(scope)
  const canSeeCost = can('products.cost.view')

  const [pendingCancel, setPendingCancel] = useState<Stocktake | null>(null)
  const pendingActions = useStocktakeActions(pendingCancel?.id ?? '')

  const columns = useMemo<TableColumn<Stocktake>[]>(
    () => [
      {
        accessorKey: 'number',
        header: 'Number',
        cell: ({ row }) => <span className="text-2xs font-mono">{row.original.number}</span>,
        enableHiding: false,
      },
      {
        accessorKey: 'createdAt',
        header: 'Started',
        cell: ({ row }) => formatDate(row.original.createdAt),
      },
      {
        accessorKey: 'locationName',
        header: 'Location',
        enableHiding: false,
      },
      /*
        OX carries the scope as its own column (`Тип инвентаризации`) rather
        than as an empty cell, and it is right to: "Whole location" says a
        decision was made where a blank only says a field was left alone.
      */
      {
        id: 'scopeType',
        header: 'Counted by',
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
        header: 'Finished',
        cell: ({ row }) =>
          row.original.appliedAt ? (
            formatDateTime(row.original.appliedAt)
          ) : (
            <span className="text-fg-subtle">—</span>
          ),
      },
      {
        id: 'progress',
        header: 'Counted',
        enableHiding: false,
        cell: ({ row }) => {
          const { done, total, ratio } = progress(row.original)
          return (
            <div className="flex items-center gap-2" title={`${done} of ${total} lines`}>
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
        header: 'Agreed',
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
        header: 'Differs',
        meta: { align: 'right' },
        cell: ({ row }) => formatNumber(discrepancies(row.original).length),
      },
      {
        id: 'missing',
        header: 'Missing',
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
        header: 'Found',
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
              header: 'Value at cost',
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
        header: 'Status',
        cell: ({ row }) => (
          <Badge tone={stocktakeStatusTone(row.original.status)}>
            {stocktakeStatusLabel(row.original.status)}
          </Badge>
        ),
      },
      {
        accessorKey: 'createdBy',
        header: 'Started by',
      },
      {
        accessorKey: 'comment',
        header: 'Comment',
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
                label: 'Abandon count',
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

  const tiles = [
    {
      icon: ClipboardList,
      label: 'Counting now',
      value: formatNumber(summary.open),
      meta: summary.open === 1 ? 'count in progress' : 'counts in progress',
    },
    {
      icon: Target,
      label: 'System was right',
      value: formatPercent(summary.accuracy),
      meta: 'of everything counted so far',
    },
    {
      icon: TrendingDown,
      label: 'Missing on the shelf',
      value: formatNumber(summary.shortUnits),
      meta: canSeeCost
        ? `${summary.netValue < 0 ? '−' : ''}${formatMoney(Math.abs(summary.netValue))} net at cost`
        : `${formatNumber(summary.surplusUnits)} found`,
      tone: 'danger' as const,
    },
  ]

  return (
    <>
      <PageHeader
        title="Stocktaking"
        description="Someone counts what is really on the shelves, and the app compares it with what the system believes. The gap is stock you have lost without noticing."
        action={
          can('products.stocktaking.create') ? (
            <Button variant="primary" asChild>
              <Link to={paths.products.newStocktake}>
                <Plus />
                Start a count
              </Link>
            </Button>
          ) : null
        }
        below={
          <div className="flex flex-wrap items-center gap-2">
            <StatusChips
              options={[
                { value: null, label: 'All' },
                { value: 'counting', label: 'Counting' },
                { value: 'applied', label: 'Applied' },
                { value: 'cancelled', label: 'Abandoned' },
              ]}
              value={(query.status as string | null) ?? null}
              onChange={(next) => setQuery({ status: next, page: null })}
              counts={counts}
            />
            <FilterSelect
              aria-label="Filter by location"
              label="At"
              allLabel="All locations"
              value={(query.location as string | null) ?? null}
              options={locations.map((item) => ({ value: item.id, label: item.name }))}
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
                  tile.tone === 'danger' && summary.shortUnits > 0 ? 'text-danger' : 'text-fg'
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
        storageKey="stocktakes"
        columns={columns}
        initialHidden={['createdBy', 'comment', 'found', 'appliedAt']}
        data={data?.items ?? []}
        total={data?.total ?? 0}
        isLoading={isLoading}
        toolbar={
          <SearchInput
            value={String(query.search ?? '')}
            onChange={(search) => setQuery({ search })}
            placeholder="Search by number, location or scope…"
          />
        }
        pagination={{ page: Number(query.page ?? 1), pageSize: Number(query.pageSize ?? 25) }}
        onPaginationChange={({ page, pageSize }) => setQuery({ page, pageSize })}
        sorting={query.sort ? [{ id: String(query.sort), desc: query.order === 'desc' }] : []}
        onSortingChange={(sorting) => {
          const [first] = sorting
          setQuery({ sort: first?.id ?? null, order: first?.desc ? 'desc' : 'asc' })
        }}
        onRowClick={(stocktake) => navigate(paths.products.stocktakeDetail(stocktake.id))}
        emptyState={
          query.search || query.status || query.location ? (
            <EmptyState title="No counts match these filters" />
          ) : (
            <EmptyState
              title="Nothing has been counted"
              description="The system's numbers drift — things get broken, miscounted or taken without anyone recording it. Counting the shelves is the only way to find out by how much."
              action={
                can('products.stocktaking.create') ? (
                  <Button variant="primary" asChild>
                    <Link to={paths.products.newStocktake}>
                      <Plus />
                      Start a count
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
        title="Abandon this count?"
        confirmLabel="Abandon"
        body={
          pendingCancel
            ? `Everything counted so far on ${pendingCancel.number} is discarded and no stock changes.`
            : null
        }
        onConfirm={() =>
          pendingActions.cancel({
            onSuccess: () => {
              toast.success(`${pendingCancel?.number} abandoned`)
              setPendingCancel(null)
            },
            onError: (message) => toast.error(message),
          })
        }
      />
    </>
  )
}
