import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Plus, Pause, Pencil, Play, Tag, Trash2, CalendarClock } from 'lucide-react'
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
import { formatDate, formatMoney, formatNumber } from '@/shared/lib/format'
import type { TableColumn } from '@/shared/components/table/features'
import {
  usePromotionActions,
  usePromotionCounts,
  usePromotions,
  type PromotionRow,
} from '../api/promotions'
import {
  describe,
  describeScope,
  promotionStatusLabel,
  promotionStatusTone,
} from '../model/promotion'

/**
 * Promotions.
 *
 * What is on offer, when it stops, and what it takes off. Running first, then
 * scheduled, then over — the order somebody cares about them in.
 */
export default function PromotionsPage() {
  const navigate = useNavigate()
  const { can } = useSession()
  const { query, setQuery } = useListQuery()
  const { data, isLoading } = usePromotions({ search: query.search, status: query.status })
  const { data: counts } = usePromotionCounts()
  const actions = usePromotionActions()
  const [deleting, setDeleting] = useState<PromotionRow | null>(null)

  const running = data.items.filter((promotion) => promotion.status === 'running')
  const endingSoon = running.filter(
    (promotion) => promotion.daysLeft !== null && promotion.daysLeft <= 7,
  )

  const columns = useMemo<TableColumn<PromotionRow>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Promotion',
        enableHiding: false,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="text-fg truncate font-medium">{row.original.name}</p>
            <p className="text-fg-subtle text-2xs truncate">{describe(row.original)}</p>
          </div>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        enableHiding: false,
        cell: ({ row }) => (
          <Badge tone={promotionStatusTone(row.original.status)}>
            {promotionStatusLabel(row.original.status)}
          </Badge>
        ),
      },
      {
        id: 'runs',
        header: 'Runs',
        enableHiding: false,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="text-fg">
              {formatDate(row.original.startsAt)}
              {row.original.endsAt ? ` – ${formatDate(row.original.endsAt)}` : ' onward'}
            </p>
            {row.original.daysLeft !== null ? (
              <p
                className={`text-2xs ${row.original.daysLeft <= 7 ? 'text-warning' : 'text-fg-subtle'}`}
              >
                {row.original.daysLeft === 0
                  ? 'ends today'
                  : `${formatNumber(row.original.daysLeft)} days left`}
              </p>
            ) : null}
          </div>
        ),
      },
      {
        id: 'applies',
        header: 'Applies to',
        enableHiding: false,
        cell: ({ row }) =>
          row.original.scope === 'all' ? (
            <span className="text-fg-muted">Everything</span>
          ) : (
            <div className="flex flex-wrap gap-1" title={row.original.scopeNames.join(', ')}>
              {row.original.scopeNames.slice(0, 2).map((name) => (
                <Badge key={name} tone="neutral">
                  {name}
                </Badge>
              ))}
              {row.original.scopeNames.length > 2 ? (
                <span className="text-fg-subtle text-2xs">
                  +{row.original.scopeNames.length - 2}
                </span>
              ) : null}
              {row.original.scopeNames.length === 0 ? (
                <span className="text-fg-subtle">{describeScope(row.original)}</span>
              ) : null}
            </div>
          ),
      },
      {
        id: 'minimum',
        header: 'Minimum sale',
        meta: { align: 'right' },
        cell: ({ row }) =>
          row.original.minimumSale === null ? (
            <span className="text-fg-subtle">Any</span>
          ) : (
            <span className="tabular-nums">{formatMoney(row.original.minimumSale)}</span>
          ),
      },
      { accessorKey: 'createdBy', header: 'Set up by' },
      {
        id: 'actions',
        header: '',
        enableHiding: false,
        meta: { align: 'right' },
        cell: ({ row }) => (
          <RowActions
            actions={[
              {
                label: row.original.paused ? 'Resume' : 'Pause',
                icon: row.original.paused ? Play : Pause,
                hidden: !can('marketing.promotions.edit') || row.original.status === 'finished',
                onSelect: () => {
                  actions.setPaused(row.original.id, !row.original.paused)
                  toast.success(
                    row.original.paused
                      ? `${row.original.name} is running again`
                      : `${row.original.name} paused — it stops applying to new sales`,
                  )
                },
              },
              {
                label: 'Edit',
                icon: Pencil,
                hidden: !can('marketing.promotions.edit'),
                onSelect: () => navigate(paths.marketing.editPromotion(row.original.id)),
              },
              {
                label: 'Delete',
                icon: Trash2,
                destructive: true,
                hidden: !can('marketing.promotions.delete'),
                onSelect: () => setDeleting(row.original),
              },
            ]}
          />
        ),
      },
    ],
    [can, navigate, actions],
  )

  const tiles = [
    {
      icon: Tag,
      label: 'Running now',
      value: formatNumber(running.length),
      meta: running.length ? running.map((p) => p.name).join(', ') : 'nothing on offer',
    },
    {
      icon: CalendarClock,
      label: 'Ending this week',
      value: formatNumber(endingSoon.length),
      meta: 'decide whether to extend them',
      tone: endingSoon.length > 0 ? ('warning' as const) : undefined,
    },
    {
      icon: CalendarClock,
      label: 'Scheduled',
      value: formatNumber(counts.scheduled ?? 0),
      meta: 'set up, not started yet',
    },
  ]

  return (
    <>
      <PageHeader
        title="Promotions"
        description="Discounts recorded as a decision rather than typed into a sale. A running promotion is applied for the seller on the New sale screen, so nobody has to remember this week's offer or work the percentage out by hand."
        action={
          can('marketing.promotions.create') ? (
            <Button variant="primary" asChild>
              <Link to={paths.marketing.newPromotion}>
                <Plus />
                Add promotion
              </Link>
            </Button>
          ) : null
        }
        below={
          <StatusChips
            ariaLabel="Which promotions to show"
            options={[
              { value: null, label: 'All' },
              { value: 'running', label: 'Running' },
              { value: 'scheduled', label: 'Scheduled' },
              { value: 'paused', label: 'Paused' },
              { value: 'finished', label: 'Finished' },
            ]}
            value={(query.status as string | null) ?? null}
            onChange={(status) => setQuery({ status, page: null })}
            counts={counts}
          />
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
                  tile.tone === 'warning' ? 'text-warning' : 'text-fg'
                }`}
              >
                {tile.value}
              </p>
              <p className="text-fg-subtle text-2xs truncate">{tile.meta}</p>
            </div>
          </Card>
        ))}
      </div>

      <DataTable
        storageKey="promotions"
        columns={columns}
        initialHidden={['createdBy']}
        data={data.items}
        total={data.total}
        isLoading={isLoading}
        toolbar={
          <SearchInput
            value={String(query.search ?? '')}
            onChange={(search) => setQuery({ search })}
            placeholder="Search promotions…"
          />
        }
        pagination={{ page: Number(query.page ?? 1), pageSize: Number(query.pageSize ?? 25) }}
        onPaginationChange={({ page, pageSize }) => setQuery({ page, pageSize })}
        onRowClick={(promotion) => navigate(paths.marketing.editPromotion(promotion.id))}
        emptyState={
          query.search || query.status ? (
            <EmptyState title="No promotions match these filters" />
          ) : (
            <EmptyState
              icon={Tag}
              title="No promotions yet"
              description="A promotion turns a discount into a decision with an end date, so its cost can be measured afterwards instead of disappearing into general discounting."
              action={
                can('marketing.promotions.create') ? (
                  <Button variant="primary" asChild>
                    <Link to={paths.marketing.newPromotion}>
                      <Plus />
                      Add promotion
                    </Link>
                  </Button>
                ) : null
              }
            />
          )
        }
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        title={`Delete ${deleting?.name}?`}
        body="Sales already made at this price are not affected — they keep the discount they were given. Only future sales change."
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (deleting) actions.remove(deleting.id)
          setDeleting(null)
          toast.success('Promotion deleted')
        }}
      />
    </>
  )
}
