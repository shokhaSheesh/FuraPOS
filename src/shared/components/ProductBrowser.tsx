import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Plus, Search } from 'lucide-react'
import { Input } from '@/shared/ui/Input'
import { ProductThumb } from '@/shared/components/ProductThumb'
import { cn } from '@/shared/lib/cn'
import { formatNumber } from '@/shared/lib/format'
import { useDataStore } from '@/data/store'
import { matches } from '@/data/query'
import type { VariationRow } from '@/features/products/model/product'

/** How many rows are added each time the list is scrolled to its end. */
const PAGE = 25

/**
 * Browse the catalogue in place.
 *
 * A dropdown is the right shape when you already know what you are looking
 * for. Restocking a shop is the opposite: somebody picks a brand and wants to
 * *see what there is*, several items at a time, while the rows they have
 * already chosen stay visible underneath.
 *
 * So this sits in the page rather than floating over it — an overlay here
 * covered the very table the person was filling in — and it pages in more
 * rows as the list is scrolled rather than capping at a handful.
 */
export function ProductBrowser({
  filter,
  onPick,
  addedIds,
  stockLabel,
  disabled,
  emptyLabel = 'No products match',
}: {
  /** Category and brand, chosen above. Undefined shows the whole catalogue. */
  filter?: (variation: VariationRow) => boolean
  onPick: (variation: VariationRow) => void
  /** Rows already on the transfer, marked so nobody adds one twice by accident. */
  addedIds: string[]
  stockLabel: (variation: VariationRow) => { text: string; muted: boolean }
  disabled?: boolean
  emptyLabel?: string
}) {
  const variations = useDataStore((s) => s.variations)
  const [term, setTerm] = useState('')
  const [debounced, setDebounced] = useState('')
  const [visible, setVisible] = useState(PAGE)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(term.trim()), 200)
    return () => clearTimeout(timer)
  }, [term])

  const results = useMemo(
    () =>
      variations.filter(
        (v) =>
          v.status === 'active' &&
          (!filter || filter(v)) &&
          matches([v.fullName, v.sku, v.barcode, v.brandName, v.description], debounced),
      ),
    [variations, filter, debounced],
  )

  // A narrowed list starts from the top again; keeping the old offset would
  // show the middle of a list somebody has just changed.
  useEffect(() => {
    setVisible(PAGE)
    listRef.current?.scrollTo({ top: 0 })
  }, [debounced, filter])

  const shown = results.slice(0, visible)
  const added = new Set(addedIds)

  const onScroll = () => {
    const el = listRef.current
    if (!el) return
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 120) {
      setVisible((n) => (n >= results.length ? n : n + PAGE))
    }
  }

  return (
    <div className={cn('space-y-2', disabled && 'pointer-events-none opacity-50')}>
      <div className="relative">
        <Search className="text-fg-subtle pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        <Input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Search within these by name, SKU or barcode…"
          aria-label="Search products"
          disabled={disabled}
          className="pl-8"
        />
      </div>

      <div
        ref={listRef}
        onScroll={onScroll}
        className="border-border rounded-card max-h-72 overflow-y-auto border"
      >
        {shown.length === 0 ? (
          <p className="text-fg-muted p-4 text-center text-sm">{emptyLabel}</p>
        ) : (
          <ul className="divide-border divide-y">
            {shown.map((variation) => {
              const stock = stockLabel(variation)
              const already = added.has(variation.id)
              return (
                <li key={variation.id}>
                  <button
                    type="button"
                    onClick={() => onPick(variation)}
                    className="hover:bg-surface-muted flex w-full items-center gap-3 px-3 py-2 text-left text-sm"
                  >
                    <ProductThumb src={variation.imageUrl} size="sm" />
                    <span className="text-fg-subtle text-2xs w-24 shrink-0 font-mono">
                      {variation.sku}
                    </span>
                    <span className="text-fg min-w-0 flex-1 truncate">{variation.fullName}</span>
                    <span
                      className={cn(
                        'text-2xs shrink-0',
                        stock.muted ? 'text-fg-muted' : 'text-danger',
                      )}
                    >
                      {stock.text}
                    </span>
                    {/* Says what clicking does, and says when it has been done
                        — otherwise a second click reads as a mistake. */}
                    <span
                      className={cn(
                        'text-2xs flex w-16 shrink-0 items-center justify-end gap-1',
                        already ? 'text-success' : 'text-fg-subtle',
                      )}
                    >
                      {already ? (
                        <>
                          <Check className="size-3.5" />
                          Added
                        </>
                      ) : (
                        <>
                          <Plus className="size-3.5" />
                          Add
                        </>
                      )}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {results.length > 0 ? (
        <p className="text-fg-subtle text-2xs">
          Showing {formatNumber(Math.min(visible, results.length))} of{' '}
          {formatNumber(results.length)}
          {results.length > visible ? ' — scroll for more' : ''}
        </p>
      ) : null}
    </div>
  )
}
