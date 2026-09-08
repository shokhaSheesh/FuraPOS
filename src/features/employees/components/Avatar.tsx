import { cn } from '@/shared/lib/cn'
import { initials } from '../model/employee'

const sizes = {
  sm: 'size-7 text-2xs',
  md: 'size-9 text-sm',
  lg: 'size-14 text-lg',
} as const

/**
 * A person's face, or their initials when there is no photo.
 *
 * Initials on a neutral ground rather than a colour picked from the name: a
 * colour that means nothing still reads as if it means something, and a staff
 * list is not the place to invent a taxonomy.
 */
export function Avatar({
  name,
  src,
  size = 'md',
  className,
}: {
  name: string
  src?: string | null
  size?: keyof typeof sizes
  className?: string
}) {
  return (
    <span
      className={cn(
        'bg-surface-inset text-fg-muted border-border flex shrink-0 items-center justify-center overflow-hidden rounded-full border font-medium',
        sizes[size],
        className,
      )}
    >
      {src ? (
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        <span aria-hidden>{initials(name)}</span>
      )}
    </span>
  )
}
