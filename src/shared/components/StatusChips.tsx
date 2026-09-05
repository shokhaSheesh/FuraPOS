import { cn } from '@/shared/lib/cn'

export interface StatusChip<T extends string> {
  value: T | null
  label: string
}

/**
 * A row of single-select filter chips, as OX uses above its sales table. The
 * first chip is always "All" (value null). Selection drives the URL, not local
 * state, so a filtered view stays shareable.
 */
export function StatusChips<T extends string>({
  options,
  value,
  onChange,
  ariaLabel = 'Filter by status',
}: {
  options: StatusChip<T>[]
  value: T | null
  onChange: (value: T | null) => void
  ariaLabel?: string
}) {
  return (
    <div role="group" aria-label={ariaLabel} className="flex flex-wrap items-center gap-1.5">
      {options.map((option) => {
        const active = value === option.value
        return (
          <button
            key={option.label}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-full border px-3 py-1 text-sm transition-colors',
              active
                ? 'border-primary-border bg-primary text-primary-fg font-medium'
                : 'border-border bg-surface text-fg-muted hover:text-fg hover:border-border-strong',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
