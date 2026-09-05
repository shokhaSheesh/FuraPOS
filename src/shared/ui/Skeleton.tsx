import type { HTMLAttributes } from 'react'
import { cn } from '@/shared/lib/cn'

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('bg-surface-inset animate-pulse rounded', className)} {...props} />
}
