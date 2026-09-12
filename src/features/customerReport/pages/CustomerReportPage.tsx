import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Play, Users } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { DataTable } from '@/shared/components/DataTable'
import { SearchInput } from '@/shared/components/SearchInput'
import { EmptyState } from '@/shared/components/EmptyState'
import { FilterGate } from '@/shared/components/FilterGate'
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { DateRangePicker } from '@/shared/ui/DateRangePicker'
import { paths } from '@/shared/config/paths'
import { formatDate, formatMoney, formatNumber, formatPercent } from '@/shared/lib/format'
import { cn } from '@/shared/lib/cn'
import type { TableColumn } from '@/shared/components/table/features'
import { useCustomerReport } from '../api/customerReport'
import {
  AT_RISK_DAYS,
  RFM_SEGMENTS,
  segmentAction,
  segmentLabel,
  segmentTone,
  type RfmSegment,
  type ScoredCustomer,
} from '../model/rfm'

/**
 * A year, not a quarter.
 *
 * The window has to be longer than the "gone quiet" threshold, or the people
 * this report exists to find fall outside it: somebody who stopped buying a
 * hundred days ago has no purchases in the last ninety, so they arrive as
 * "lost" with no history rather than "at risk" with a reason to ring them.
 */
const DEFAULT_WINDOW_DAYS = 365

const defaultFrom = () => new Date(Date.now() - DEFAULT_WINDOW_DAYS * 86_400_000)

/**
 * The customer report.
 *
 * RFM — recency, frequency, money — because "who are my best customers" and
 * "who is slipping away" are the same question asked from two ends, and neither
 * is answered anywhere else in the app. The Clients screen answers who owes us;
 * this answers who is worth keeping.
 *
 * Every segment carries **what to do about it**. OX's version promises exactly
 * that in its subtitle and then shows a coloured label, which is a diagnosis
 * with no prescription.
 */
