import type { InputHTMLAttributes } from 'react'
import { cn } from '@/shared/lib/cn'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-9 w-full rounded-control border border-border bg-surface px-3 text-sm text-fg',
        'placeholder:text-fg-subtle disabled:cursor-not-allowed disabled:bg-surface-inset',
        className,
      )}
      {...props}
    />
  )
}
