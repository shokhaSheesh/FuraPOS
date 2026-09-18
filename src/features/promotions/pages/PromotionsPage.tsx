import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Plus, Pause, Pencil, Play, Tag, Trash2 } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { DataTable } from '@/shared/components/DataTable'
import { ColumnFilterSearch } from '@/shared/components/ColumnFilterSearch'
import { PROMOTION_FILTER_OVERRIDES } from '../model/promotionFilterFields'
import { EmptyState } from '@/shared/components/EmptyState'
import { StatusChips } from '@/shared/components/StatusChips'
import { RowActions } from '@/shared/components/RowActions'
import { Badge } from '@/shared/ui/Badge'
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
  describeAudience,
  describeScope,
  promotionStatusLabel,
  promotionStatusTone,
} from '../model/promotion'
import { t } from '@/shared/i18n'

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
  const { data: everyPromotion } = usePromotions()
  const { data, isLoading } = usePromotions({
    search: query.search,
    status: query.status,
    f: query.f,
  })
  const { data: counts } = usePromotionCounts()
  const actions = usePromotionActions()
  const [deleting, setDeleting] = useState<PromotionRow | null>(null)

  const columns = useMemo<TableColumn<PromotionRow>[]>(
    () => [
      {
        accessorKey: 'name',
        header: t('Promotion'),
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
        header: t('Status'),
        enableHiding: false,
        cell: ({ row }) => (
          <Badge tone={promotionStatusTone(row.original.status)}>
            {promotionStatusLabel(row.original.status)}
          </Badge>
        ),
      },
      {
        id: 'runs',
        header: t('Runs'),
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
                  ? t('ends today')
                  : t('{p0} days left', { p0: formatNumber(row.original.daysLeft) })}
              </p>
            ) : null}
          </div>
        ),
      },
      {
        id: 'applies',
        header: t('Applies to'),
        enableHiding: false,
        cell: ({ row }) =>
          row.original.scope === 'all' ? (
            <span className="text-fg-muted">{t('Everything')}</span>
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
        id: 'audience',
        header: t('Who gets it'),
        cell: ({ row }) =>
          row.original.audience === 'everyone' ? (
            <span className="text-fg-muted">{t('Everyone')}</span>
          ) : (
            <Badge tone="info" title={row.original.clientNames.join(', ')}>
              {describeAudience(row.original)}
            </Badge>
          ),
      },
      {
        id: 'minimum',
        header: t('Minimum sale'),
        meta: { align: 'right' },
        cell: ({ row }) =>
          row.original.minimumSale === null ? (
            <span className="text-fg-subtle">{t('Any')}</span>
          ) : (
            <span className="tabular-nums">{formatMoney(row.original.minimumSale)}</span>
          ),
      },
      { accessorKey: 'createdBy', header: t('Set up by') },
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
                label: t('Edit'),
                icon: Pencil,
                hidden: !can('marketing.promotions.edit'),
                onSelect: () => navigate(paths.marketing.editPromotion(row.original.id)),
              },
              {
                label: t('Delete'),
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

  return (
    <>
      <PageHeader
        title={t('Promotions')}
        description={t(
          "Discounts recorded as a decision rather than typed into a sale. A running promotion is applied for the seller on the New sale screen, so nobody has to remember this week's offer or work the percentage out by hand.",
        )}
        action={
          can('marketing.promotions.create') ? (
            <Button variant="primary" asChild>
              <Link to={paths.marketing.newPromotion}>
                <Plus />
                {t('Add promotion')}
              </Link>
            </Button>
          ) : null
        }
        below={
          <StatusChips
            ariaLabel={t('Which promotions to show')}
            options={[
              { value: null, label: t('All') },
              { value: 'running', label: t('Running') },
              { value: 'scheduled', label: t('Scheduled') },
              { value: 'paused', label: t('Paused') },
              { value: 'finished', label: t('Finished') },
            ]}
            value={(query.status as string | null) ?? null}
            onChange={(status) => setQuery({ status, page: null })}
            counts={counts}
          />
        }
      />

      <DataTable
        storageKey="promotions"
        columns={columns}
        initialHidden={['createdBy']}
        data={data.items}
        total={data.total}
        isLoading={isLoading}
        toolbar={
          <ColumnFilterSearch
            columns={columns}
            rows={everyPromotion.items}
            overrides={PROMOTION_FILTER_OVERRIDES}
            query={query}
            setQuery={setQuery}
          />
        }
        pagination={{ page: Number(query.page ?? 1), pageSize: Number(query.pageSize ?? 25) }}
        onPaginationChange={({ page, pageSize }) => setQuery({ page, pageSize })}
        onRowClick={(promotion) => navigate(paths.marketing.editPromotion(promotion.id))}
        emptyState={
          query.search || query.f || query.status ? (
            <EmptyState title={t('No promotions match these filters')} />
          ) : (
            <EmptyState
              icon={Tag}
              title={t('No promotions yet')}
              description={t(
                'A promotion turns a discount into a decision with an end date, so its cost can be measured afterwards instead of disappearing into general discounting.',
              )}
              action={
                can('marketing.promotions.create') ? (
                  <Button variant="primary" asChild>
                    <Link to={paths.marketing.newPromotion}>
                      <Plus />
                      {t('Add promotion')}
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
        title={t('Delete {name}?', { name: deleting?.name })}
        body="Sales already made at this price are not affected — they keep the discount they were given. Only future sales change."
        confirmLabel={t('Delete')}
        destructive
        onConfirm={() => {
          if (deleting) actions.remove(deleting.id)
          setDeleting(null)
          toast.success(t('Promotion deleted'))
        }}
      />
    </>
  )
}
