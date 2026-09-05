import { cn } from '@/shared/lib/cn'
import type { DashboardPeriod } from '../api/summary'

const OPTIONS: { value: DashboardPeriod; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
]

/**
 * One period control for the whole dashboard. OX bakes the period into each
 * card's title ("Turnover today" next to "Visitors this week"), which makes the
 * row impossible to read as a set; here every widget answers the same question.
 */
export function PeriodFilter({
  value,
  onChange,
}: {
  value: DashboardPeriod
  onChange: (next: DashboardPeriod) => void
}) {
  return (
    <div
      role="group"
      aria-label="Period"
      className="border-border bg-surface rounded-control inline-flex border p-0.5"
    >
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'rounded-[5px] px-3 py-1 text-sm font-medium transition-colors',
            value === option.value ? 'bg-primary text-primary-fg' : 'text-fg-muted hover:text-fg',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
