import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router'
import { ArrowDownRight, ArrowUpRight, History, Package } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { DataTable } from '@/shared/components/DataTable'
import { SearchInput } from '@/shared/components/SearchInput'
import { EmptyState } from '@/shared/components/EmptyState'
import { StatusChips } from '@/shared/components/StatusChips'
import { FilterSelect } from '@/shared/components/FilterSelect'
import { ProductThumb } from '@/shared/components/ProductThumb'
import { Card } from '@/shared/ui/Card'
import { Button } from '@/shared/ui/Button'
import { DateRangePicker } from '@/shared/ui/DateRangePicker'
import { useListQuery } from '@/shared/hooks/useListQuery'
import { paths } from '@/shared/config/paths'
import { formatDateTime, formatNumber } from '@/shared/lib/format'
import type { TableColumn } from '@/shared/components/table/features'
import { useDataStore } from '@/data/store'
import { useLogKindCounts, useLogSummary, useStockLog } from '../api/logs'
import { STOCK_LOG_KINDS, logKindLabel, type StockLogEntry } from '../model/log'

/** Where each kind of document lives, so a row can be clicked through. */
const documentPath = (entry: StockLogEntry) => {
  switch (entry.kind) {
    case 'receipt':
      return paths.products.goodsReceiptDetail(entry.documentId)
    case 'transfer_in':
    case 'transfer_out':
      return paths.products.transferDetail(entry.documentId)
    case 'correction':
    case 'stocktake':
      return paths.products.correctionDetail(entry.documentId)
    case 'sale':
      return paths.sales.orderDetail(entry.documentId)
  }
}

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
  const locations = useDataStore((s) => s.locations)

  const filters = {
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
  const summary = useLogSummary(filters)

  const columns = useMemo<TableColumn<StockLogEntry>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Product',
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex min-w-0 items-center gap-2.5">
            <ProductThumb src={row.original.imageUrl} size="sm" />
            <div className="min-w-0">
              <p className="text-fg truncate font-medium">{row.original.name}</p>
              <p className="text-fg-subtle text-2xs truncate font-mono">{row.original.sku}</p>
            </div>
          </div>
        ),
      },
      { accessorKey: 'locationName', header: 'Location' },
      {
        id: 'delta',
        header: 'Change',
        meta: { align: 'right' },
        enableHiding: false,
        cell: ({ row }) => {
          const up = row.original.delta > 0
          return (
            <div>
              <p
                className={`flex items-center justify-end gap-1 font-medium tabular-nums ${
                  up ? 'text-success' : 'text-danger'
                }`}
              >
                {up ? (
                  <ArrowUpRight className="size-3.5" />
                ) : (
                  <ArrowDownRight className="size-3.5" />
                )}
                {up ? '+' : '−'}
                {formatNumber(Math.abs(row.original.delta))}
              </p>
              <p className="text-fg-subtle text-2xs tabular-nums">
                {row.original.balanceAfter === null
                  ? '—'
                  : `→ ${formatNumber(row.original.balanceAfter)}`}
              </p>
            </div>
          )
        },
      },
      {
        id: 'document',
        header: 'Because of',
        enableHiding: false,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="text-fg-muted text-2xs">{logKindLabel(row.original.kind)}</p>
            {/* OX shows a grey icon here. A number you can click is the point
                of an audit trail — the next question is always "show me". */}
            <Button variant="link" size="sm" className="h-auto px-0 font-mono" asChild>
              <Link to={documentPath(row.original)} onClick={(event) => event.stopPropagation()}>
                {row.original.documentNumber}
              </Link>
            </Button>
          </div>
        ),
      },
      {
        accessorKey: 'reason',
        header: 'Reason',
        cell: ({ row }) => row.original.reason ?? <span className="text-fg-subtle">—</span>,
      },
      { accessorKey: 'by', header: 'Who' },
      {
        accessorKey: 'at',
        header: 'When',
        enableHiding: false,
        cell: ({ row }) => formatDateTime(row.original.at),
      },
    ],
    [],
  )

  const tiles = [
    {
      icon: History,
      label: 'Changes',
      value: formatNumber(summary.events),
      meta: `across ${formatNumber(summary.products)} products`,
    },
    {
      icon: ArrowUpRight,
      label: 'Units in',
      value: formatNumber(summary.unitsIn),
      meta: 'received, transferred in, found',
    },
    {
      icon: ArrowDownRight,
      label: 'Units out',
      value: formatNumber(summary.unitsOut),
      meta: 'sold, transferred out, written off',
    },
  ]

  return (
    <>
      <PageHeader
        title="Product logs"
        description="Every change to a stock number, newest first — what it went to and which document caused it. This is the screen to open when a number looks wrong."
        below={
          <div className="flex flex-wrap items-center gap-2">
            <StatusChips
              ariaLabel="Filter by what caused the change"
              options={[
                { value: null, label: 'All' },
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
              aria-label="Filter by location"
              label="At"
              allLabel="Everywhere"
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
        storageKey="product-logs"
        columns={columns}
        initialHidden={['by']}
        data={data.items}
        total={data.total}
        isLoading={isLoading}
        toolbar={
          <SearchInput
            value={String(query.search ?? '')}
            onChange={(search) => setQuery({ search })}
            placeholder="Search by product, SKU or document…"
          />
        }
        pagination={{ page: Number(query.page ?? 1), pageSize: Number(query.pageSize ?? 50) }}
        onPaginationChange={({ page, pageSize }) => setQuery({ page, pageSize })}
        onRowClick={(entry) => navigate(documentPath(entry))}
        emptyState={
          <EmptyState
            icon={Package}
            title="Nothing moved"
            description="No stock changed in this period. Widen the dates or clear the filters."
          />
        }
      />
    </>
  )
}
