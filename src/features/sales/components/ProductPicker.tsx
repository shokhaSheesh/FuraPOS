import { useEffect, useMemo, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { http } from '@/shared/lib/http'
import { Input } from '@/shared/ui/Input'
import { Skeleton } from '@/shared/ui/Skeleton'
import { ProductThumb } from '@/shared/components/ProductThumb'
import { cn } from '@/shared/lib/cn'
import { formatMoney, formatNumber } from '@/shared/lib/format'
import type { Paginated } from '@/shared/types'
import type { VariationRow } from '@/features/products/model/product'

/**
 * Searchable product picker. `Select` is for a short fixed list; a catalog of
 * thousands needs search, so this is a combobox: type, arrow through results,
 * Enter to add. Built to be reused by goods receipt and purchase orders.
 */
export function ProductPicker({ onPick }: { onPick: (variation: VariationRow) => void }) {
  const [term, setTerm] = useState('')
  const [debounced, setDebounced] = useState('')
  const [highlight, setHighlight] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(term.trim()), 250)
    return () => clearTimeout(timer)
  }, [term])

  const { data, isFetching } = useQuery({
    queryKey: ['variation-picker', debounced],
    queryFn: () =>
      http.get<Paginated<VariationRow>>('/variations', {
        search: debounced,
        pageSize: 8,
        status: 'active',
      }),
    enabled: debounced.length > 0,
  })

  const results = useMemo(() => data?.items ?? [], [data])
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

  const open = debounced.length > 0

  return (
    <div className="relative">
      <Search className="text-fg-subtle pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
      <Input
        ref={inputRef}
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Search a product by name, SKU or barcode to add it…"
        aria-label="Add a product"
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
                        product.stock > 0 ? 'text-fg-muted' : 'text-danger',
                      )}
                    >
                      {formatNumber(product.stock)} {product.unit}
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
