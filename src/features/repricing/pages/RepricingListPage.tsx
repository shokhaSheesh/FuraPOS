import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Plus, TrendingUp, FileEdit, Percent, Undo2 } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { DataTable } from '@/shared/components/DataTable'
import { SearchInput } from '@/shared/components/SearchInput'
import { EmptyState } from '@/shared/components/EmptyState'
import { StatusChips } from '@/shared/components/StatusChips'
import { RowActions } from '@/shared/components/RowActions'
import { Badge } from '@/shared/ui/Badge'
import { Card } from '@/shared/ui/Card'
import { Button } from '@/shared/ui/Button'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { toast } from '@/shared/ui/toast'
import { useListQuery } from '@/shared/hooks/useListQuery'
import { useSession } from '@/app/providers/SessionProvider'
import { paths } from '@/shared/config/paths'
import { formatDate, formatNumber, formatPercent } from '@/shared/lib/format'
import type { TableColumn } from '@/shared/components/table/features'
import {
  useRepricingActions,
  useRepricingStatusCounts,
  useRepricingSummary,
  useRepricings,
} from '../api/repricings'
import {
  averageChange,
  belowCost,
  changedLines,
  loweredCount,
  raisedCount,
  repricingStatusLabel,
  repricingStatusTone,
  type Repricing,
} from '../model/repricing'
import { ruleSentence } from './RepricingDetailPage'

/**
 * Price changes, past and pending.
 *
 * A price change is kept as a document so two questions can be answered later:
 * when did this go up, and who decided. Everything here is reversible, which is
 * what makes a bulk change safe to attempt at all.
 */
