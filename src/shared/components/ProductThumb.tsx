import { Package } from 'lucide-react'
import { cn } from '@/shared/lib/cn'

const sizes = {
  sm: 'size-8',
  md: 'size-10',
  lg: 'size-14',
} as const

/**
 * A product's picture, with a fallback for the (common) case of no photo.
 *
 * The fallback is a neutral tile rather than a colour generated from the SKU:
 * invented hues would sit outside the token palette and, worse, read as
 * meaning — a green tile next to a red one implies a status that is not there.
 */
export function ProductThumb({
  src,
  size = 'md',
  className,
}: {
  src: string | null | undefined
  /**
   * Intentionally no alt text: the thumbnail always sits beside the product
   * name, so describing it again is noise for a screen reader.
   */
  size?: keyof typeof sizes
  className?: string
}) {
  const base = cn(
    sizes[size],
    'rounded-control border-border shrink-0 overflow-hidden border',
    className,
  )

  if (!src) {
    return (
      <span
        aria-hidden
        className={cn(base, 'bg-surface-inset text-fg-subtle flex items-center justify-center')}
      >
        <Package className={size === 'sm' ? 'size-3.5' : 'size-4'} />
      </span>
    )
  }

  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      className={cn(base, 'bg-surface-inset object-cover')}
      // A broken URL falls back to the neutral tile rather than a torn icon.
      onError={(event) => {
        event.currentTarget.style.display = 'none'
      }}
    />
  )
}
