import { Select as RadixSelect } from 'radix-ui'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/shared/lib/cn'
import type { SelectOption } from '@/shared/types'

/**
 * Our dropdown. Same 36px control height, radius and border as Input so a
 * filter row lines up; the panel reuses the popover surface.
 */
export function Select<T extends string>({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  disabled,
  className,
  'aria-label': ariaLabel,
}: {
  value: T | undefined
  onChange: (value: T) => void
  options: SelectOption<T>[]
  placeholder?: string
  disabled?: boolean
  className?: string
  'aria-label'?: string
}) {
  return (
    <RadixSelect.Root value={value} onValueChange={(v) => onChange(v as T)} disabled={disabled}>
      <RadixSelect.Trigger
        aria-label={ariaLabel}
        className={cn(
          'rounded-control border-border bg-surface text-fg inline-flex h-9 items-center gap-2 border px-3 text-sm',
          'data-[placeholder]:text-fg-subtle hover:border-border-strong disabled:bg-surface-inset',
          'disabled:cursor-not-allowed',
          className,
        )}
      >
        <RadixSelect.Value placeholder={placeholder} />
        <RadixSelect.Icon className="text-fg-subtle ml-auto">
          <ChevronDown className="size-4" />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>

      <RadixSelect.Portal>
        <RadixSelect.Content
          position="popper"
          sideOffset={6}
          className="rounded-control border-border bg-surface shadow-popover z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden border p-1"
        >
          <RadixSelect.Viewport>
            {options.map((option) => (
              <RadixSelect.Item
                key={option.value}
                value={option.value}
                className="rounded-control text-fg data-[highlighted]:bg-surface-muted flex cursor-pointer items-center gap-2 px-2 py-1.5 text-sm outline-none select-none"
              >
                <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
                <RadixSelect.ItemIndicator className="ml-auto">
                  <Check className="text-primary size-4" />
                </RadixSelect.ItemIndicator>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  )
}
