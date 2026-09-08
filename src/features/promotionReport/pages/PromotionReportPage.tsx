import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Info, Play, Tag } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { DataTable } from '@/shared/components/DataTable'
import { EmptyState } from '@/shared/components/EmptyState'
import { FilterGate } from '@/shared/components/FilterGate'
import { Card, CardBody } from '@/shared/ui/Card'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { paths } from '@/shared/config/paths'
import { formatMoney, formatNumber, formatPercent } from '@/shared/lib/format'
import type { TableColumn } from '@/shared/components/table/features'
import { usePromotionReport } from '../api/promotionReport'
import {
  verdictLabel,
  verdictMeaning,
  verdictTone,
  type PromotionResult,
} from '../model/promotionResult'

const signedMoney = (value: number) =>
  `${value >= 0 ? '+' : '−'}${formatMoney(Math.abs(Math.round(value)))}`

/**
 * Did the promotions make money?
 *
 * The screen that closes the loop the Promotions module opens: a promotion is
 * recorded as a decision precisely so it can be judged afterwards, and until
 * this existed nothing judged it.
 *
 * OX puts thirteen tiles at the top, of which «Эффект» and «Uplift %» are the
 * two that answer the question. Here the verdict is the first column and the
 * workings sit behind it.
 */
export default function PromotionReportPage() {
  const navigate = useNavigate()
  const [ran, setRan] = useState(false)
  const results = usePromotionReport(ran)

  const columns = useMemo<TableColumn<PromotionResult>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Promotion',
        enableHiding: false,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="text-fg truncate font-medium">{row.original.name}</p>
            <p className="text-fg-subtle text-2xs">
              {row.original.days === 0
                ? 'Has not run yet'
                : `${formatNumber(row.original.days)} days · ${formatNumber(row.original.uses)} sales used it`}
            </p>
          </div>
        ),
      },
      {
        accessorKey: 'verdict',
        header: 'Verdict',
        enableHiding: false,
        cell: ({ row }) => (
          <span title={verdictMeaning(row.original.verdict)}>
            <Badge tone={verdictTone(row.original.verdict)}>
              {verdictLabel(row.original.verdict)}
            </Badge>
          </span>
        ),
      },
      {
        id: 'netEffect',
        header: 'Margin vs before',
        meta: { align: 'right' },
        enableHiding: false,
        cell: ({ row }) => {
          if (row.original.before.sales === 0) {
            return <span className="text-fg-subtle">—</span>
          }
          const up = row.original.netEffect >= 0
          return (
            <div>
              <p className={`font-medium tabular-nums ${up ? 'text-success' : 'text-danger'}`}>
                {signedMoney(row.original.netEffect)}
              </p>
              <p className="text-fg-subtle text-2xs">
                {formatMoney(Math.round(row.original.during.margin))} vs{' '}
                {formatMoney(Math.round(row.original.before.margin))}
              </p>
            </div>
          )
        },
      },
      {
        id: 'discount',
        header: 'Given away',
        meta: { align: 'right' },
        enableHiding: false,
        cell: ({ row }) => (
          <div>
            <p className="text-fg tabular-nums">
              {formatMoney(Math.round(row.original.discountGiven))}
            </p>
            <p className="text-fg-subtle text-2xs tabular-nums">
              on {formatNumber(row.original.unitsDiscounted)} units
            </p>
          </div>
        ),
      },
      {
        id: 'uplift',
        header: 'Revenue uplift',
        meta: { align: 'right' },
        enableHiding: false,
        cell: ({ row }) => {
          if (row.original.upliftRatio === null) {
            return <span className="text-fg-subtle">No baseline</span>
          }
          const up = row.original.upliftRatio >= 0
          return (
            <div>
              <p className={`tabular-nums ${up ? 'text-success' : 'text-danger'}`}>
                {up ? '+' : '−'}
                {formatPercent(Math.abs(row.original.upliftRatio))}
              </p>
              <p className="text-fg-subtle text-2xs tabular-nums">
                {formatMoney(Math.round(row.original.during.revenue))} vs{' '}
                {formatMoney(Math.round(row.original.before.revenue))}
              </p>
            </div>
          )
        },
      },
      {
        id: 'reach',
        header: 'Reach',
        meta: { align: 'right' },
        cell: ({ row }) => (
          <div>
            <p className="text-fg tabular-nums">{formatNumber(row.original.during.sales)} sales</p>
            <p className="text-fg-subtle text-2xs tabular-nums">
              {formatNumber(row.original.during.clients)} clients ·{' '}
              {formatNumber(row.original.during.units)} units
            </p>
          </div>
        ),
      },
    ],
    [],
  )

  const totals = results
    ? {
        given: results.reduce((sum, r) => sum + r.discountGiven, 0),
        net: results
          .filter((r) => r.verdict === 'paid' || r.verdict === 'lost' || r.verdict === 'flat')
          .reduce((sum, r) => sum + r.netEffect, 0),
        paid: results.filter((r) => r.verdict === 'paid').length,
        lost: results.filter((r) => r.verdict === 'lost').length,
      }
    : null

  return (
    <>
      <PageHeader
        title="Promotions report"
        description="Whether each promotion made money. A discount costs what you gave away and earns whatever extra people bought because of it — this compares the two."
        action={
          <Button variant="primary" onClick={() => setRan(true)}>
            <Play />
            Run
          </Button>
        }
      />

      <FilterGate
        applied={ran && results !== null}
        title="Press Run to measure them"
        explanation="Each promotion is compared against the same number of days before it started, which means reading the whole sales ledger twice per campaign."
      >
        {results && totals ? (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <Card className="p-4">
                <p className="text-fg-muted text-sm">Given away</p>
                <p className="text-fg mt-0.5 text-lg font-semibold">
                  {formatMoney(Math.round(totals.given))}
                </p>
                <p className="text-fg-subtle text-2xs">in discounts across every promotion</p>
              </Card>
              <Card className="p-4">
                <p className="text-fg-muted text-sm">Margin against the baseline</p>
                <p
                  className={`mt-0.5 text-lg font-semibold ${
                    totals.net >= 0 ? 'text-success' : 'text-danger'
                  }`}
                >
                  {signedMoney(totals.net)}
                </p>
                <p className="text-fg-subtle text-2xs">
                  across the campaigns that can be judged yet
                </p>
              </Card>
              <Card className="p-4">
                <p className="text-fg-muted text-sm">Worth repeating</p>
                <p className="text-fg mt-0.5 text-lg font-semibold">
                  {formatNumber(totals.paid)} of {formatNumber(totals.paid + totals.lost)}
                </p>
                <p className="text-fg-subtle text-2xs">
                  paid for themselves; {formatNumber(totals.lost)} did not
                </p>
              </Card>
            </div>

            <Card>
              <CardBody className="text-fg-muted flex items-start gap-2.5 text-sm">
                <Info className="mt-0.5 size-4 shrink-0" />
                {/* Said plainly rather than buried, because the number is only
                    as good as the comparison behind it. */}
                <p>
                  Each promotion is measured against{' '}
                  <span className="text-fg font-medium">
                    the same number of days immediately before it started
                  </span>
                  , counting only the products it covered. That cannot separate the promotion from
                  anything else that changed in those weeks — a season, a competitor, a delivery
                  that never arrived. Treat it as the best available comparison, not proof.
                </p>
              </CardBody>
            </Card>

            <DataTable
              storageKey="promotion-report"
              columns={columns}
              data={results}
              total={results.length}
              isLoading={false}
              pagination={{ page: 1, pageSize: 50 }}
              onPaginationChange={() => {}}
              onRowClick={(result) => navigate(paths.marketing.editPromotion(result.promotionId))}
              emptyState={
                <EmptyState
                  icon={Tag}
                  title="No promotions to measure"
                  description="Set one up and this report will tell you afterwards whether it was worth running."
                  action={
                    <Button variant="secondary" asChild>
                      <Link to={paths.marketing.promotions}>Go to promotions</Link>
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
