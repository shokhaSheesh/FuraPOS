import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft, Save, Table2 } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { Field } from '@/shared/components/Field'
import { EmptyState } from '@/shared/components/EmptyState'
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { Select } from '@/shared/ui/Select'
import { Switch } from '@/shared/ui/Switch'
import { Checkbox } from '@/shared/ui/Checkbox'
import { toast } from '@/shared/ui/toast'
import { cn } from '@/shared/lib/cn'
import { paths } from '@/shared/config/paths'
import { formatNumber } from '@/shared/lib/format'
import { usePreview, useReport, useReportActions } from '../api/reports'
import { ResultTable } from '../components/ResultTable'
import { ReportChartView } from '../components/ReportChartView'
import {
  REPORT_CHARTS,
  REPORT_PERIODS,
  REPORT_SOURCES,
  SOURCE_SCHEMAS,
  canChart,
  describeReport,
  isDerived,
  reportDraftSchema,
  type ReportChart,
  type ReportPeriod,
  type ReportSource,
} from '../model/report'

/** Enough to see the shape without turning the builder into the report. */
const PREVIEW_ROWS = 5

interface State {
  name: string
  source: ReportSource
  dimensions: string[]
  measures: string[]
  defaultPeriod: ReportPeriod
  chart: ReportChart
  chartMeasure: string | null
  pinned: boolean
}

/**
 * Building a report.
 *
 * **One screen, not OX's five-step wizard.** Their steps are: name it, pick
 * columns, sort and group, charts, finish — but sorting is a property of the
 * table, charts are a separate question, and "finish" is a button. What is left
 * is one real choice: what to measure and what to split it by. Splitting that
 * across five screens hides the only thing that matters, which is what the
 * answer looks like — so the preview sits beside the choice and moves with it.
 */