export default function CustomerReportPage() {
  const navigate = useNavigate()
  const [range, setRange] = useState<{ from: Date | null; to: Date | null }>({
    from: defaultFrom(),
    to: new Date(),
  })
  const [segment, setSegment] = useState<RfmSegment | null>(null)
  const [search, setSearch] = useState('')
  const [ran, setRan] = useState(false)

  const filters = useMemo(
    () => ({
      from: range.from ? range.from.toISOString().slice(0, 10) : null,
      to: range.to ? range.to.toISOString().slice(0, 10) : null,
      segment,
      search,
    }),
    [range.from, range.to, segment, search],
  )

  const report = useCustomerReport(filters, ran)

  const columns = useMemo<TableColumn<ScoredCustomer>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Client',
        enableHiding: false,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="text-fg truncate font-medium">{row.original.name}</p>
            <p className="text-fg-subtle text-2xs">
              {row.original.lastPurchaseAt
                ? `Last bought ${formatDate(row.original.lastPurchaseAt)}`
                : 'Never bought'}
            </p>
          </div>
        ),
      },
      {
        accessorKey: 'segment',
        header: 'Segment',
        enableHiding: false,
        cell: ({ row }) => (
          <Badge tone={segmentTone(row.original.segment)}>
            {segmentLabel(row.original.segment)}
          </Badge>
        ),
      },
      {
        id: 'rfm',
        header: 'R · F · M',
        enableHiding: false,
        cell: ({ row }) => (
          <span
            className="text-fg-muted font-mono tabular-nums"
            title="Recency · Frequency · Money, each scored 1–5 against the rest of your customers"
          >
            {row.original.r} · {row.original.f} · {row.original.m}
          </span>
        ),
      },
      {
        id: 'spend',
        header: 'Spent',
        meta: { align: 'right' },
        enableHiding: false,
        cell: ({ row }) => (
          <div>
            <p className="text-fg font-medium tabular-nums">
              {formatMoney(Math.round(row.original.spend))}
            </p>
            <p className="text-fg-subtle text-2xs tabular-nums">
              {formatNumber(row.original.purchases)}{' '}
              {row.original.purchases === 1 ? 'purchase' : 'purchases'}
            </p>
          </div>
        ),
      },
      {
        id: 'averageCheck',
        header: 'Average check',
        meta: { align: 'right' },
        cell: ({ row }) =>
          row.original.purchases === 0 ? (
            <span className="text-fg-subtle">—</span>
          ) : (
            <span className="tabular-nums">
              {formatMoney(Math.round(row.original.averageCheck))}
            </span>
          ),
      },
      {
        id: 'recency',
        header: 'Quiet for',
        meta: { align: 'right' },
        enableHiding: false,
        cell: ({ row }) => {
          const days = row.original.recencyDays
          if (days === null) return <span className="text-fg-subtle">Never bought</span>
          return (
            <span className={days > AT_RISK_DAYS ? 'text-warning tabular-nums' : 'tabular-nums'}>
              {days === 0 ? 'Bought today' : `${formatNumber(days)} days`}
            </span>
          )
        },
      },
      {
        id: 'owed',
        header: 'Owes us',
        meta: { align: 'right' },
        cell: ({ row }) =>
          row.original.debt > 0 ? (
            <span className="text-danger tabular-nums">{formatMoney(row.original.debt)}</span>
          ) : (
            <span className="text-fg-subtle">—</span>
          ),
      },
    ],
    [],
  )

  const tiles = report
    ? [
        {
          label: 'Customer base',
          value: formatNumber(report.summary.base),
          meta: `${formatNumber(report.summary.newInPeriod)} new in this period`,
        },
        {
          label: 'Bought in this period',
          value: formatNumber(report.summary.activeInPeriod),
          meta: `${formatMoney(Math.round(report.summary.revenue))} between them`,
        },
        {
          label: 'Came back',
          value: formatPercent(report.summary.repeatRate),
          meta: 'bought more than once — the number that says you keep people',
        },
        {
          label: 'Average check',
          value: formatMoney(Math.round(report.summary.averageCheck)),
          meta: `${formatMoney(Math.round(report.summary.averageSpend))} spent per customer`,
        },
        {
          label: 'Gone quiet',
          value: formatNumber(report.summary.atRisk),
          meta: `bought before, nothing for ${AT_RISK_DAYS} days`,
          tone: report.summary.atRisk > 0 ? ('warning' as const) : undefined,
        },
        {
          label: 'They owe us',
          value: formatMoney(Math.round(report.summary.debtOwed)),
          meta: `${formatMoney(Math.round(report.summary.cashbackOwed))} of cashback owed back`,
          tone: report.summary.debtOwed > 0 ? ('danger' as const) : undefined,
        },
      ]
    : []

  return (
    <>
      <PageHeader
        title="Customer report"
        description="Who your customers are, what they are worth, which of them are slipping away — and what to do about each group."
        action={
          <Button variant="primary" onClick={() => setRan(true)}>
            <Play />
            Run
          </Button>
        }
        below={
          <div className="flex flex-wrap items-center gap-2">
            <DateRangePicker
              value={range}
              onChange={(next) => {
                setRange(next)
                // A changed window changes every score, so what is on screen is
                // no longer the answer to what the filters now say.
                setRan(false)
              }}
            />
            <SearchInput value={search} onChange={setSearch} placeholder="Find a client…" />
          </div>
        }
      />

      <FilterGate
        applied={ran && report !== null}
        title="Choose a period, then press Run"
        explanation="Scores are worked out by comparing every customer against the rest, so the report waits until you have told it which period to compare over."
      >
        {report ? (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {tiles.map((tile) => (
                <Card key={tile.label} className="p-4">
                  <p className="text-fg-muted text-sm">{tile.label}</p>
                  <p
                    className={`mt-0.5 text-lg font-semibold ${
                      tile.tone === 'danger'
                        ? 'text-danger'
                        : tile.tone === 'warning'
                          ? 'text-warning'
                          : 'text-fg'
                    }`}
                  >
                    {tile.value}
                  </p>
                  <p className="text-fg-subtle text-2xs">{tile.meta}</p>
                </Card>
              ))}
            </div>

            <Card>
              <CardHeader className="flex-col items-stretch gap-1">
                <CardTitle>Segments</CardTitle>
                <p className="text-fg-subtle text-2xs">
                  Everyone is scored 1–5 on how <span className="text-fg-muted">recently</span> they
                  bought, how <span className="text-fg-muted">often</span>, and how{' '}
                  <span className="text-fg-muted">much</span> — against the rest of your customers,
                  not a fixed target. Click a segment to see who is in it.
                </p>
              </CardHeader>
              <CardBody className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {RFM_SEGMENTS.map((entry) => {
                  const count = report.bySegment[entry.value] ?? 0
                  const active = segment === entry.value
                  return (
                    <button
                      key={entry.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setSegment(active ? null : entry.value)}
                      className={cn(
                        'rounded-card border-border hover:border-border-strong border p-3 text-left transition-colors',
                        active && 'border-primary-border bg-surface-inset',
                      )}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <Badge tone={entry.tone}>{entry.label}</Badge>
                        <span className="text-fg text-lg font-semibold tabular-nums">
                          {formatNumber(count)}
                        </span>
                      </div>
                      <p className="text-fg-muted text-2xs mt-1.5">{entry.meaning}</p>
                      {/* The action is the point. A segment nobody can act on
                          is a colour, and OX's version stops at the colour. */}
                      <p className="text-fg-subtle text-2xs mt-1 italic">{entry.action}</p>
                    </button>
                  )
                })}
              </CardBody>
            </Card>

            <DataTable
              storageKey="customer-report"
              columns={columns}
              initialHidden={['averageCheck']}
              data={report.customers}
              total={report.customers.length}
              isLoading={false}
              toolbar={
                segment ? (
                  <div className="flex items-center gap-2">
                    <span className="text-fg-muted text-sm">
                      Showing <span className="text-fg font-medium">{segmentLabel(segment)}</span> —{' '}
                      {segmentAction(segment).toLowerCase()}
                    </span>
                    <Button variant="link" size="sm" onClick={() => setSegment(null)}>
                      Show everyone
                    </Button>
                  </div>
                ) : null
              }
              pagination={{ page: 1, pageSize: 100 }}
              onPaginationChange={() => {}}
              onRowClick={(customer) => navigate(paths.marketing.autoparkDetail(customer.clientId))}
              emptyState={
                <EmptyState
                  icon={Users}
                  title={segment ? `Nobody is in ${segmentLabel(segment)}` : 'No customers'}
                  description={
                    segment
                      ? 'Try another segment, or widen the period.'
                      : 'Attach clients to sales and this report fills itself in.'
                  }
                  action={
                    <Button variant="secondary" asChild>
                      <Link to={paths.marketing.autoparks}>Go to autoparks</Link>
                    </Button>
                  }
                />
              }
            />
          </div>
        ) : null}
      </FilterGate>
    </>
  )
}
