import { useMemo } from 'react'
import { Link, useParams } from 'react-router'
import { AlertTriangle, ArrowLeft, Coins, Download, PackageSearch } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { DataTable } from '@/shared/components/DataTable'
import { SearchInput } from '@/shared/components/SearchInput'
import { EmptyState } from '@/shared/components/EmptyState'
import { StatusChips } from '@/shared/components/StatusChips'
import { ProductThumb } from '@/shared/components/ProductThumb'
import { Badge } from '@/shared/ui/Badge'
import { Card, CardBody } from '@/shared/ui/Card'
import { Button } from '@/shared/ui/Button'
import { toast } from '@/shared/ui/toast'
import { useListQuery } from '@/shared/hooks/useListQuery'
import { paths } from '@/shared/config/paths'
import { downloadCsv } from '@/shared/lib/csv'
import { formatDateTime, formatMoney, formatNumber } from '@/shared/lib/format'
import { matches } from '@/data/query'
import type { TableColumn } from '@/shared/components/table/features'
import { useDataStore } from '@/data/store'
import { USD_RATE } from '@/data/seed'
import { countByUrgency, summariseReorder } from '../api/reorder'
import {
  coverageHorizon,
  DEFAULT_SETTINGS,
  lineCostUzs,
  needsOrdering,
  urgencyLabel,
  urgencyTone,
  type ReorderLine,
  type Urgency,
} from '../model/reorder'
import { selectionSourceLabel, selectionStatusLabel, selectionStatusTone } from '../model/selection'

/**
 * One selection run, and what it found.
 *
 * The assumptions sit at the top because they are what the answer rests on —
 * change the lead time and every suggestion changes — but they are read-only
 * here: a saved run answers a specific question, and editing the question
 * afterwards would leave a document whose numbers no longer match its settings.
 * To ask a different question, run it again.
 */
