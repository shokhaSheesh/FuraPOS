import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { DataTable } from '@/shared/components/DataTable'
import { ColumnFilterSearch } from '@/shared/components/ColumnFilterSearch'
import { CORRECTION_FILTER_OVERRIDES } from '../model/correctionFilterFields'
import { EmptyState } from '@/shared/components/EmptyState'
import { StatusChips } from '@/shared/components/StatusChips'
import { FilterSelect } from '@/shared/components/FilterSelect'
import { Button } from '@/shared/ui/Button'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { toast } from '@/shared/ui/toast'
import { useListQuery } from '@/shared/hooks/useListQuery'
import { useSession } from '@/app/providers/SessionProvider'
import { paths } from '@/shared/config/paths'
import { formatNumber } from '@/shared/lib/format'
import { useDataStore } from '@/data/store'
import { USD_RATE } from '@/data/seed'
import { useCancelCorrection, useCorrectionStatusCounts, useCorrections } from '../api/corrections'
import {
  buildCorrectionColumns,
  CORRECTION_COLUMNS_HIDDEN_BY_DEFAULT,
} from '../components/correctionColumns'
import { CORRECTION_REASONS, netUnits, type Correction } from '../model/correction'
import { t } from '@/shared/i18n'

/**
 * Stock that changed when nothing was sold, received or moved: breakage,
 * shrinkage, expiry, a miscount. The reason is the point of the document, so it
 * is a column that cannot be hidden and a filter of its own.
 *
 * The tiles answer the question the page is opened with — how much is leaking,
 * and what is it worth — which is why the money is at cost rather than at sale:
 * a dropped part costs what it cost, not what it might have fetched.
 */
export default function CorrectionsListPage() {
  const navigate = useNavigate()
  const { can } = useSession()
  const { query, setQuery } = useListQuery()
  const allCorrections = useDataStore((s) => s.corrections)
  const locations = useDataStore((s) => s.locations)

  const scope = {
    f: query.f,
    search: query.search,
    location: query.location,
    reason: query.reason,
    direction: query.direction,
  }
  const { data, isLoading } = useCorrections(query)
  const { data: counts } = useCorrectionStatusCounts(scope)
  const canSeeCost = can('products.cost.view')

  const [pendingCancel, setPendingCancel] = useState<Correction | null>(null)
  const cancelCorrection = useCancelCorrection(pendingCancel?.id ?? '')

  const columns = useMemo(
    () =>
      buildCorrectionColumns({
        canCancel: can('products.corrections.delete'),
        canSeeCost,
        usdRate: USD_RATE,
        onCancel: setPendingCancel,
      }),
    [can, canSeeCost],
  )

  return (
    <>
      <PageHeader
        title={t('Corrections')}
        description={t('Why a number changed when nothing was sold, received or moved.')}
        action={
          can('products.corrections.create') ? (
            <Button variant="primary" asChild>
              <Link to={paths.products.newCorrection}>
                <Plus />
                {t('New correction')}
              </Link>
            </Button>
          ) : null
        }
        below={
          <div className="flex flex-wrap items-center gap-2">
            <StatusChips
              options={[
                { value: null, label: t('All') },
                { value: 'applied', label: t('Applied') },
                { value: 'cancelled', label: t('Cancelled') },
              ]}
              value={(query.status as string | null) ?? null}
              onChange={(next) => setQuery({ status: next, page: null })}
              counts={counts}
            />
            <StatusChips
              ariaLabel={t('Filter by direction')}
              options={[
                { value: null, label: t('Both ways') },
                { value: 'off', label: t('Written off') },
                { value: 'on', label: t('Written on') },
              ]}
              value={(query.direction as string | null) ?? null}
              onChange={(next) => setQuery({ direction: next, page: null })}
            />
            <FilterSelect
              aria-label={t('Filter by reason')}
              label={t('Because')}
              allLabel={t('Any reason')}
              value={(query.reason as string | null) ?? null}
              options={CORRECTION_REASONS.map((r) => ({ value: r.value, label: r.label }))}
              onChange={(next) => setQuery({ reason: next, page: null })}
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
        storageKey="corrections"
        columns={columns}
        initialHidden={CORRECTION_COLUMNS_HIDDEN_BY_DEFAULT}
        data={data?.items ?? []}
        total={data?.total ?? 0}
        isLoading={isLoading}
        toolbar={
          <ColumnFilterSearch
            columns={columns}
            rows={allCorrections}
            overrides={CORRECTION_FILTER_OVERRIDES}
            query={query}
            setQuery={setQuery}
          />
        }
        pagination={{ page: Number(query.page ?? 1), pageSize: Number(query.pageSize ?? 25) }}
        onPaginationChange={({ page, pageSize }) => setQuery({ page, pageSize })}
        onRowClick={(correction) => navigate(paths.products.correctionDetail(correction.id))}
        emptyState={
          query.search ||
          query.f ||
          query.status ||
          query.location ||
          query.reason ||
          query.direction ? (
            <EmptyState title={t('No corrections match these filters')} />
          ) : (
            <EmptyState
              title={t('Nothing has been corrected')}
              description={t(
                'When the shelf and the system disagree, a correction records the new count and why it changed.',
              )}
              action={
                can('products.corrections.create') ? (
                  <Button variant="primary" asChild>
                    <Link to={paths.products.newCorrection}>
                      <Plus />
                      {t('New correction')}
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
        title={t('Reverse this correction?')}
        confirmLabel={t('Reverse')}
        body={
          pendingCancel ? (
            <>
              <strong className="text-fg font-medium">{pendingCancel.number}</strong>{' '}
              {t('changed stock at')} {pendingCancel.locationName} by{' '}
              {netUnits(pendingCancel) > 0 ? '+' : '−'}
              {formatNumber(Math.abs(netUnits(pendingCancel)))}{' '}
              {t('units. Reversing puts that back and keeps both entries in the history.')}
            </>
          ) : null
        }
        onConfirm={() =>
          cancelCorrection.mutate({
            onSuccess: () => {
              toast.success(`${pendingCancel?.number} reversed`)
              setPendingCancel(null)
            },
            onError: (message) => toast.error(message),
          })
        }
      />
    </>
  )
}
