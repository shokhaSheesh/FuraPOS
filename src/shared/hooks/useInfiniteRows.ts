import { useCallback, useEffect, useMemo, useState } from 'react'

/**
 * Hands back the first slice of a long list and grows it as the reader nears
 * the end.
 *
 * For tables that *are* a catalogue — a supplier's whole price list on a goods
 * receipt, ours on a market order. Those run to hundreds of rows, every one
 * carrying an input and twenty columns, and rendering them all to show the
 * first twenty is slow for no one's benefit. Pagination would be worse: the
 * reader is scanning down a price list with an invoice in hand, and a page
 * break in the middle of it is a place to lose their line.
 *
 * Nothing is fetched — all the rows are already here — so this only decides
 * how many are drawn. Filtering therefore stays exact: a search matches rows
 * that have not been rendered yet, because it runs before this does.
 */
export function useInfiniteRows<T>(rows: T[], { step = 40 }: { step?: number } = {}) {
  const [limit, setLimit] = useState(step)
  /*
    The sentinel is held in state, not a ref, so the observer attaches the
    moment the node exists. With a ref the effect can run while the node is
    still null — and since nothing it depends on changes afterwards, it never
    runs again and the list simply stops growing.
  */
  const [sentinel, setSentinel] = useState<HTMLElement | null>(null)

  // A new filter is a new list, and picking up at row 300 of it would look
  // like the search had failed.
  const key = rows.length
  useEffect(() => setLimit(step), [key, step])

  const hasMore = limit < rows.length
  const showMore = useCallback(() => setLimit((current) => current + step), [step])

  useEffect(() => {
    if (!sentinel || !hasMore) return

    /*
      Both an observer and a scroll listener, deliberately.

      The observer is the efficient one, but it only reports against the
      viewport, and this table lives inside the layout's own scrolling element
      — so whether it ever fires depends on how the page is laid out around it.
      The rect check does not care: it asks the same question directly, off a
      capturing scroll listener that hears any ancestor scrolling. Whichever
      answers first wins, and `showMore` is idempotent enough that both can.

      The margin starts the next slice before the reader reaches the end, so
      scrolling stays continuous instead of stopping at each boundary.
    */
    const MARGIN = 600
    /*
      Throttled on the clock rather than on `requestAnimationFrame`. rAF is the
      usual choice and the tidier one, but it only runs when the browser is
      painting — and a tab that is not painting is exactly when this would
      silently stop growing, with no way to tell it apart from a bug.
    */
    let last = 0
    const check = () => {
      const now = Date.now()
      if (now - last < 100) return
      last = now
      if (sentinel.getBoundingClientRect().top <= window.innerHeight + MARGIN) showMore()
    }

    const observer = new IntersectionObserver(
      (entries) => entries.some((entry) => entry.isIntersecting) && showMore(),
      { rootMargin: `${MARGIN}px` },
    )
    observer.observe(sentinel)
    window.addEventListener('scroll', check, { capture: true, passive: true })
    window.addEventListener('resize', check, { passive: true })
    check()

    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', check, { capture: true })
      window.removeEventListener('resize', check)
    }
  }, [sentinel, hasMore, showMore])

  const visible = useMemo(() => rows.slice(0, limit), [rows, limit])
  return {
    visible,
    hasMore,
    shown: visible.length,
    total: rows.length,
    sentinel: setSentinel,
    showMore,
  }
}
