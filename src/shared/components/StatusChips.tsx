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
  counts,
  ariaLabel = 'Filter by status',
}: {
  options: StatusChip<T>[]
  value: T | null
  onChange: (value: T | null) => void
  /** Keyed by chip value, with `all` for the first chip. Optional. */
  counts?: Record<string, number>
  ariaLabel?: string
}) {
  return (
    <div role="group" aria-label={ariaLabel} className="flex flex-wrap items-center gap-1.5">
      {options.map((option) => {
        const active = value === option.value
        // A missing key means none, not unknown — so every chip shows a
        // number and an empty status reads as empty rather than as a gap.
        const count = counts ? (counts[option.value ?? 'all'] ?? 0) : undefined
        return (
          <button
            key={option.label}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-full border py-1 text-sm transition-colors',
              count === undefined ? 'px-3' : 'pr-2 pl-3',
              active
                ? 'border-primary-border bg-primary text-primary-fg font-medium'
                : 'border-border bg-surface text-fg-muted hover:text-fg hover:border-border-strong',
            )}
          >
            {option.label}
            {count === undefined ? null : (
              <span
                className={cn(
                  'text-2xs ml-1.5 inline-block rounded-full px-1.5 tabular-nums',
                  active
                    ? 'bg-primary-fg/15 text-primary-fg'
                    : count === 0
                      ? 'text-fg-subtle'
                      : 'bg-surface-inset text-fg',
                )}
              >
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
