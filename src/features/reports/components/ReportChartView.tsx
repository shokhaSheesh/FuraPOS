import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useChartTheme } from '@/shared/lib/chart'
import { formatMoney, formatNumber, formatNumberCompact, formatPercent } from '@/shared/lib/format'
import {
  CHART_TOP_N,
  chartData,
  isTimeDimension,
  findDimension,
  findMeasure,
  type ReportChart,
  type ReportResult,
  type ReportSource,
} from '../model/report'

const TICK_FONT = 11

/**
 * The result, drawn.
 *
 * One series, never several: a report's measures are on different scales —
 * money beside a unit count — and putting them on one axis draws a comparison
 * that is not there. So the chart shows the measure that was chosen and the
 * table carries the rest.
 *
 * Colours come from the validated palette. A **single-series** chart uses the
 * gold slot, which is what that palette reserves it for — the tooltip and axis
 * labels supply the relief its sub-3:1 contrast needs. The categorical hues are
 * for the donut, where slices genuinely have to be told apart.
 *
 * Animation is off. It delays reading a number somebody asked for by pressing
 * Run, and it makes the chart impossible to verify in a screenshot.
 */
export function ReportChartView({
  source,
  dimension,
  measure,
  chart,
  result,
}: {
  source: ReportSource
  dimension: string
  measure: string
  chart: Exclude<ReportChart, 'none'>
  result: ReportResult
}) {
  const { series, brand, ink } = useChartTheme()
  const data = chartData(result, dimension, measure, chart)
  const format = findMeasure(source, measure)?.format ?? 'number'
  const measureLabel = findMeasure(source, measure)?.label ?? measure
  const dimensionLabel = findDimension(source, dimension)?.label ?? dimension

  const render = (value: number) =>
    format === 'money'
      ? formatMoney(Math.round(value))
      : format === 'percent'
        ? formatPercent(value)
        : formatNumber(Math.round(value))

  const tooltip = (
    <Tooltip
      cursor={{ fill: ink.grid, fillOpacity: 0.35 }}
      contentStyle={{
        background: ink.tooltipBg,
        border: `1px solid ${ink.grid}`,
        borderRadius: 8,
        fontSize: 12,
      }}
      formatter={(value) => [render(Number(value ?? 0)), measureLabel]}
    />
  )

  if (data.length === 0) {
    return (
      <p className="text-fg-subtle py-10 text-center text-sm">Nothing to draw in this period.</p>
    )
  }

  return (
    <div className="space-y-2">
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {chart === 'line' ? (
            <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
              <CartesianGrid stroke={ink.grid} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: ink.label, fontSize: TICK_FONT }}
                axisLine={{ stroke: ink.axis }}
                tickLine={false}
                minTickGap={20}
              />
              <YAxis
                tickFormatter={formatNumberCompact}
                tick={{ fill: ink.label, fontSize: TICK_FONT }}
                axisLine={false}
                tickLine={false}
                width={64}
              />
              {tooltip}
              {/* Straight segments, no dot on every point: the values are
                  discrete, and smoothing would draw numbers never measured. */}
              <Line
                type="linear"
                dataKey="value"
                stroke={brand}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          ) : chart === 'donut' ? (
            <PieChart>
              {tooltip}
              <Pie
                data={data}
                dataKey="value"
                nameKey="label"
                innerRadius="55%"
                outerRadius="80%"
                isAnimationActive={false}
              >
                {data.map((entry, index) => (
                  <Cell key={entry.label} fill={series[index % series.length]} />
                ))}
              </Pie>
            </PieChart>
          ) : (
            <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
              <CartesianGrid stroke={ink.grid} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: ink.label, fontSize: TICK_FONT }}
                axisLine={{ stroke: ink.axis }}
                tickLine={false}
                interval={0}
                angle={-30}
                textAnchor="end"
                height={64}
              />
              <YAxis
                tickFormatter={formatNumberCompact}
                tick={{ fill: ink.label, fontSize: TICK_FONT }}
                axisLine={false}
                tickLine={false}
                width={64}
              />
              {tooltip}
              <Bar dataKey="value" fill={brand} radius={[3, 3, 0, 0]} isAnimationActive={false} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      <p className="text-fg-subtle text-2xs">
        {measureLabel} by {dimensionLabel.toLowerCase()}
        {result.rows.length > CHART_TOP_N && !isTimeDimension(dimension)
          ? chart === 'donut'
            ? ` — top ${CHART_TOP_N}, the rest as "Other".`
            : ` — top ${CHART_TOP_N} of ${formatNumber(result.rows.length)}. The table below has them all.`
          : '.'}
      </p>
    </div>
  )
}
