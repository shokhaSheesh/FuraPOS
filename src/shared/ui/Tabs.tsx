import type { ReactNode } from 'react'
import { Tabs as RadixTabs } from 'radix-ui'
import { cn } from '@/shared/lib/cn'

export interface TabItem {
  value: string
  label: string
  /** Rendered after the label — a count, usually. */
  badge?: ReactNode
  content: ReactNode
}

/**
 * Section tabs on a detail page. An underline rather than a filled pill, so
 * tabs never compete with the one yellow primary action above them
 * (docs/DESIGN_RULES.md § 6).
 */
export function Tabs({
  items,
  value,
  onValueChange,
  className,
}: {
  items: TabItem[]
  value?: string
  onValueChange?: (value: string) => void
  className?: string
}) {
  return (
    <RadixTabs.Root
      defaultValue={items[0]?.value}
      value={value}
      onValueChange={onValueChange}
      className={cn('space-y-4', className)}
    >
      <RadixTabs.List className="border-border flex items-center gap-1 border-b">
        {items.map((item) => (
          <RadixTabs.Trigger
            key={item.value}
            value={item.value}
            className={cn(
              'text-fg-muted hover:text-fg -mb-px flex items-center gap-2 border-b-2 border-transparent px-3 py-2 text-sm font-medium',
              'data-[state=active]:border-primary data-[state=active]:text-fg',
            )}
          >
            {item.label}
            {item.badge}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>

      {items.map((item) => (
        <RadixTabs.Content key={item.value} value={item.value} className="outline-none">
          {item.content}
        </RadixTabs.Content>
      ))}
    </RadixTabs.Root>
  )
}
