import type { ReactNode } from 'react'
import { Popover as RadixPopover } from 'radix-ui'
import { cn } from '@/shared/lib/cn'

/**
 * The one overlay surface. Dropdowns, pickers and any other floating panel sit
 * on this so they share a border, radius, shadow and offset — see
 * docs/DESIGN_RULES.md § 11. Never hand-roll a floating div.
 */
export function Popover({
  trigger,
  children,
  open,
  onOpenChange,
  align = 'start',
  className,
}: {
  trigger: ReactNode
  children: ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  align?: 'start' | 'center' | 'end'
  className?: string
}) {
  return (
    <RadixPopover.Root open={open} onOpenChange={onOpenChange}>
      <RadixPopover.Trigger asChild>{trigger}</RadixPopover.Trigger>
      <RadixPopover.Portal>
        <RadixPopover.Content
          align={align}
          sideOffset={6}
          collisionPadding={12}
          className={cn(
            'rounded-card border-border bg-surface shadow-popover z-50 border',
            'origin-[--radix-popover-content-transform-origin]',
            className,
          )}
        >
          {children}
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  )
}

export const PopoverClose = RadixPopover.Close
