import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft, Pencil, Play } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState'
import { FilterGate } from '@/shared/components/FilterGate'
import { Card, CardBody } from '@/shared/ui/Card'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Select } from '@/shared/ui/Select'
import { useSession } from '@/app/providers/SessionProvider'
import { paths } from '@/shared/config/paths'
import { formatNumber } from '@/shared/lib/format'
import { useReport, useRunReport } from '../api/reports'
import { ResultTable } from '../components/ResultTable'
import { ReportChartView } from '../components/ReportChartView'
import {
  REPORT_PERIODS,
  canChart,
  describeReport,
  sourceLabel,
  type ReportPeriod,
} from '../model/report'

/**
 * Running a saved report.
 *
 * Gated behind Run, as OX gates theirs and as CLAUDE.md requires: a report
 * walks the whole sales ledger, and doing that on every navigation — including
 * the navigations where somebody only wanted to check the name — is work
 * nobody asked for.
 */
export default function ReportViewPage() {
  const { reportId } = useParams()
  const { can } = useSession()
  const { data: report } = useReport(reportId)
  const [period, setPeriod] = useState<ReportPeriod | null>(null)
  const [ran, setRan] = useState(false)

  const active = period ?? report?.defaultPeriod ?? 'month'
  const result = useRunReport(report, active, ran)

  if (!report) {
    return (
      <EmptyState
        title="No such report"
        action={
          <Button variant="secondary" asChild>
            <Link to={paths.analytics.reports}>Back to reports</Link>
          </Button>
        }
      />
    )
  }

  return (
    <>
      <Button variant="link" size="sm" className="h-auto px-0" asChild>
        <Link to={paths.analytics.reports}>
          <ArrowLeft />
          Report generator
        </Link>
      </Button>

      <PageHeader
        title={report.name}
        description={describeReport(report)}
        action={
          <div className="flex items-center gap-2">
            <Select
              aria-label="Period"
              className="w-44"
              value={active}
              onChange={(next) => {
                setPeriod(next)
                // Changing the period invalidates what is on screen; showing
                // last month's numbers under this month's label would be worse
                // than showing nothing.
                setRan(false)
              }}
              options={REPORT_PERIODS}
            />
            <Button variant="primary" onClick={() => setRan(true)}>
              <Play />
              Run
            </Button>
            {can('analytics.reportBuilder.edit') ? (
              <Button variant="secondary" asChild>
                <Link to={paths.analytics.editReport(report.id)}>
                  <Pencil />
                  Edit
                </Link>
              </Button>
            ) : null}
          </div>
        }
        below={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="info">{sourceLabel(report.source)}</Badge>
            {report.pinned ? <Badge tone="neutral">Pinned</Badge> : null}
            {result ? (
              <span className="text-fg-subtle text-2xs tabular-nums">
                {formatNumber(result.rows.length)} rows from {formatNumber(result.sourceRows)}{' '}
                records
              </span>
            ) : null}
          </div>
        }
      />

      <FilterGate
        applied={ran && result !== null}
        title="Choose a period, then press Run"
        explanation="Reports read every record in the period, so this one waits until you press Run."
      >
        {result ? (
          <div className="space-y-3">
            {report.chart !== 'none' && canChart(report.dimensions) ? (
              // The shape first, the numbers under it — a hundred rows of
              // figures hide a trend that one glance at a chart gives away.
              <Card>
                <CardBody>
                  <ReportChartView
                    source={report.source}
                    dimension={report.dimensions[0]!}
                    measure={report.chartMeasure ?? report.measures[0]!}
                    chart={report.chart}
                    result={result}
                  />
                </CardBody>
              </Card>
            ) : null}
            <Card>
              <CardBody>
                <ResultTable
                  source={report.source}
                  dimensions={report.dimensions}
                  measures={report.measures}
                  result={result}
                />
              </CardBody>
            </Card>
          </div>
        ) : null}
      </FilterGate>
    </>
  )
}
