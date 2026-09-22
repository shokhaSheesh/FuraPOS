import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Maximize2, Package } from 'lucide-react'
import { Modal } from '@/shared/ui/Modal'
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
  /** The photo open full size, or null (client request: see it bigger, and the rest). */
  const [viewing, setViewing] = useState<number | null>(null)

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
        className="scroll-x-quiet flex size-full snap-x snap-mandatory [scrollbar-width:none] overflow-x-auto overscroll-x-contain [&::-webkit-scrollbar]:hidden"
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

      <button
        type="button"
        aria-label={t('View photos of {productName}', { productName: label })}
        title={t('Open full size')}
        onClick={() => setViewing(index)}
        className="bg-surface/90 text-fg shadow-card absolute top-1.5 right-1.5 flex size-7 items-center justify-center rounded-full opacity-0 transition-opacity group-hover/photos:opacity-100 focus-visible:opacity-100 [&_svg]:size-3.5"
      >
        <Maximize2 />
      </button>
      {viewing !== null ? (
        <PhotoViewer
          photos={photos}
          label={label}
          start={viewing}
          onClose={() => setViewing(null)}
        />
      ) : null}

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

/** A product's photos full size: one at a time, arrows and the keyboard to move, thumbnails to jump. */
function PhotoViewer({
  photos,
  label,
  start,
  onClose,
}: {
  photos: string[]
  label: string
  start: number
  onClose: () => void
}) {
  const [at, setAt] = useState(start)
  const go = (step: number) => setAt((current) => (current + step + photos.length) % photos.length)
  const many = photos.length > 1

  // ← and → wherever focus is in the dialog.
  useEffect(() => {
    if (!many) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') setAt((c) => (c - 1 + photos.length) % photos.length)
      if (event.key === 'ArrowRight') setAt((c) => (c + 1) % photos.length)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [many, photos.length])

  return (
    <Modal
      open
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={label}
      description={
        many ? t('Photo {at} of {count}', { at: at + 1, count: photos.length }) : undefined
      }
      size="xl"
      secondaryLabel={t('Close')}
    >
      <div className="space-y-3">
        <div className="bg-surface-inset rounded-card relative flex h-[min(34rem,62vh)] items-center justify-center overflow-hidden">
          <img src={photos[at]} alt="" className="max-h-full max-w-full object-contain" />
          {many ? (
            <>
              <button
                type="button"
                aria-label={t('Previous photo')}
                onClick={() => go(-1)}
                className="bg-surface/90 text-fg shadow-card absolute top-1/2 left-3 flex size-10 -translate-y-1/2 items-center justify-center rounded-full [&_svg]:size-5"
              >
                <ChevronLeft />
              </button>
              <button
                type="button"
                aria-label={t('Next photo')}
                onClick={() => go(1)}
                className="bg-surface/90 text-fg shadow-card absolute top-1/2 right-3 flex size-10 -translate-y-1/2 items-center justify-center rounded-full [&_svg]:size-5"
              >
                <ChevronRight />
              </button>
            </>
          ) : null}
        </div>
        {many ? (
          <div className="flex justify-center gap-2">
            {photos.map((src, index) => (
              <button
                key={src}
                type="button"
                aria-label={t('Photo {at} of {count}', { at: index + 1, count: photos.length })}
                aria-current={index === at ? 'true' : undefined}
                onClick={() => setAt(index)}
                className={cn(
                  'rounded-control h-14 w-20 overflow-hidden border-2 transition-colors',
                  index === at
                    ? 'border-primary'
                    : 'border-transparent opacity-70 hover:opacity-100',
                )}
              >
                <img src={src} alt="" className="size-full object-cover" />
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </Modal>
  )
}
