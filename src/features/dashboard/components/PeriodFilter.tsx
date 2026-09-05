import { cn } from '@/shared/lib/cn'
import { DateRangePicker, type DateRange } from '@/shared/ui/DateRangePicker'
import type { DashboardPeriod } from '../api/summary'

const OPTIONS: { value: Exclude<DashboardPeriod, 'custom'>; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
]

/**
 * One period control for the whole dashboard. OX bakes the period into each
 * card's title ("Turnover today" beside "Visitors this week"), which makes the
 * row impossible to read as a set; here every widget answers the same question.
 *
 * "Custom" is a segment like the others: selecting a range switches to it, and
 * picking any preset segment clears it.
 */
export function PeriodFilter({
  period,
  range,
  onChange,
}: {
  period: DashboardPeriod
  range: DateRange
  onChange: (period: DashboardPeriod, range: DateRange) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        role="group"
        aria-label="Period"
        className="border-border bg-surface rounded-control inline-flex border p-0.5"
      >
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={period === option.value}
            onClick={() => onChange(option.value, { from: null, to: null })}
            className={cn(
              'rounded-[5px] px-3 py-1 text-sm font-medium transition-colors',
              period === option.value
                ? 'bg-primary text-primary-fg'
                : 'text-fg-muted hover:text-fg',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <DateRangePicker
        value={range}
        onChange={(next) => onChange('custom', next)}
        className={cn(
          'h-8',
          period === 'custom' && 'border-primary-border bg-primary-soft text-fg',
        )}
      />
    </div>
  )
}
