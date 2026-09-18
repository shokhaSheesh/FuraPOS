import { useMemo } from 'react'
import { useNavigate } from 'react-router'
import { Package } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { DataTable } from '@/shared/components/DataTable'
import { ColumnFilterSearch } from '@/shared/components/ColumnFilterSearch'
import { LOG_FILTER_OVERRIDES } from '../model/logFilterFields'
import { EmptyState } from '@/shared/components/EmptyState'
import { StatusChips } from '@/shared/components/StatusChips'
import { FilterSelect } from '@/shared/components/FilterSelect'
import { DateRangePicker } from '@/shared/ui/DateRangePicker'
import { useListQuery } from '@/shared/hooks/useListQuery'
import { useDataStore } from '@/data/store'
import { useLogKindCounts, useStockLog } from '../api/logs'
import { STOCK_LOG_KINDS } from '../model/log'
import { buildLogColumns, documentPath } from '../components/logColumns'
import { t } from '@/shared/i18n'

/** The whole log, unfiltered — the search panel reads its pick-lists from it. */
const EVERY_ENTRY = { page: 1, pageSize: 100_000 }

/**
 * Product logs.
 *
 * The screen somebody opens when a stock number is wrong. Every change, newest
 * first, with what it went to and the document that caused it — so the next
 * click is always "show me why".
 */
export default function ProductLogsPage() {
  const navigate = useNavigate()
  const { query, setQuery } = useListQuery()
  const { data: everyEntry } = useStockLog(EVERY_ENTRY)
  const locations = useDataStore((s) => s.locations)

  const filters = {
    f: query.f,
    search: query.search,
    location: query.location,
    kind: query.kind,
    from: query.from,
    to: query.to,
    page: query.page,
    pageSize: query.pageSize ?? 50,
  }
  const { data, isLoading } = useStockLog(filters)
  const { data: counts } = useLogKindCounts(filters)

  const columns = useMemo(() => buildLogColumns({ subject: 'product' }), [])

  return (
    <>
      <PageHeader
        title={t('Product logs')}
        description={t(
          'Every change to a stock number, newest first — what it went to and which document caused it. This is the screen to open when a number looks wrong.',
        )}
        below={
          <div className="flex flex-wrap items-center gap-2">
            <StatusChips
              ariaLabel={t('Filter by what caused the change')}
              options={[
                { value: null, label: t('All') },
                ...STOCK_LOG_KINDS.map((entry) => ({
                  value: entry.value,
                  label: entry.label,
                })),
              ]}
              value={(query.kind as string | null) ?? null}
              onChange={(kind) => setQuery({ kind, page: null })}
              counts={counts}
            />
            <FilterSelect
              aria-label={t('Filter by location')}
              label={t('At')}
              allLabel={t('Everywhere')}
              value={(query.location as string | null) ?? null}
              options={locations.map((l) => ({ value: l.id, label: l.name }))}
              onChange={(location) => setQuery({ location, page: null })}
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
        storageKey="product-logs"
        columns={columns}
        initialHidden={['by']}
        data={data.items}
        total={data.total}
        isLoading={isLoading}
        toolbar={
          <ColumnFilterSearch
            columns={columns}
            rows={everyEntry.items}
            overrides={LOG_FILTER_OVERRIDES}
            query={query}
            setQuery={setQuery}
          />
        }
        pagination={{ page: Number(query.page ?? 1), pageSize: Number(query.pageSize ?? 50) }}
        onPaginationChange={({ page, pageSize }) => setQuery({ page, pageSize })}
        onRowClick={(entry) => navigate(documentPath(entry))}
        emptyState={
          <EmptyState
            icon={Package}
            title={t('Nothing moved')}
            description={t(
              'No stock changed in this period. Widen the dates or clear the filters.',
            )}
          />
        }
      />
    </>
  )
}
