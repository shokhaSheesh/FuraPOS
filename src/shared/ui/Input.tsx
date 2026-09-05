import type { InputHTMLAttributes } from 'react'
import { cn } from '@/shared/lib/cn'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'rounded-control border-border bg-surface text-fg h-9 w-full border px-3 text-sm',
        'placeholder:text-fg-subtle disabled:bg-surface-inset disabled:cursor-not-allowed',
        className,
      )}
      {...props}
    />
  )
}