export default function ReportBuilderPage() {
  const { reportId } = useParams()
  const navigate = useNavigate()
  const { data: existing } = useReport(reportId)
  const actions = useReportActions()
  const editing = Boolean(reportId)

  const [state, setState] = useState<State>({
    name: '',
    source: 'sales',
    dimensions: ['product'],
    measures: ['revenue', 'units'],
    defaultPeriod: 'month',
    chart: 'bar',
    chartMeasure: null,
    pinned: false,
  })
  const [showErrors, setShowErrors] = useState(false)

  useEffect(() => {
    if (existing) {
      setState({
        name: existing.name,
        source: existing.source,
        dimensions: existing.dimensions,
        measures: existing.measures,
        defaultPeriod: existing.defaultPeriod,
        chart: existing.chart,
        chartMeasure: existing.chartMeasure,
        pinned: existing.pinned,
      })
    }
  }, [existing])

  const schema = SOURCE_SCHEMAS[state.source]
  // The first measure unless one was chosen, so the chart is never blank.
  const chartMeasure = state.chartMeasure ?? state.measures[0] ?? ''
  const preview = usePreview(state.source, state.dimensions, state.measures)
  const parsed = reportDraftSchema.safeParse(state)
  const errors = showErrors && !parsed.success ? parsed.error.flatten().fieldErrors : {}

  if (editing && !existing) {
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

  const toggle = (list: 'dimensions' | 'measures', key: string) =>
    setState((current) => ({
      ...current,
      [list]: current[list].includes(key)
        ? current[list].filter((entry) => entry !== key)
        : [...current[list], key],
    }))

  const changeSource = (source: ReportSource) =>
    setState((current) => ({
      ...current,
      source,
      // Columns belong to a source; keeping them would silently produce a
      // report full of blanks.
      dimensions: [],
      measures: [],
    }))

  const save = () => {
    setShowErrors(true)
    if (!parsed.success) {
      toast.error('Pick at least one thing to measure')
      return
    }
    if (editing && existing) {
      actions.update(existing.id, state)
      toast.success('Saved')
      navigate(paths.analytics.reportView(existing.id))
    } else {
      const created = actions.create(state)
      toast.success(`${created.name} saved`)
      navigate(paths.analytics.reportView(created.id))
    }
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
        title={editing ? 'Edit report' : 'New report'}
        description="Pick what to measure and what to break it down by. The preview underneath shows what you are building as you build it."
        action={
          <Button variant="primary" onClick={save}>
            <Save />
            {editing ? 'Save changes' : 'Save report'}
          </Button>
        }
      />

      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>The question</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            <Field label="Name" required error={errors.name?.[0]}>
              {(p) => (
                <Input
                  {...p}
                  placeholder="Sales by product"
                  value={state.name}
                  onChange={(event) => setState((c) => ({ ...c, name: event.target.value }))}
                />
              )}
            </Field>
            <Field label="Data" hint={REPORT_SOURCES.find((s) => s.value === state.source)?.hint}>
              {(p) => (
                <Select
                  {...p}
                  className="w-full"
                  value={state.source}
                  onChange={changeSource}
                  options={REPORT_SOURCES.map((entry) => ({
                    value: entry.value,
                    label: entry.label,
                  }))}
                />
              )}
            </Field>
            <Field label="Opens on" hint="The period it starts with. Changeable when you run it.">
              {(p) => (
                <Select
                  {...p}
                  className="w-full"
                  value={state.defaultPeriod}
                  onChange={(defaultPeriod) => setState((c) => ({ ...c, defaultPeriod }))}
                  options={REPORT_PERIODS}
                />
              )}
            </Field>
            <Field
              label="Chart"
              hint={
                canChart(state.dimensions)
                  ? REPORT_CHARTS.find((entry) => entry.value === state.chart)?.hint
                  : 'A chart needs exactly one break-down column — pick one and no more.'
              }
            >
              {(p) => (
                <Select
                  {...p}
                  className="w-full"
                  disabled={!canChart(state.dimensions)}
                  value={canChart(state.dimensions) ? state.chart : 'none'}
                  onChange={(chart) => setState((c) => ({ ...c, chart }))}
                  options={REPORT_CHARTS.map((entry) => ({
                    value: entry.value,
                    label: entry.label,
                  }))}
                />
              )}
            </Field>

            {state.chart !== 'none' && canChart(state.dimensions) ? (
              <Field
                label="Draw which measure"
                hint="One series only — measures are on different scales"
              >
                {(p) => (
                  <Select
                    {...p}
                    className="w-full"
                    value={chartMeasure}
                    onChange={(chartMeasure) => setState((c) => ({ ...c, chartMeasure }))}
                    options={state.measures.map((key) => ({
                      value: key,
                      label: schema.measures.find((m) => m.key === key)?.label ?? key,
                    }))}
                  />
                )}
              </Field>
            ) : null}

            <label className="flex items-center justify-between gap-3 pt-1">
              <span className="min-w-0">
                <span className="text-fg block text-sm font-medium">Pin to the sidebar</span>
                <span className="text-fg-subtle text-2xs">
                  For a report you run every week and should not have to find first.
                </span>
              </span>
              <Switch
                aria-label="Pin to the sidebar"
                checked={state.pinned}
                onCheckedChange={(pinned) => setState((c) => ({ ...c, pinned }))}
              />
            </label>
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex-col items-stretch gap-1">
            <CardTitle>Columns</CardTitle>
            <p className="text-fg-subtle text-2xs">
              <span className="text-fg-muted font-medium">Measure</span> is what gets added up.{' '}
              <span className="text-fg-muted font-medium">Break down by</span> is what each row
              stands for — leave it empty for a single total.
            </p>
          </CardHeader>
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <p className="text-fg-muted text-sm">
                Measure<span className="text-danger ml-0.5">*</span>
              </p>
              <div className="space-y-1">
                {schema.measures.map((measure) => (
                  <Row
                    key={measure.key}
                    label={measure.label}
                    hint={isDerived(measure.key) ? 'worked out, not summed' : undefined}
                    checked={state.measures.includes(measure.key)}
                    onToggle={() => toggle('measures', measure.key)}
                  />
                ))}
              </div>
              {errors.measures?.[0] ? (
                <p className="text-danger text-2xs">{errors.measures[0]}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <p className="text-fg-muted text-sm">Break down by</p>
              <div className="space-y-1">
                {schema.dimensions.map((dimension) => (
                  <Row
                    key={dimension.key}
                    label={dimension.label}
                    checked={state.dimensions.includes(dimension.key)}
                    onToggle={() => toggle('dimensions', dimension.key)}
                  />
                ))}
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-col items-stretch gap-1">
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Preview</CardTitle>
            {preview ? (
              <span className="text-fg-subtle text-2xs tabular-nums">
                {formatNumber(preview.rows.length)} rows from {formatNumber(preview.sourceRows)}{' '}
                records
              </span>
            ) : null}
          </div>
          <p className="text-fg-subtle text-2xs">
            {state.measures.length > 0
              ? `${describeReport({ ...state } as never)} — first ${PREVIEW_ROWS} rows, all time.`
              : 'Pick something to measure and it appears here.'}
          </p>
        </CardHeader>
        <CardBody>
          {preview && state.measures.length > 0 ? (
            <div className="space-y-4">
              {state.chart !== 'none' && canChart(state.dimensions) && chartMeasure ? (
                <ReportChartView
                  source={state.source}
                  dimension={state.dimensions[0]!}
                  measure={chartMeasure}
                  chart={state.chart}
                  result={preview}
                />
              ) : null}
              <ResultTable
                source={state.source}
                dimensions={state.dimensions}
                measures={state.measures}
                result={preview}
                limit={PREVIEW_ROWS}
              />
            </div>
          ) : (
            <EmptyState
              icon={Table2}
              title="Nothing to show yet"
              description="Tick a measure on the right and the table builds itself."
            />
          )}
        </CardBody>
      </Card>
    </>
  )
}

function Row({
  label,
  hint,
  checked,
  onToggle,
}: {
  label: string
  hint?: string
  checked: boolean
  onToggle: () => void
}) {
  return (
    <label
      className={cn(
        'rounded-control hover:bg-surface-inset flex cursor-pointer items-center gap-2 px-2 py-1.5 text-sm',
      )}
    >
      <Checkbox aria-label={label} checked={checked} onCheckedChange={onToggle} />
      <span className="text-fg min-w-0 flex-1 truncate">{label}</span>
      {hint ? <span className="text-fg-subtle text-2xs shrink-0">{hint}</span> : null}
    </label>
  )
}
