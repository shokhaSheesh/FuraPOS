import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  description?: string
  /** The single primary action, rendered top-right. See CLAUDE.md. */
  action?: ReactNode
  /** Tabs or segmented control sitting under the title. */
  below?: ReactNode
}

export function PageHeader({ title, description, action, below }: PageHeaderProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-fg text-lg font-semibold tracking-tight">{title}</h1>
          {description ? <p className="text-fg-muted text-sm">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {below}
    </div>
  )
}
