import type { HTMLAttributes } from 'react'
import { cn } from '@/shared/lib/cn'
import type { Tone } from '@/shared/types'

const toneClasses: Record<Tone, string> = {
  neutral: 'bg-surface-inset text-fg-muted',
  primary: 'bg-primary-soft text-primary',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
}

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone
}

/**
 * Badges carry lifecycle or status meaning only — never decoration.
 * See CLAUDE.md: "New" for recently shipped, "Beta" for stabilizing.
 */
export function Badge({ tone = 'neutral', className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'text-2xs inline-flex items-center rounded-full px-2 py-0.5 font-medium',
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  )
}
