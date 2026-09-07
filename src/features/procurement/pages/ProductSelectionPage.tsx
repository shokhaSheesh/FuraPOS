import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { AlertTriangle, Download, PackageSearch, Settings2, Coins } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { DataTable } from '@/shared/components/DataTable'
import { SearchInput } from '@/shared/components/SearchInput'
import { EmptyState } from '@/shared/components/EmptyState'
import { StatusChips } from '@/shared/components/StatusChips'
import { FilterSelect } from '@/shared/components/FilterSelect'
import { ProductThumb } from '@/shared/components/ProductThumb'
import { NumberField } from '@/shared/components/NumberField'
import { Field } from '@/shared/components/Field'
import { Badge } from '@/shared/ui/Badge'
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Button } from '@/shared/ui/Button'
import { toast } from '@/shared/ui/toast'
import { useListQuery } from '@/shared/hooks/useListQuery'
import { paths } from '@/shared/config/paths'
import { downloadCsv } from '@/shared/lib/csv'
import { formatMoney, formatNumber } from '@/shared/lib/format'
import type { TableColumn } from '@/shared/components/table/features'
import { useDataStore } from '@/data/store'
import { USD_RATE } from '@/data/seed'
import { countByUrgency, summariseReorder, useReorderLines } from '../api/reorder'
import {
  DEFAULT_SETTINGS,
  lineCostUzs,
  urgencyLabel,
  urgencyTone,
  type ReorderLine,
  type ReorderSettings,
  type Urgency,
} from '../model/reorder'

/**
 * What to buy, worked out rather than remembered.
 *
 * The three settings at the top are the whole model, and they are on the screen
 * rather than buried in a config page because they are the assumptions the
 * answer rests on: change the lead time and every suggestion changes. A buyer
 * who cannot see them cannot trust them.
 *
 * Nothing here is stored. A suggestion is only true for as long as the stock
 * and sales behind it are, so it is computed on every read and exported when
 * someone wants to act on it.
 */
export default function ProductSelectionPage() {
  const { query, setQuery } = useListQuery()
  const suppliers = useDataStore((s) => s.suppliers)
  const categories = useDataStore((s) => s.categories)
  const locations = useDataStore((s) => s.locations)

  const [settings, setSettings] = useState<ReorderSettings>(DEFAULT_SETTINGS)
  const [showSettings, setShowSettings] = useState(false)

  const urgency = (query.urgency as Urgency | null) ?? null
  const filters = useMemo(
    () => ({
      search: String(query.search ?? ''),
      supplierId: (query.supplier as string | null) ?? null,
      categoryId: (query.category as string | null) ?? null,
      locationId: (query.location as string | null) ?? null,
      urgency,
      // Most of a catalogue is fine most of the time; showing all of it by
      // default would bury the twenty rows that need a decision.
      onlyNeeded: query.all !== '1' && !urgency,
    }),
    [query, urgency],
  )

  const lines = useReorderLines(settings, filters)
  const allLines = useReorderLines(settings, { ...filters, onlyNeeded: false, urgency: null })
  const summary = summariseReorder(allLines)
  const counts = countByUrgency(allLines)

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
        header: `Sold in ${settings.historyDays}d`,
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

  return (
    <>
      <PageHeader
        title="Product selection"
        description="What to reorder, worked out from how fast each part sells and how long a delivery takes."
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setShowSettings((open) => !open)}>
              <Settings2 />
              Assumptions
            </Button>
            <Button variant="primary" onClick={exportList}>
              <Download />
              Export the list
            </Button>
          </div>
        }
        below={
          <div className="flex flex-wrap items-center gap-2">
            <StatusChips
              ariaLabel="Filter by state"
              options={[
                { value: null, label: 'Needs ordering' },
                { value: 'out', label: 'Out of stock' },
                { value: 'critical', label: 'Will run out' },
                { value: 'soon', label: 'Order soon' },
                { value: 'ok', label: 'Enough' },
                { value: 'idle', label: 'Not selling' },
              ]}
              value={urgency}
              onChange={(next) => setQuery({ urgency: next, page: null })}
              counts={{ ...counts, all: summary.needed }}
            />
            <FilterSelect
              aria-label="Filter by supplier"
              label="From"
              allLabel="Any supplier"
              value={(query.supplier as string | null) ?? null}
              options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
              onChange={(next) => setQuery({ supplier: next, page: null })}
            />
            <FilterSelect
              aria-label="Filter by category"
              label="In"
              allLabel="Every category"
              value={(query.category as string | null) ?? null}
              options={categories.map((c) => ({ value: c.id, label: c.path }))}
              onChange={(next) => setQuery({ category: next, page: null })}
            />
            <FilterSelect
              aria-label="Filter by location"
              label="At"
              allLabel="Everywhere"
              value={(query.location as string | null) ?? null}
              options={locations.map((l) => ({ value: l.id, label: l.name }))}
              onChange={(next) => setQuery({ location: next, page: null })}
            />
          </div>
        }
      />

      {showSettings ? (
        <Card>
          <CardHeader className="flex-col items-stretch gap-1">
            <CardTitle>What this assumes</CardTitle>
            <p className="text-fg-subtle text-2xs">
              Every suggestion below rests on these three numbers. Change one and the whole list
              changes.
            </p>
          </CardHeader>
          <CardBody className="grid gap-3 sm:grid-cols-3">
            <Field label="A delivery takes" hint="Days from ordering to it being on the shelf">
              {(p) => (
                <NumberField
                  {...p}
                  className="w-full"
                  nullable={false}
                  min={1}
                  value={settings.leadTimeDays}
                  onChange={(next) =>
                    setSettings((s) => ({ ...s, leadTimeDays: Math.max(1, next ?? 1) }))
                  }
                />
              )}
            </Field>
            <Field label="Hold this much cover" hint="Days of stock to have once it lands">
              {(p) => (
                <NumberField
                  {...p}
                  className="w-full"
                  nullable={false}
                  min={0}
                  value={settings.coverDays}
                  onChange={(next) => setSettings((s) => ({ ...s, coverDays: next ?? 0 }))}
                />
              )}
            </Field>
            <Field label="Judge demand on" hint="Days of sales history to average">
              {(p) => (
                <NumberField
                  {...p}
                  className="w-full"
                  nullable={false}
                  min={7}
                  value={settings.historyDays}
                  onChange={(next) =>
                    setSettings((s) => ({ ...s, historyDays: Math.max(7, next ?? 7) }))
                  }
                />
              )}
            </Field>
          </CardBody>
        </Card>
      ) : null}

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
        storageKey="reorder"
        columns={columns}
        initialHidden={['sold', 'reorderPoint', 'category']}
        data={lines}
        total={lines.length}
        isLoading={false}
        toolbar={
          <>
            <SearchInput
              value={String(query.search ?? '')}
              onChange={(search) => setQuery({ search })}
              placeholder="Search by name, SKU or supplier…"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setQuery({ all: query.all === '1' ? null : '1', urgency: null })}
            >
              {query.all === '1' ? 'Only what needs ordering' : 'Show the whole catalogue'}
            </Button>
          </>
        }
        pagination={{ page: 1, pageSize: lines.length || 1 }}
        onPaginationChange={() => {}}
        emptyState={
          <EmptyState
            title="Nothing needs ordering"
            description="Every product that sells has enough stock to outlast a delivery. Change the assumptions above, or show the whole catalogue."
          />
        }
      />
    </>
  )
}
