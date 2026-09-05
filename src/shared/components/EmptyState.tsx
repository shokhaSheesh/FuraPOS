import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Inbox } from 'lucide-react'
import { cn } from '@/shared/lib/cn'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center gap-3 px-6 py-16 text-center', className)}>
      <div className="bg-surface-inset text-fg-subtle flex size-11 items-center justify-center rounded-full">
        <Icon className="size-5" />
      </div>
      <div className="space-y-1">
        <p className="text-fg text-sm font-medium">{title}</p>
        {description ? <p className="text-fg-muted max-w-sm text-sm">{description}</p> : null}
      </div>
      {action}
    </div>
  )
}
