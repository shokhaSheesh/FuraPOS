import { formatMoney, formatNumber, formatPercent } from '@/shared/lib/format'
import { findDimension, findMeasure, type ReportResult, type ReportSource } from '../model/report'

const render = (value: number, format: 'money' | 'number' | 'percent') => {
  if (format === 'money') return formatMoney(Math.round(value))
  if (format === 'percent') return formatPercent(value)
  return formatNumber(Math.round(value))
}

/**
 * The result of a report.
 *
 * Dimensions on the left, measures right-aligned on the right, and a totals
 * row pinned at the bottom — a report without a total makes the reader add the
 * column up themselves, which is the one thing a computer was for.
 *
 * The totals row deliberately shows derived columns too: a margin % across the
 * whole report is a real number, worked out from the report's own totals rather
 * than by averaging the rows.
 */
export function ResultTable({
  source,
  dimensions,
  measures,
  result,
  limit,
}: {
  source: ReportSource
  dimensions: string[]
  measures: string[]
  result: ReportResult
  /** Preview mode: show the first few rows only, and say so. */
  limit?: number
}) {
  const rows = limit ? result.rows.slice(0, limit) : result.rows

  return (
    <div className="border-border rounded-card overflow-x-auto border">
      <table className="w-full text-sm">
        <thead className="bg-canvas">
          <tr className="text-fg-muted text-2xs tracking-wide uppercase">
            {dimensions.map((key) => (
              <th key={key} className="px-3 py-2 text-left font-semibold">
                {findDimension(source, key)?.label ?? key}
              </th>
            ))}
            {dimensions.length === 0 ? (
              <th className="px-3 py-2 text-left font-semibold">Everything</th>
            ) : null}
            {measures.map((key) => (
              <th key={key} className="px-3 py-2 text-right font-semibold">
                {findMeasure(source, key)?.label ?? key}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-border hover:bg-surface-inset/40 border-t">
              {dimensions.map((key) => (
                <td key={key} className="text-fg px-3 py-2">
                  {row.dims[key]}
                </td>
              ))}
              {dimensions.length === 0 ? (
                <td className="text-fg-muted px-3 py-2">All rows</td>
              ) : null}
              {measures.map((key) => (
                <td key={key} className="text-fg px-3 py-2 text-right tabular-nums">
                  {render(row.values[key] ?? 0, findMeasure(source, key)?.format ?? 'number')}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={Math.max(1, dimensions.length) + measures.length}
                className="text-fg-subtle px-3 py-8 text-center"
              >
                Nothing in this period.
              </td>
            </tr>
          ) : null}
        </tbody>
        {rows.length > 0 ? (
          <tfoot className="bg-canvas">
            <tr className="border-border border-t">
              <td
                colSpan={Math.max(1, dimensions.length)}
                className="text-fg-muted px-3 py-2 font-medium"
              >
                {limit && result.rows.length > limit
                  ? `Total across all ${formatNumber(result.rows.length)} rows`
                  : 'Total'}
              </td>
              {measures.map((key) => (
                <td key={key} className="text-fg px-3 py-2 text-right font-semibold tabular-nums">
                  {render(result.totals[key] ?? 0, findMeasure(source, key)?.format ?? 'number')}
                </td>
              ))}
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  )
}
