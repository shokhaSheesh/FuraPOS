import { useId, type ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'

/**
 * The form field shape from DESIGN_RULES § 7.3: label above the control,
 * required marked, helper or error beneath. The label is wired to the control
 * by id, so clicking it focuses the input.
 */
export function Field({
  label,
  required,
  error,
  hint,
  className,
  children,
}: {
  label: string
  required?: boolean
  error?: string
  hint?: string
  className?: string
  children: (props: { id: string; 'aria-invalid'?: boolean }) => ReactNode
}) {
  const id = useId()
  return (
    <div className={cn('space-y-1', className)}>
      <label htmlFor={id} className="text-fg-muted block text-sm">
        {label}
        {required ? <span className="text-danger ml-0.5">*</span> : null}
      </label>
      {children({ id, 'aria-invalid': error ? true : undefined })}
      {error ? (
        <p className="text-danger text-2xs">{error}</p>
      ) : hint ? (
        <p className="text-fg-subtle text-2xs">{hint}</p>
      ) : null}
    </div>
  )
}
