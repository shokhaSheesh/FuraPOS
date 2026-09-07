import { Checkbox as RadixCheckbox } from 'radix-ui'
import { Check, Minus } from 'lucide-react'
import { cn } from '@/shared/lib/cn'

/**
 * A checkbox, for including or excluding a row from a set — distinct from
 * `Switch`, which turns a setting on or off. Supports the indeterminate state
 * a "select all" header needs when only some rows are checked.
 */
export function Checkbox({
  checked,
  onCheckedChange,
  disabled,
  'aria-label': ariaLabel,
  className,
}: {
  checked: boolean | 'indeterminate'
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  'aria-label': string
  className?: string
}) {
  return (
    <RadixCheckbox.Root
      checked={checked}
      onCheckedChange={(next) => onCheckedChange(next === true)}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        'border-border-strong grid size-4 shrink-0 place-items-center rounded-[0.25rem] border transition-colors',
        'data-[state=checked]:border-fg data-[state=checked]:bg-fg',
        'data-[state=indeterminate]:border-fg data-[state=indeterminate]:bg-fg',
        'disabled:opacity-50',
        className,
      )}
    >
      <RadixCheckbox.Indicator className="text-fg-inverted grid place-items-center">
        {checked === 'indeterminate' ? <Minus className="size-3" /> : <Check className="size-3" />}
      </RadixCheckbox.Indicator>
    </RadixCheckbox.Root>
  )
}
