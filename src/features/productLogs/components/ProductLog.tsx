import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { Package } from 'lucide-react'
import { DataTable } from '@/shared/components/DataTable'
import { EmptyState } from '@/shared/components/EmptyState'
import { FilterSelect } from '@/shared/components/FilterSelect'
import { SearchInput } from '@/shared/components/SearchInput'
import { StatusChips } from '@/shared/components/StatusChips'
import { DateRangePicker } from '@/shared/ui/DateRangePicker'
import { formatNumber } from '@/shared/lib/format'
import { useDataStore } from '@/data/store'
import { useLogKindCounts, useLogSummary, useStockLog } from '../api/logs'
import { STOCK_LOG_KINDS, type StockLogKind } from '../model/log'
import { buildLogColumns, documentPath } from './logColumns'

/**
 * One product's history, on its own page — the Product logs screen narrowed
 * to a single product.
 *
 * Same entries, same columns, same filters: it reads from the same replay, so
 * a number here and a number on Product logs can never disagree. The filters
 * live in the component rather than the URL, because the URL belongs to the
 * product page this sits inside.
 */
export function ProductLog({
  productId,
  variations,
}: {
  productId: string
  variations: { id: string; name: string }[]
}) {
  const navigate = useNavigate()
  const locations = useDataStore((s) => s.locations)

  const [kind, setKind] = useState<StockLogKind | null>(null)
  const [variationId, setVariationId] = useState<string | null>(null)
  const [location, setLocation] = useState<string | null>(null)
  const [range, setRange] = useState<{ from: Date | null; to: Date | null }>({
    from: null,
    to: null,
  })
  const [search, setSearch] = useState('')
  const [page, setPage] = useState({ page: 1, pageSize: 25 })

  const day = (date: Date | null) => (date ? date.toISOString().slice(0, 10) : null)
  const filters = {
    productId,
    variationId,
    kind,
    location,
    from: day(range.from),
    to: day(range.to),
    search,
    ...page,
  }
  const { data } = useStockLog(filters)
  const { data: counts } = useLogKindCounts(filters)
  const summary = useLogSummary(filters)

  const columns = useMemo(() => buildLogColumns({ subject: 'variation' }), [])

  // Any filter change is a new list; staying on page 4 of it looks like nothing matched.
  const reset = () => setPage((current) => ({ ...current, page: 1 }))

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <StatusChips
          ariaLabel="Filter by what caused the change"
          options={[
            { value: null, label: 'All' },
            ...STOCK_LOG_KINDS.map((entry) => ({ value: entry.value, label: entry.label })),
          ]}
          value={kind}
          onChange={(next) => {
            setKind(next)
            reset()
          }}
          counts={counts}
        />
        {variations.length > 1 ? (
          <FilterSelect
            aria-label="Filter by variation"
            label="Variation"
            allLabel="All variations"
            value={variationId}
            options={variations.map((v) => ({ value: v.id, label: v.name }))}
            onChange={(next) => {
              setVariationId(next)
              reset()
            }}
          />
        ) : null}
        <FilterSelect
          aria-label="Filter by location"
          label="At"
          allLabel="Everywhere"
          value={location}
          options={locations.map((l) => ({ value: l.id, label: l.name }))}
          onChange={(next) => {
            setLocation(next)
            reset()
          }}
        />
        <DateRangePicker
          value={range}
          onChange={(next) => {
            setRange(next)
            reset()
          }}
        />
      </div>

      <p className="text-fg-muted text-sm">
        <strong className="text-fg font-medium">{formatNumber(summary.events)}</strong>{' '}
        {summary.events === 1 ? 'change' : 'changes'} ·{' '}
        <span className="text-success font-medium">+{formatNumber(summary.unitsIn)}</span> in ·{' '}
        <span className="text-danger font-medium">−{formatNumber(summary.unitsOut)}</span> out
      </p>

      <DataTable
        storageKey="product-log"
        columns={columns}
        initialHidden={['by']}
        data={data.items}
        total={data.total}
        toolbar={
          <SearchInput
            value={search}
            onChange={(next) => {
              setSearch(next)
              reset()
            }}
            placeholder="Search by SKU, document or who…"
          />
        }
        pagination={page}
        onPaginationChange={setPage}
        onRowClick={(entry) => navigate(documentPath(entry))}
        emptyState={
          <EmptyState
            icon={Package}
            title="Nothing has moved"
            description="No stock of this product has changed with these filters."
          />
        }
      />
    </div>
  )
}
