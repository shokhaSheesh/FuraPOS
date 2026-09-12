import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Plus, Search } from 'lucide-react'
import { Input } from '@/shared/ui/Input'
import { Select } from '@/shared/ui/Select'
import { Badge } from '@/shared/ui/Badge'
import { cn } from '@/shared/lib/cn'
import { formatMoneyIn, formatNumber } from '@/shared/lib/format'
import { matches } from '@/data/query'
import type { CatalogueEntry } from '@/features/suppliers/model/catalogue'

/** How many rows are added each time the list is scrolled to its end. */
const PAGE = 25

const ANY = '__any__'

/**
 * Browse what this supplier sells.
 *
 * Ordering starts from their range rather than ours, so this lists their
 * catalogue — their code, their price — with our own numbers beside each line:
 * what we hold and what it has been selling. Those two are the reason to order
 * or not, and reading them here saves opening the product to find out.
 *
 * Sits in the page rather than in a dropdown, for the reason the transfer
 * screen found: somebody picking a category wants to *see the range*, several
 * rows at a time, with what they have already chosen still visible underneath.
 */
export function SupplierCatalogue({
  entries,
  onPick,
  addedIds,
  soldFor,
}: {
  entries: CatalogueEntry[]
  onPick: (entry: CatalogueEntry) => void
  /** Supplier-product ids already on the order, so nothing is added twice by accident. */
  addedIds: string[]
  /** Units sold across the business in the last three months. */
  soldFor: (entry: CatalogueEntry) => number
}) {
  const [term, setTerm] = useState('')
  const [debounced, setDebounced] = useState('')
  const [category, setCategory] = useState(ANY)
  const [brand, setBrand] = useState(ANY)
  const [visible, setVisible] = useState(PAGE)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(term.trim()), 200)
    return () => clearTimeout(timer)
  }, [term])

  const categories = useMemo(
    () => [...new Set(entries.map((e) => e.product.categoryName).filter(Boolean))].sort() as string[],
    [entries],
  )
  const brands = useMemo(
    () => [...new Set(entries.map((e) => e.product.brandName).filter(Boolean))].sort() as string[],
    [entries],
  )

  const results = useMemo(
    () =>
      entries.filter((entry) => {
        if (category !== ANY && entry.product.categoryName !== category) return false
        if (brand !== ANY && entry.product.brandName !== brand) return false
        return matches([entry.product.name, entry.product.supplierSku, entry.product.brandName], debounced)
      }),
    [entries, category, brand, debounced],
  )

  // A narrowed list starts from the top again; keeping the old offset would
  // show the middle of a list somebody has just changed.
  useEffect(() => {
    setVisible(PAGE)
    listRef.current?.scrollTo({ top: 0 })
  }, [debounced, category, brand])

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
    <div className="space-y-2">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-fg-muted mb-1 block text-sm">Category</label>
          <Select
            aria-label="Filter by category"
            className="w-full"
            value={category}
            onChange={setCategory}
            options={[
              { value: ANY, label: 'Any category' },
              ...categories.map((name) => ({ value: name, label: name })),
            ]}
          />
        </div>
        <div>
          <label className="text-fg-muted mb-1 block text-sm">Brand</label>
          <Select
            aria-label="Filter by brand"
            className="w-full"
            value={brand}
            onChange={setBrand}
            options={[
              { value: ANY, label: 'Any brand' },
              ...brands.map((name) => ({ value: name, label: name })),
            ]}
          />
        </div>
      </div>

      <div className="relative">
        <Search className="text-fg-subtle pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        <Input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Search their catalogue by name or their code…"
          aria-label="Search this supplier's catalogue"
          className="pl-8"
        />
      </div>

      <div
        ref={listRef}
        onScroll={onScroll}
        className="border-border rounded-card max-h-80 overflow-y-auto border"
      >
        {shown.length === 0 ? (
          <p className="text-fg-muted p-4 text-center text-sm">
            Nothing in their catalogue matches
          </p>
        ) : (
          <ul className="divide-border divide-y">
            {shown.map((entry) => {
              const already = added.has(entry.product.id)
              const sold = entry.variation ? soldFor(entry) : 0
              return (
                <li key={entry.product.id}>
                  <button
                    type="button"
                    onClick={() => onPick(entry)}
                    className="hover:bg-surface-muted flex w-full items-center gap-3 px-3 py-2 text-left text-sm"
                  >
                    <span className="text-fg-subtle text-2xs w-24 shrink-0 font-mono">
                      {entry.product.supplierSku}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="text-fg block truncate">{entry.product.name}</span>
                      <span className="text-fg-subtle text-2xs">
                        {entry.product.brandName ?? '—'} · {entry.product.categoryName ?? '—'}
                      </span>
                    </span>

                    {/* Their price, then our two numbers: what we hold and what
                        it sells. Those are what decide the order. */}
                    <span className="text-fg-muted w-24 shrink-0 text-right tabular-nums">
                      {formatMoneyIn(entry.product.price, entry.product.currency)}
                    </span>
                    <span className="w-28 shrink-0 text-right">
                      {entry.variation ? (
                        <>
                          <span
                            className={cn(
                              'text-2xs tabular-nums',
                              entry.stock === 0 ? 'text-danger' : 'text-fg-muted',
                            )}
                          >
                            {formatNumber(entry.stock)} in stock
                          </span>
                          <span className="text-fg-subtle text-2xs block tabular-nums">
                            sold {formatNumber(sold)} in 3m
                          </span>
                        </>
                      ) : (
                        // Orderable, but nothing can be said about it yet.
                        <Badge tone="info">New to us</Badge>
                      )}
                    </span>

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
          Showing {formatNumber(Math.min(visible, results.length))} of {formatNumber(results.length)}
          {results.length > visible ? ' — scroll for more' : ''}
        </p>
      ) : null}
    </div>
  )
}