export default function RepricingListPage() {
  const navigate = useNavigate()
  const { can } = useSession()
  const { query, setQuery } = useListQuery()

  const scope = { search: query.search, direction: query.direction }
  const { data, isLoading } = useRepricings(query)
  const { data: counts } = useRepricingStatusCounts(scope)
  const summary = useRepricingSummary(scope)
  const canSeeCost = can('products.cost.view')

  const [pendingRevert, setPendingRevert] = useState<Repricing | null>(null)
  const pendingActions = useRepricingActions(pendingRevert?.id ?? '')

  const columns = useMemo<TableColumn<Repricing>[]>(
    () => [
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
        id: 'rule',
        header: 'Rule',
        enableHiding: false,
        cell: ({ row }) => <span className="font-medium">{ruleSentence(row.original)}</span>,
      },
      {
        id: 'scope',
        header: 'Applied to',
        cell: ({ row }) => {
          const parts = [row.original.categoryName, row.original.brandName].filter(Boolean)
          return parts.length ? (
            parts.join(' · ')
          ) : (
            <span className="text-fg-subtle">Everything</span>
          )
        },
      },
      {
        id: 'products',
        header: 'Products',
        meta: { align: 'right' },
        cell: ({ row }) => formatNumber(changedLines(row.original).length),
      },
      {
        id: 'direction',
        header: 'Up / down',
        meta: { align: 'right' },
        cell: ({ row }) => (
          <span className="tabular-nums">
            <span className="text-success">+{formatNumber(raisedCount(row.original))}</span>
            <span className="text-fg-subtle"> / </span>
            <span className="text-danger">−{formatNumber(loweredCount(row.original))}</span>
          </span>
        ),
      },
      {
        id: 'average',
        header: 'Average move',
        meta: { align: 'right' },
        cell: ({ row }) => {
          const change = averageChange(row.original)
          if (change === 0) return <span className="text-fg-subtle">—</span>
          return (
            <span className={change < 0 ? 'text-danger font-medium' : 'text-success font-medium'}>
              {change > 0 ? '+' : ''}
              {formatPercent(change)}
            </span>
          )
        },
      },
      ...(canSeeCost
        ? [
            {
              id: 'risky',
              header: 'Below cost',
              meta: { align: 'right' as const },
              cell: ({ row }: { row: { original: Repricing } }) => {
                const risky = belowCost(row.original).length
                return risky > 0 ? (
                  <span className="text-danger font-medium">{formatNumber(risky)}</span>
                ) : (
                  <span className="text-fg-subtle">—</span>
                )
              },
            },
          ]
        : []),
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <Badge tone={repricingStatusTone(row.original.status)}>
            {repricingStatusLabel(row.original.status)}
          </Badge>
        ),
      },
      { accessorKey: 'createdBy', header: 'Created by' },
      {
        accessorKey: 'comment',
        header: 'Reason',
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
                label: 'Put prices back',
                icon: Undo2,
                destructive: true,
                hidden: row.original.status !== 'applied' || !can('products.repricing.delete'),
                onSelect: () => setPendingRevert(row.original),
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
      icon: FileEdit,
      label: 'Waiting to be applied',
      value: formatNumber(summary.drafts),
      meta: 'prepared but not live yet',
    },
    {
      icon: TrendingUp,
      label: 'Average move',
      value: `${summary.averageChange > 0 ? '+' : ''}${formatPercent(summary.averageChange)}`,
      meta: `${formatNumber(summary.appliedLines)} prices changed`,
    },
    {
      icon: Percent,
      label: 'Margin',
      value: canSeeCost
        ? `${formatPercent(summary.marginBefore)} → ${formatPercent(summary.marginAfter)}`
        : '—',
      meta: 'before and after, across applied changes',
    },
  ]

  return (
    <>
      <PageHeader
        title="Repricing"
        description="Change what many products sell for at once — when the exchange rate moves, or a supplier puts prices up. Every change is recorded and can be put back."
        action={
          can('products.repricing.create') ? (
            <Button variant="primary" asChild>
              <Link to={paths.products.newRepricing}>
                <Plus />
                New price change
              </Link>
            </Button>
          ) : null
        }
        below={
          <div className="flex flex-wrap items-center gap-2">
            <StatusChips
              options={[
                { value: null, label: 'All' },
                { value: 'draft', label: 'Draft' },
                { value: 'applied', label: 'Applied' },
                { value: 'reverted', label: 'Reverted' },
              ]}
              value={(query.status as string | null) ?? null}
              onChange={(next) => setQuery({ status: next, page: null })}
              counts={counts}
            />
            <StatusChips
              ariaLabel="Filter by direction"
              options={[
                { value: null, label: 'Either way' },
                { value: 'up', label: 'Prices up' },
                { value: 'down', label: 'Prices down' },
              ]}
              value={(query.direction as string | null) ?? null}
              onChange={(next) => setQuery({ direction: next, page: null })}
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
              <p className="text-fg mt-0.5 text-lg font-semibold">{tile.value}</p>
              <p className="text-fg-subtle text-2xs">{tile.meta}</p>
            </div>
          </Card>
        ))}
      </div>

      <DataTable
        storageKey="repricings"
        columns={columns}
        initialHidden={['createdBy', 'comment']}
        data={data?.items ?? []}
        total={data?.total ?? 0}
        isLoading={isLoading}
        toolbar={
          <SearchInput
            value={String(query.search ?? '')}
            onChange={(search) => setQuery({ search })}
            placeholder="Search by number, category, brand or reason…"
          />
        }
        pagination={{ page: Number(query.page ?? 1), pageSize: Number(query.pageSize ?? 25) }}
        onPaginationChange={({ page, pageSize }) => setQuery({ page, pageSize })}
        sorting={query.sort ? [{ id: String(query.sort), desc: query.order === 'desc' }] : []}
        onSortingChange={(sorting) => {
          const [first] = sorting
          setQuery({ sort: first?.id ?? null, order: first?.desc ? 'desc' : 'asc' })
        }}
        onRowClick={(repricing) => navigate(paths.products.repricingDetail(repricing.id))}
        emptyState={
          query.search || query.status || query.direction ? (
            <EmptyState title="No price changes match these filters" />
          ) : (
            <EmptyState
              title="No prices have been changed"
              description="Editing prices one product at a time leaves no record of when they moved or why. This does it in bulk, and keeps the answer."
              action={
                can('products.repricing.create') ? (
                  <Button variant="primary" asChild>
                    <Link to={paths.products.newRepricing}>
                      <Plus />
                      New price change
                    </Link>
                  </Button>
                ) : null
              }
            />
          )
        }
      />

      <ConfirmDialog
        open={pendingRevert !== null}
        onOpenChange={(open) => !open && setPendingRevert(null)}
        title="Put these prices back?"
        confirmLabel="Put back"
        body={
          pendingRevert
            ? `Every product ${pendingRevert.number} changed goes back to exactly the price it had before.`
            : null
        }
        onConfirm={() =>
          pendingActions.revert({
            onSuccess: () => {
              toast.success(`${pendingRevert?.number} reverted`)
              setPendingRevert(null)
            },
            onError: (message) => toast.error(message),
          })
        }
      />
    </>
  )
}