export default function SelectionDetailPage() {
  const { selectionId } = useParams()
  const { query, setQuery } = useListQuery()
  const selection = useDataStore((s) => s.selections.find((entry) => entry.id === selectionId))

  const urgency = (query.urgency as Urgency | null) ?? null
  const term = String(query.search ?? '')

  const settings = selection?.settings ?? DEFAULT_SETTINGS

  /*
    The lines are the ones this run froze, not a fresh calculation. That is the
    point of a saved selection: it says what was true when someone asked, which
    is what makes two runs comparable and a scheduled run worth keeping.
  */
  const lines = useMemo(() => {
    if (!selection) return []
    return selection.lines.filter((line) => {
      if (urgency && line.urgency !== urgency) return false
      if (query.all !== '1' && !urgency && !needsOrdering(line)) return false
      return matches([line.name, line.sku, line.supplierName, line.categoryName], term)
    })
  }, [selection, urgency, term, query.all])

  const summary = summariseReorder(selection?.lines ?? [])
  const counts = countByUrgency(selection?.lines ?? [])

  const columns = useMemo<TableColumn<ReorderLine>[]>(
    () => [
      {
        id: 'product',
        header: 'Product',
        enableHiding: false,
        cell: ({ row }) => (
          <Link
            to={paths.products.detail(row.original.productId)}
            className="flex items-center gap-2.5 hover:underline"
          >
            <ProductThumb src={row.original.imageUrl} size="sm" />
            <div className="min-w-0">
              <p className="text-fg font-medium">{row.original.name}</p>
              <p className="text-fg-subtle text-2xs font-mono">{row.original.sku}</p>
            </div>
          </Link>
        ),
      },
      {
        id: 'urgency',
        header: 'State',
        enableHiding: false,
        cell: ({ row }) => (
          <Badge tone={urgencyTone(row.original.urgency)}>
            {urgencyLabel(row.original.urgency)}
          </Badge>
        ),
      },
      {
        id: 'onHand',
        header: 'On hand',
        meta: { align: 'right' },
        cell: ({ row }) => (
          <span className={row.original.onHand === 0 ? 'text-danger font-medium' : undefined}>
            {formatNumber(row.original.onHand)} {row.original.unit}
          </span>
        ),
      },
      {
        id: 'cover',
        header: 'Lasts',
        meta: { align: 'right' },
        enableHiding: false,
        cell: ({ row }) => {
          const { daysOfCover, dailyRate } = row.original
          if (daysOfCover === null) {
            return <span className="text-fg-subtle">not selling</span>
          }
          return (
            <div>
              <p
                className={
                  daysOfCover < settings.leadTimeDays ? 'text-danger font-medium' : 'text-fg'
                }
              >
                {formatNumber(Math.round(daysOfCover))} days
              </p>
              <p className="text-fg-subtle text-2xs">
                {dailyRate >= 1
                  ? `${formatNumber(Math.round(dailyRate * 10) / 10)}/day`
                  : `${formatNumber(Math.round(dailyRate * 30 * 10) / 10)}/month`}
              </p>
            </div>
          )
        },
      },
      {
        id: 'sold',
        header: `Sold in ${settings.salesWindowDays}d`,
        meta: { align: 'right' },
        cell: ({ row }) => formatNumber(row.original.sold),
      },
      {
        id: 'reorderPoint',
        header: 'Order below',
        meta: { align: 'right' },
        cell: ({ row }) => formatNumber(row.original.reorderPoint),
      },
      {
        id: 'suggested',
        header: 'Order',
        meta: { align: 'right' },
        enableHiding: false,
        cell: ({ row }) => {
          const { suggested, shortfall, moq } = row.original
          if (suggested === 0) return <span className="text-fg-subtle">—</span>
          return (
            <div>
              <p className="text-fg font-semibold tabular-nums">{formatNumber(suggested)}</p>
              {/* Say when the number was rounded up, or it looks arbitrary. */}
              {moq && suggested !== shortfall ? (
                <p className="text-fg-subtle text-2xs">
                  {formatNumber(shortfall)} needed · MOQ {formatNumber(moq)}
                </p>
              ) : null}
            </div>
          )
        },
      },
      {
        id: 'cost',
        header: 'Cost',
        meta: { align: 'right' },
        cell: ({ row }) =>
          row.original.suggested === 0 ? (
            <span className="text-fg-subtle">—</span>
          ) : (
            formatMoney(Math.round(lineCostUzs(row.original, USD_RATE)))
          ),
      },
      {
        id: 'supplier',
        header: 'Buy from',
        cell: ({ row }) =>
          row.original.supplierId ? (
            <Link
              to={paths.products.supplierDetail(row.original.supplierId)}
              className="hover:underline"
            >
              {row.original.supplierName}
            </Link>
          ) : (
            <span className="text-fg-subtle">Never received</span>
          ),
      },
      {
        id: 'category',
        header: 'Category',
        cell: ({ row }) => row.original.categoryName,
      },
    ],
    [settings],
  )

  const exportList = () => {
    const rows = lines.filter((line) => line.suggested > 0)
    if (rows.length === 0) return toast.error('Nothing to order with these filters')
    downloadCsv(
      `reorder-${new Date().toISOString().slice(0, 10)}.csv`,
      ['SKU', 'Product', 'Supplier', 'On hand', 'Days left', 'Order', 'MOQ', 'Cost', 'Currency'],
      rows.map((line) => [
        line.sku,
        line.name,
        line.supplierName ?? '',
        line.onHand,
        line.daysOfCover === null ? '' : Math.round(line.daysOfCover),
        line.suggested,
        line.moq ?? '',
        line.unitCost,
        line.costCurrency,
      ]),
    )
    toast.success(`${formatNumber(rows.length)} products exported`)
  }

  const tiles = [
    {
      icon: PackageSearch,
      label: 'Worth ordering',
      value: formatNumber(summary.needed),
      meta: `across ${formatNumber(summary.suppliers)} suppliers`,
    },
    {
      icon: AlertTriangle,
      label: 'Already too late',
      value: formatNumber(summary.outOfStock + summary.critical),
      meta: `${formatNumber(summary.outOfStock)} out, ${formatNumber(summary.critical)} will run out before a delivery lands`,
      tone: summary.outOfStock + summary.critical > 0 ? ('danger' as const) : undefined,
    },
    {
      icon: Coins,
      label: 'What it would cost',
      value: formatMoney(Math.round(summary.cost)),
      meta: `${formatNumber(summary.units)} units at last known cost`,
    },
  ]

  if (!selection) {
    return <EmptyState title="Selection not found" description="It may have been deleted." />
  }

  if (selection.status === 'failed') {
    return (
      <>
        <BackLink />
        <PageHeader
          title={selection.number}
          description="This run did not produce anything."
          below={
            <Badge tone={selectionStatusTone(selection.status)}>
              {selectionStatusLabel(selection.status)}
            </Badge>
          }
        />
        <EmptyState
          title="Nothing was calculated"
          description={selection.failureReason ?? 'The run failed.'}
        />
      </>
    )
  }

  return (
    <>
      <BackLink />

      <PageHeader
        title={selection.number}
        description={`${selectionSourceLabel(selection.source)}${
          selection.supplierName ? ` · ${selection.supplierName}` : ''
        }`}
        action={
          <Button variant="primary" onClick={exportList}>
            <Download />
            Export the list
          </Button>
        }
        below={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={selectionStatusTone(selection.status)}>
              {selectionStatusLabel(selection.status)}
            </Badge>
            <span className="text-fg-muted text-sm">
              Run {formatDateTime(selection.createdAt)} by {selection.createdBy}
            </span>
            {selection.comment ? (
              <span className="text-fg-subtle text-sm">· {selection.comment}</span>
            ) : null}
          </div>
        }
      />

      {/*
        The assumptions are shown, not editable. A saved run is an answer to a
        specific question, and letting someone change the question afterwards
        would leave a document whose numbers no longer match its own settings.
      */}
      <Card>
        <CardBody className="flex flex-wrap items-center gap-x-6 gap-y-2 p-4 text-sm">
          <Assumption
            label="Judged demand on"
            value={`${settings.salesWindowDays} days of sales`}
          />
          <Assumption label="A delivery takes" value={`${settings.leadTimeDays} days`} />
          <Assumption label="Next order in" value={`${settings.orderIntervalDays} days`} />
          <Assumption label="Safety stock" value={`${settings.safetyDays} days`} />
          <Assumption
            label="Covering"
            value={`${coverageHorizon(settings)} days of demand`}
            strong
          />
          <Assumption
            label="Stock counted at"
            value={
              selection.locationNames.length ? selection.locationNames.join(', ') : 'Everywhere'
            }
          />
        </CardBody>
      </Card>

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
        storageKey="selection-lines"
        columns={columns}
        initialHidden={['sold', 'reorderPoint', 'category', 'supplier']}
        data={lines}
        total={lines.length}
        isLoading={false}
        toolbar={
          <>
            <SearchInput
              value={term}
              onChange={(search) => setQuery({ search })}
              placeholder="Search by name or SKU…"
            />
            <StatusChips
              ariaLabel="Filter by state"
              options={[
                { value: null, label: 'Worth ordering' },
                { value: 'out', label: 'Out of stock' },
                { value: 'critical', label: 'Will run out' },
                { value: 'soon', label: 'Order soon' },
                { value: 'ok', label: 'Enough' },
                { value: 'idle', label: 'Not selling' },
              ]}
              value={urgency}
              onChange={(next) => setQuery({ urgency: next })}
              counts={{ ...counts, all: summary.needed }}
            />
          </>
        }
        pagination={{ page: 1, pageSize: lines.length || 1 }}
        onPaginationChange={() => {}}
        emptyState={
          <EmptyState
            title="Nothing needs ordering"
            description="Every product this run looked at has enough stock to outlast a delivery."
          />
        }
      />
    </>
  )

  function BackLink() {
    return (
      <Button variant="link" size="sm" className="h-auto px-0" asChild>
        <Link to={paths.procurement.selection}>
          <ArrowLeft />
          Product selection
        </Link>
      </Button>
    )
  }
}

function Assumption({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <span>
      <span className="text-fg-muted">{label} </span>
      <span className={strong ? 'text-fg font-semibold' : 'text-fg font-medium'}>{value}</span>
    </span>
  )
}
