import { cn } from '@/shared/lib/cn'

/**
 * A two-or-three way switch for a choice that changes what the rest of the form
 * asks for. Used instead of a Select because the options must both be readable
 * at a glance — the user is picking a shape of form, not filling in a value.
 */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  'aria-label': ariaLabel,
}: {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string }[]
  'aria-label': string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="border-border bg-canvas rounded-control inline-flex border p-0.5"
    >
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-control px-3 py-1 text-sm transition-colors',
              selected
                ? 'bg-surface text-fg shadow-card font-medium'
                : 'text-fg-muted hover:text-fg',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
