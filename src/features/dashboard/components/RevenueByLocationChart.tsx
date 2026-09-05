import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Skeleton } from '@/shared/ui/Skeleton'
import { useChartTheme } from '@/shared/lib/chart'
import { formatDate, formatMoney, formatNumberCompact } from '@/shared/lib/format'
import type { DashboardSummary } from '../api/summary'

interface Props {
  data: DashboardSummary['revenueByLocation']
  locations: DashboardSummary['locations']
  loading?: boolean
}

/**
 * Revenue over time, one line per location.
 *
 * Deliberate choices, per the visualization rules: a single y-axis (never a
 * second scale), horizontal gridlines only, 2px lines with no dot on every
 * point, and a shared crosshair tooltip so exact values are always reachable —
 * which is also what supplies the "relief" the gold series needs, since it sits
 * below 3:1 against a white surface.
 */
export function RevenueByLocationChart({ data, locations, loading }: Props) {
  const { series, ink } = useChartTheme()

  if (loading) return <Skeleton className="h-72 w-full" />

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid stroke={ink.grid} strokeDasharray="0" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(value: string) =>
              new Date(value).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })
            }
            tick={{ fill: ink.label, fontSize: 11 }}
            axisLine={{ stroke: ink.axis }}
            tickLine={false}
            minTickGap={24}
          />
          <YAxis
            tickFormatter={(value: number) => formatNumberCompact(value)}
            tick={{ fill: ink.label, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={52}
          />
          <Tooltip
            cursor={{ stroke: ink.axis, strokeWidth: 1 }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              return (
                <div className="rounded-control border-border bg-surface shadow-popover border p-2.5">
                  <p className="text-fg-muted text-2xs mb-1.5">{formatDate(String(label))}</p>
                  {payload.map((entry) => (
                    <p key={String(entry.dataKey)} className="flex items-center gap-2 text-sm">
                      <span
                        aria-hidden
                        className="size-2 shrink-0 rounded-full"
                        style={{ background: entry.color }}
                      />
                      <span className="text-fg-muted flex-1">
                        {locations.find((l) => l.id === entry.dataKey)?.name}
                      </span>
                      <span className="text-fg font-medium tabular-nums">
                        {formatMoney(Number(entry.value))}
                      </span>
                    </p>
                  ))}
                </div>
              )
            }}
          />
          {locations.map((location, index) => (
            <Line
              key={location.id}
              type="monotone"
              dataKey={location.id}
              name={location.name}
              stroke={series[index % series.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

/**
 * Identity must never rest on colour alone, so the legend is always present for
 * two or more series and names each line in text. It also carries each series'
 * period total, so no value is reachable *only* by hovering the chart.
 */
export function ChartLegend({
  locations,
  data,
}: {
  locations: DashboardSummary['locations']
  data: DashboardSummary['revenueByLocation']
}) {
  const { series } = useChartTheme()
  const total = (id: string) => data.reduce((sum, row) => sum + Number(row[id] ?? 0), 0)

  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {locations.map((location, index) => (
        <li key={location.id} className="text-2xs flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-2 rounded-full"
            style={{ background: series[index % series.length] }}
          />
          <span className="text-fg-muted">{location.name}</span>
          <span className="text-fg font-medium tabular-nums">
            {formatMoney(total(location.id))}
          </span>
        </li>
      ))}
    </ul>
  )
}
