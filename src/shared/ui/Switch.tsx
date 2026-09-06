import { Switch as RadixSwitch } from 'radix-ui'
import { cn } from '@/shared/lib/cn'

/**
 * An on/off toggle. Used where a boolean is edited in place — a table cell
 * that a user flips without opening anything — rather than for a form field
 * that is saved with the rest of a record.
 */
export function Switch({
  checked,
  onCheckedChange,
  disabled,
  'aria-label': ariaLabel,
  className,
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  'aria-label': string
  className?: string
}) {
  return (
    <RadixSwitch.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={ariaLabel}
      onClick={(event) => event.stopPropagation()}
      className={cn(
        'data-[state=checked]:bg-success data-[state=unchecked]:bg-border-strong',
        'relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50',
        className,
      )}
    >
      <RadixSwitch.Thumb className="block size-4 translate-x-0.5 rounded-full bg-white transition-transform data-[state=checked]:translate-x-[1.125rem]" />
    </RadixSwitch.Root>
  )
}
