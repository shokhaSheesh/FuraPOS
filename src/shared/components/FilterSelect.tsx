import { Select as RadixSelect } from 'radix-ui'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/shared/lib/cn'
import type { SelectOption } from '@/shared/types'

/** Radix rejects an empty value, so "no filter" travels under a sentinel. */
const ALL = '__all'

/**
 * A dropdown that lives in a row of filter chips.
 *
 * `Select` is the form control: 36px tall, square-ish, the same shape as an
 * Input so a form lines up. Dropping one into a chip row reads as a foreign
 * object, so this wears the chip's shape instead — same pill, same height, same
 * filled state when it is doing something — and only the chevron says it opens.
 *
 * Use it where the choices are one-of-many or open-ended (locations, brands,
 * suppliers). Where there are two or three fixed states, use `StatusChips`:
 * options the user can see without clicking are always faster.
 */
export function FilterSelect<T extends string>({
  value,
  onChange,
  options,
  allLabel,
  label,
  'aria-label': ariaLabel,
}: {
  value: T | null
  onChange: (value: T | null) => void
  options: SelectOption<T>[]
  /** The unfiltered choice, e.g. "All locations". */
  allLabel: string
  /** Optional prefix shown when a value is picked, e.g. "Location". */
  label?: string
  'aria-label': string
}) {
  const active = value !== null
  const selected = options.find((option) => option.value === value)

  return (
    <RadixSelect.Root
      value={value ?? ALL}
      onValueChange={(next) => onChange(next === ALL ? null : (next as T))}
    >
      <RadixSelect.Trigger
        aria-label={ariaLabel}
        className={cn(
          // Deliberately the chip's geometry, not the form control's.
          'inline-flex items-center gap-1.5 rounded-full border py-1 pr-2 pl-3 text-sm transition-colors',
          active
            ? 'border-primary-border bg-primary text-primary-fg font-medium'
            : 'border-border bg-surface text-fg-muted hover:text-fg hover:border-border-strong',
        )}
      >
        {label && active ? <span className="opacity-70">{label}</span> : null}
        <span>{selected?.label ?? allLabel}</span>
        <ChevronDown className={cn('size-4', active ? 'opacity-70' : 'text-fg-subtle')} />
      </RadixSelect.Trigger>

      <RadixSelect.Portal>
        <RadixSelect.Content
          position="popper"
          sideOffset={6}
          align="start"
          className="rounded-control border-border bg-surface shadow-popover z-50 max-h-[min(18rem,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] overflow-y-auto border p-1"
        >
          <RadixSelect.Viewport>
            <SelectRow value={ALL} label={allLabel} />
            {options.map((option) => (
              <SelectRow key={option.value} value={option.value} label={option.label} />
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  )
}

function SelectRow({ value, label }: { value: string; label: string }) {
  return (
    <RadixSelect.Item
      value={value}
      className="rounded-control text-fg data-[highlighted]:bg-surface-muted flex cursor-pointer items-center gap-2 px-2 py-1.5 text-sm outline-none select-none"
    >
      <RadixSelect.ItemText>{label}</RadixSelect.ItemText>
      <RadixSelect.ItemIndicator className="ml-auto">
        <Check className="text-primary size-4" />
      </RadixSelect.ItemIndicator>
    </RadixSelect.Item>
  )
}
