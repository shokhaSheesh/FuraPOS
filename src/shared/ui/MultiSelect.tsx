import { useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Package, Search, X } from 'lucide-react'
import { Popover } from './Popover'
import { Checkbox } from './Checkbox'
import { Button } from './Button'
import { cn } from '@/shared/lib/cn'
import type { SelectOption } from '@/shared/types'

export interface MultiSelectOption<T extends string> extends SelectOption<T> {
  /**
   * A second line under the label — an SKU, a code, whatever tells two
   * similarly named things apart. **Searched as well as the label**, so typing
   * a part number finds the row.
   */
  meta?: string
  /** Shown as a thumbnail. Null renders the same neutral tile as the catalogue. */
  imageUrl?: string | null
}

/**
 * A dropdown that picks several things, with a search box inside it.
 *
 * The search is a way through a long list, not a filter on the selection: what
 * is already chosen stays chosen while you type, and the summary on the closed
 * control keeps naming it. A picker that quietly drops selections when the
 * search term stops matching them is the classic way this control goes wrong.
 *
 * Selected options are pinned to the top of the open panel, so "what have I
 * chosen" never requires scrolling back through a hundred rows.
 */
export function MultiSelect<T extends string>({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyLabel = 'Nothing matches',
  disabled,
  className,
  'aria-label': ariaLabel,
}: {
  value: T[]
  onChange: (value: T[]) => void
  options: MultiSelectOption<T>[]
  placeholder?: string
  searchPlaceholder?: string
  emptyLabel?: string
  disabled?: boolean
  className?: string
  'aria-label'?: string
}) {
  const [open, setOpen] = useState(false)
  const [term, setTerm] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const chosen = useMemo(() => new Set(value), [value])

  const visible = useMemo(() => {
    const needle = term.trim().toLowerCase()
    const matching = needle
      ? options.filter(
          (option) =>
            option.label.toLowerCase().includes(needle) ||
            option.meta?.toLowerCase().includes(needle),
        )
      : options
    // Chosen first, so the selection is always visible without scrolling.
    return [...matching].sort((a, b) => Number(chosen.has(b.value)) - Number(chosen.has(a.value)))
  }, [options, term, chosen])

  const toggle = (option: T) =>
    onChange(chosen.has(option) ? value.filter((v) => v !== option) : [...value, option])

  const summary =
    value.length === 0
      ? placeholder
      : value.length === 1
        ? (options.find((option) => option.value === value[0])?.label ?? '1 selected')
        : `${value.length} selected`

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) {
          setTerm('')
          // Opening straight into the search is the whole point of the control.
          requestAnimationFrame(() => inputRef.current?.focus())
        }
      }}
      className="w-[var(--radix-popover-trigger-width)] min-w-64 p-0"
      trigger={
        <button
          type="button"
          disabled={disabled}
          aria-label={ariaLabel}
          className={cn(
            'rounded-control border-border bg-surface inline-flex h-9 items-center gap-2 border px-3 text-sm',
            'hover:border-border-strong disabled:bg-surface-inset disabled:cursor-not-allowed',
            value.length === 0 ? 'text-fg-subtle' : 'text-fg',
            className,
          )}
        >
          <span className="truncate">{summary}</span>
          <ChevronDown className="text-fg-subtle ml-auto size-4 shrink-0" />
        </button>
      }
    >
      <div className="border-border flex items-center gap-2 border-b px-3 py-2">
        <Search className="text-fg-subtle size-4 shrink-0" />
        <input
          ref={inputRef}
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder={searchPlaceholder}
          className="text-fg placeholder:text-fg-subtle min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
        {term ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setTerm('')
              inputRef.current?.focus()
            }}
            className="text-fg-subtle hover:text-fg"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>

      <div className="max-h-64 overflow-y-auto p-1">
        {visible.length === 0 ? (
          <p className="text-fg-subtle px-2 py-4 text-center text-sm">{emptyLabel}</p>
        ) : (
          visible.map((option) => {
            const on = chosen.has(option.value)
            return (
              <label
                key={option.value}
                className="rounded-control hover:bg-surface-muted flex cursor-pointer items-center gap-2 px-2 py-1.5 text-sm"
              >
                <Checkbox
                  aria-label={option.label}
                  checked={on}
                  onCheckedChange={() => toggle(option.value)}
                />
                {'imageUrl' in option ? <Thumb src={option.imageUrl} /> : null}
                <span className="min-w-0 flex-1">
                  <span className="text-fg block truncate">{option.label}</span>
                  {option.meta ? (
                    <span className="text-fg-subtle text-2xs block truncate">{option.meta}</span>
                  ) : null}
                </span>
                {on ? <Check className="text-primary size-3.5 shrink-0" /> : null}
              </label>
            )
          })
        )}
      </div>

      {value.length > 0 ? (
        <div className="border-border flex items-center justify-between gap-2 border-t px-3 py-2">
          <span className="text-fg-subtle text-2xs tabular-nums">{value.length} selected</span>
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto px-0"
            onClick={() => onChange([])}
          >
            Clear all
          </Button>
        </div>
      ) : null}
    </Popover>
  )
}

/**
 * The same neutral tile the catalogue uses. Inlined rather than importing
 * `ProductThumb`, so this control keeps to `shared/ui` and does not depend on
 * `shared/components`.
 */
function Thumb({ src }: { src: string | null | undefined }) {
  const base = 'size-8 rounded-control border-border shrink-0 overflow-hidden border'
  if (!src) {
    return (
      <span
        aria-hidden
        className={cn(base, 'bg-surface-inset text-fg-subtle flex items-center justify-center')}
      >
        <Package className="size-3.5" />
      </span>
    )
  }
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      className={cn(base, 'bg-surface-inset object-cover')}
      onError={(event) => {
        event.currentTarget.style.display = 'none'
      }}
    />
  )
}
