import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Plus, TrendingDown, TrendingUp, Scale } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { DataTable } from '@/shared/components/DataTable'
import { SearchInput } from '@/shared/components/SearchInput'
import { EmptyState } from '@/shared/components/EmptyState'
import { StatusChips } from '@/shared/components/StatusChips'
import { FilterSelect } from '@/shared/components/FilterSelect'
import { Card } from '@/shared/ui/Card'
import { Button } from '@/shared/ui/Button'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { toast } from '@/shared/ui/toast'
import { useListQuery } from '@/shared/hooks/useListQuery'
import { useSession } from '@/app/providers/SessionProvider'
import { paths } from '@/shared/config/paths'
import { formatMoney, formatNumber } from '@/shared/lib/format'
import { useDataStore } from '@/data/store'
import { USD_RATE } from '@/data/seed'
import {
  useCancelCorrection,
  useCorrectionStatusCounts,
  useCorrectionSummary,
  useCorrections,
} from '../api/corrections'
import {
  buildCorrectionColumns,
  CORRECTION_COLUMNS_HIDDEN_BY_DEFAULT,
} from '../components/correctionColumns'
import { CORRECTION_REASONS, netUnits, type Correction } from '../model/correction'

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
  const locations = useDataStore((s) => s.locations)

  const scope = {
    search: query.search,
    location: query.location,
    reason: query.reason,
    direction: query.direction,
  }
  const { data, isLoading } = useCorrections(query)
  const { data: counts } = useCorrectionStatusCounts(scope)
  const summary = useCorrectionSummary(scope)
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

  const tiles = [
    {
      icon: TrendingDown,
      label: 'Written off',
      value: formatNumber(summary.offUnits),
      meta: canSeeCost ? `${formatMoney(summary.offValue)} at cost` : 'units',
      tone: 'danger' as const,
    },
    {
      icon: TrendingUp,
      label: 'Written on',
      value: formatNumber(summary.onUnits),
      meta: canSeeCost ? `${formatMoney(summary.onValue)} at cost` : 'units found',
    },
    {
      icon: Scale,
      label: 'Net effect',
      value: canSeeCost
        ? `${summary.netValue < 0 ? '−' : ''}${formatMoney(Math.abs(summary.netValue))}`
        : formatNumber(summary.onUnits - summary.offUnits),
      meta: 'at cost, applied corrections only',
      tone: summary.netValue < 0 ? ('danger' as const) : undefined,
    },
  ]

  return (
    <>
      <PageHeader
        title="Corrections"
        description="Why a number changed when nothing was sold, received or moved."
        action={
          can('products.corrections.create') ? (
            <Button variant="primary" asChild>
              <Link to={paths.products.newCorrection}>
                <Plus />
                New correction
              </Link>
            </Button>
          ) : null
        }
        below={
          <div className="flex flex-wrap items-center gap-2">
            <StatusChips
              options={[
                { value: null, label: 'All' },
                { value: 'applied', label: 'Applied' },
                { value: 'cancelled', label: 'Cancelled' },
              ]}
              value={(query.status as string | null) ?? null}
              onChange={(next) => setQuery({ status: next, page: null })}
              counts={counts}
            />
            <StatusChips
              ariaLabel="Filter by direction"
              options={[
                { value: null, label: 'Both ways' },
                { value: 'off', label: 'Written off' },
                { value: 'on', label: 'Written on' },
              ]}
              value={(query.direction as string | null) ?? null}
              onChange={(next) => setQuery({ direction: next, page: null })}
            />
            <FilterSelect
              aria-label="Filter by reason"
              label="Because"
              allLabel="Any reason"
              value={(query.reason as string | null) ?? null}
              options={CORRECTION_REASONS.map((r) => ({ value: r.value, label: r.label }))}
              onChange={(next) => setQuery({ reason: next, page: null })}
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
        storageKey="corrections"
        columns={columns}
        initialHidden={CORRECTION_COLUMNS_HIDDEN_BY_DEFAULT}
        data={data?.items ?? []}
        total={data?.total ?? 0}
        isLoading={isLoading}
        toolbar={
          <SearchInput
            value={String(query.search ?? '')}
            onChange={(search) => setQuery({ search })}
            placeholder="Search by number, location, SKU or product…"
          />
        }
        pagination={{ page: Number(query.page ?? 1), pageSize: Number(query.pageSize ?? 25) }}
        onPaginationChange={({ page, pageSize }) => setQuery({ page, pageSize })}
        sorting={query.sort ? [{ id: String(query.sort), desc: query.order === 'desc' }] : []}
        onSortingChange={(sorting) => {
          const [first] = sorting
          setQuery({ sort: first?.id ?? null, order: first?.desc ? 'desc' : 'asc' })
        }}
        onRowClick={(correction) => navigate(paths.products.correctionDetail(correction.id))}
        emptyState={
          query.search || query.status || query.location || query.reason || query.direction ? (
            <EmptyState title="No corrections match these filters" />
          ) : (
            <EmptyState
              title="Nothing has been corrected"
              description="When the shelf and the system disagree, a correction records the new count and why it changed."
              action={
                can('products.corrections.create') ? (
                  <Button variant="primary" asChild>
                    <Link to={paths.products.newCorrection}>
                      <Plus />
                      New correction
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
        title="Reverse this correction?"
        confirmLabel="Reverse"
        body={
          pendingCancel ? (
            <>
              <strong className="text-fg font-medium">{pendingCancel.number}</strong> changed stock
              at {pendingCancel.locationName} by {netUnits(pendingCancel) > 0 ? '+' : '−'}
              {formatNumber(Math.abs(netUnits(pendingCancel)))} units. Reversing puts that back and
              keeps both entries in the history.
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
