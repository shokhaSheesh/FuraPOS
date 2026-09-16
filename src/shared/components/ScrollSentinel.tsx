import { Button } from '@/shared/ui/Button'
import { formatNumber } from '@/shared/lib/format'

/**
 * The strip under a table that keeps loading as you scroll.
 *
 * It says how far down a long list you are, because a table that simply never
 * ends gives a reader no idea whether they have seen ten of four hundred rows
 * or four hundred of four hundred. When everything is drawn it disappears
 * rather than announcing itself — "all 28 shown" is noise on a short list.
 */
export function ScrollSentinel({
  ref,
  hasMore,
  shown,
  total,
  onShowMore,
}: {
  ref: (node: HTMLElement | null) => void
  hasMore: boolean
  shown: number
  total: number
  onShowMore: () => void
}) {
  if (!hasMore) return null
  return (
    <div
      ref={ref}
      className="border-border text-fg-subtle flex flex-wrap items-center justify-center gap-3 border-t px-4 py-3 text-center text-sm"
    >
      Showing {formatNumber(shown)} of {formatNumber(total)}
      {/* Scrolling is the ordinary way through; the button is for when it is
          not — a keyboard, a screen reader, or a browser that has decided not
          to fire the observer. */}
      <Button variant="ghost" size="sm" onClick={onShowMore}>
        Show more
      </Button>
    </div>
  )
}
