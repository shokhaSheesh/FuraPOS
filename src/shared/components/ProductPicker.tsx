import { useEffect, useMemo, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/shared/ui/Input'
import { Skeleton } from '@/shared/ui/Skeleton'
import { ProductThumb } from '@/shared/components/ProductThumb'
import { cn } from '@/shared/lib/cn'
import { formatMoney, formatNumber } from '@/shared/lib/format'
import { useDataStore } from '@/data/store'
import { matches } from '@/data/query'
import type { VariationRow } from '@/features/products/model/product'

/**
 * Searchable product picker. `Select` is for a short fixed list; a catalog of
 * thousands needs search, so this is a combobox: type, arrow through results,
 * Enter to add. Shared, because sales, transfers, goods receipt and purchase
 * orders all begin the same way — by finding a variation.
 *
 * `stockLabel` lets the caller say which quantity matters: a sale cares about
 * the total, a transfer only about the shelf the goods are leaving.
 */
export function ProductPicker({
  onPick,
  placeholder = 'Search a product by name, SKU or barcode to add it…',
  stockLabel,
  disabled,
}: {
  onPick: (variation: VariationRow) => void
  placeholder?: string
  /** Overrides the right-hand quantity shown against each result. */
  stockLabel?: (variation: VariationRow) => { text: string; muted: boolean }
  disabled?: boolean
}) {
  const [term, setTerm] = useState('')
  const [debounced, setDebounced] = useState('')
  const [highlight, setHighlight] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(term.trim()), 250)
    return () => clearTimeout(timer)
  }, [term])

  const variations = useDataStore((s) => s.variations)
  const isFetching = false

  const results = useMemo(() => {
    if (!debounced) return []
    return variations
      .filter(
        (v) =>
          v.status === 'active' &&
          matches([v.fullName, v.sku, v.barcode, v.brandName, v.description], debounced),
      )
      .slice(0, 8)
  }, [variations, debounced])
  useEffect(() => setHighlight(0), [debounced])

  const add = (product: VariationRow) => {
    onPick(product)
    setTerm('')
    setDebounced('')
    inputRef.current?.focus()
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!results.length) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlight((i) => (i + 1) % results.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlight((i) => (i - 1 + results.length) % results.length)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const product = results[highlight]
      if (product) add(product)
    } else if (event.key === 'Escape') {
      setTerm('')
      setDebounced('')
    }
  }

  const open = debounced.length > 0 && !disabled

  return (
    <div className="relative">
      <Search className="text-fg-subtle pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
      <Input
        ref={inputRef}
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-label="Add a product"
        disabled={disabled}
        className="pl-8"
      />

      {open ? (
        <div className="rounded-control border-border bg-surface shadow-popover absolute z-20 mt-1 w-full overflow-hidden border">
          {isFetching && !results.length ? (
            <div className="space-y-2 p-3">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : results.length === 0 ? (
            <p className="text-fg-muted p-3 text-sm">
              Nothing matches “{debounced}”. Check the spelling, or add the product first.
            </p>
          ) : (
            <ul>
              {results.map((product, index) => (
                <li key={product.id}>
                  <button
                    type="button"
                    onMouseEnter={() => setHighlight(index)}
                    onClick={() => add(product)}
                    className={cn(
                      'flex w-full items-center gap-3 px-3 py-2 text-left text-sm',
                      index === highlight && 'bg-surface-muted',
                    )}
                  >
                    <ProductThumb src={product.imageUrl} size="sm" />
                    <span className="text-fg-subtle text-2xs w-20 shrink-0 font-mono">
                      {product.sku}
                    </span>
                    <span className="text-fg min-w-0 flex-1 truncate">{product.fullName}</span>
                    <span
                      className={cn(
                        'text-2xs shrink-0',
                        (stockLabel ? stockLabel(product).muted : product.stock > 0)
                          ? 'text-fg-muted'
                          : 'text-danger',
                      )}
                    >
                      {stockLabel
                        ? stockLabel(product).text
                        : `${formatNumber(product.stock)} ${product.unit}`}
                    </span>
                    <span className="text-fg w-28 shrink-0 text-right font-medium tabular-nums">
                      {formatMoney(product.salePrice)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}
