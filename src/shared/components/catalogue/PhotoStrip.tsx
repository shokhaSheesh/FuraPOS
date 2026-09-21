import { useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Package } from 'lucide-react'
import { cn } from '@/shared/lib/cn'
import { t } from '@/shared/i18n'

/**
 * A product's photos, swiped left and right (client request) — with a
 * trackpad or a finger natively, or with the arrows that show on hover. Dots
 * say how many there are and which is showing. A tap on a photo does what a
 * tap on the picture always did: opens the product.
 */
export function PhotoStrip({
  photos,
  label,
  onOpen,
  className,
  iconClassName = 'size-8',
}: {
  photos: string[]
  /** The product's name, for the buttons' names. */
  label: string
  onOpen: () => void
  className?: string
  iconClassName?: string
}) {
  const track = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)

  const go = (next: number) => {
    const el = track.current
    if (!el) return
    const to = (next + photos.length) % photos.length
    el.scrollTo({ left: to * el.clientWidth, behavior: 'smooth' })
  }

  if (photos.length === 0) {
    return (
      <button
        type="button"
        onClick={onOpen}
        aria-label={t('Open {productName}', { productName: label })}
        className={cn(
          'bg-surface-inset text-fg-subtle flex items-center justify-center',
          className,
        )}
      >
        <Package className={iconClassName} aria-hidden />
      </button>
    )
  }

  return (
    <div className={cn('group/photos bg-surface-inset relative overflow-hidden', className)}>
      <div
        ref={track}
        onScroll={(event) => {
          const el = event.currentTarget
          setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)))
        }}
        className="flex size-full snap-x snap-mandatory [scrollbar-width:none] overflow-x-auto overscroll-x-contain [&::-webkit-scrollbar]:hidden"
      >
        {photos.map((src, at) => (
          <button
            key={src}
            type="button"
            onClick={onOpen}
            aria-label={t('Open {productName}', { productName: label })}
            tabIndex={at === index ? 0 : -1}
            className="size-full shrink-0 snap-center"
          >
            <img src={src} alt="" draggable={false} className="size-full object-cover" />
          </button>
        ))}
      </div>

      {photos.length > 1 ? (
        <>
          {(
            [
              { step: -1, icon: <ChevronLeft />, side: 'left-1', name: t('Previous photo') },
              { step: 1, icon: <ChevronRight />, side: 'right-1', name: t('Next photo') },
            ] as const
          ).map((arrow) => (
            <button
              key={arrow.step}
              type="button"
              aria-label={arrow.name}
              onClick={() => go(index + arrow.step)}
              className={cn(
                'bg-surface/90 text-fg shadow-card absolute top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full opacity-0 transition-opacity group-hover/photos:opacity-100 focus-visible:opacity-100 [&_svg]:size-4',
                arrow.side,
              )}
            >
              {arrow.icon}
            </button>
          ))}
          <div className="pointer-events-none absolute inset-x-0 bottom-1.5 flex justify-center gap-1">
            {photos.map((src, at) => (
              <span
                key={src}
                className={cn(
                  'size-1.5 rounded-full transition-colors',
                  at === index ? 'bg-primary' : 'bg-surface/80',
                )}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}
