import { useMemo, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { MultiSelect } from '@/shared/ui/MultiSelect'
import { Popover } from '@/shared/ui/Popover'
import { Select } from '@/shared/ui/Select'
import { NumberField } from '@/shared/components/NumberField'
import { cn } from '@/shared/lib/cn'
import {
  activeOnly,
  describe,
  isActive,
  type FilterField,
  type FilterValue,
  type FilterValues,
} from '@/shared/lib/fieldFilters'

/**
 * The search bar, OX-style: a text search that is also a filter by field.
 *
 * Typing searches as it always did. Clicking the bar opens a panel holding the
 * page's fields — a box per text field, a picker per list, from–to for numbers
 * — and Apply turns what was filled in into chips inside the bar, each removable
 * on its own. Every field of the page is in the panel from the start — nobody
 * should have to go looking for a field before they can filter by it.
 *
 * Filling in the panel changes nothing until Apply, so half-typed values never
 * flicker the table, and Reset is a clean way back.
 */
export function FilterSearch<T>({
  fields,
  values,
  onApply,
  search,
  onSearchChange,
  placeholder = 'Filter and search',
}: {
  fields: FilterField<T>[]
  /** What is applied now — usually read from the URL. */
  values: FilterValues
  onApply: (values: FilterValues) => void
  search: string
  onSearchChange: (search: string) => void
  placeholder?: string
}) {
  const barRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<FilterValues>(values)

  const byId = useMemo(() => new Map(fields.map((field) => [field.id, field] as const)), [fields])

  const chips = Object.entries(values).flatMap(([id, value]) => {
    const field = byId.get(id)
    return field && isActive(value) ? [{ id, text: describe(field, value) }] : []
  })

  const openPanel = () => {
    if (open) return
    setDraft(values)
    setOpen(true)
  }

  const setField = (id: string, value: FilterValue | undefined) =>
    setDraft((current) => {
      const next = { ...current }
      if (value) next[id] = value
      else delete next[id]
      return next
    })

  const apply = () => {
    onApply(activeOnly(draft))
    setOpen(false)
  }

  const reset = () => {
    setDraft({})
    onApply({})
    setOpen(false)
  }

  return (
    <Popover
      anchored
      open={open}
      onOpenChange={setOpen}
      align="start"
      // Typing stays in the bar; the panel is beside it, not in its way.
      onOpenAutoFocus={(event) => event.preventDefault()}
      onInteractOutside={(event) => {
        if (barRef.current?.contains(event.target as Node)) event.preventDefault()
      }}
      className="flex max-h-[min(36rem,var(--radix-popover-content-available-height))] w-[min(max(var(--radix-popover-trigger-width),48rem),calc(100vw-2rem))] flex-col"
      trigger={
        <div
          ref={barRef}
          onClick={() => {
            openPanel()
            inputRef.current?.focus()
          }}
          className={cn(
            'rounded-control border-border bg-surface flex min-h-9 w-full max-w-2xl cursor-text flex-wrap items-center gap-1 border px-2 py-1',
            open && 'border-primary ring-primary ring-1',
          )}
        >
          {chips.map((chip) => (
            <span
              key={chip.id}
              className="bg-primary-soft text-primary text-2xs inline-flex max-w-64 items-center gap-1 rounded px-1.5 py-0.5 font-medium"
            >
              <span className="truncate" title={chip.text}>
                {chip.text}
              </span>
              <button
                type="button"
                aria-label={`Remove filter ${chip.text}`}
                className="hover:text-primary-hover shrink-0"
                onClick={(event) => {
                  event.stopPropagation()
                  const next = { ...values }
                  delete next[chip.id]
                  onApply(next)
                  setDraft(next)
                }}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
          <input
            ref={inputRef}
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            onFocus={openPanel}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setOpen(false)
            }}
            placeholder={chips.length ? '' : placeholder}
            aria-label={placeholder}
            className="text-fg placeholder:text-fg-subtle h-7 min-w-32 flex-1 bg-transparent text-sm outline-none"
          />
          <Search className="text-fg-subtle size-4 shrink-0" aria-hidden />
        </div>
      }
    >
      <header className="border-border flex items-center justify-between gap-2 border-b py-2 pr-2 pl-4">
        <span className="text-fg text-sm font-semibold">Filters</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Close filters"
          onClick={() => setOpen(false)}
        >
          <X />
        </Button>
      </header>

      {/* Two fields a row, as OX lays them out: half the scrolling for the same fields. */}
      <div className="grid min-h-0 flex-1 content-start gap-x-4 gap-y-4 overflow-y-auto p-4 sm:grid-cols-2">
        {fields.map((field) => (
          <div key={field.id} className="min-w-0 space-y-1.5">
            <span className="text-fg block text-sm font-medium">{field.label}</span>
            <FieldEditor
              field={field}
              value={draft[field.id]}
              onChange={(value) => setField(field.id, value)}
              onEnter={apply}
            />
          </div>
        ))}
      </div>

      <footer className="border-border flex items-center justify-end gap-2 border-t p-3">
        <Button type="button" variant="secondary" onClick={reset}>
          Reset
        </Button>
        <Button type="button" variant="primary" onClick={apply}>
          Apply
        </Button>
      </footer>
    </Popover>
  )
}

function FieldEditor<T>({
  field,
  value,
  onChange,
  onEnter,
}: {
  field: FilterField<T>
  value: FilterValue | undefined
  onChange: (value: FilterValue | undefined) => void
  onEnter: () => void
}) {
  switch (field.type) {
    case 'text': {
      const current = value?.type === 'text' ? value : { type: 'text' as const, text: '' }
      return (
        <Input
          value={current.text}
          aria-label={field.label}
          onChange={(event) => onChange({ ...current, text: event.target.value })}
          onKeyDown={(event) => {
            if (event.key === 'Enter') onEnter()
          }}
        />
      )
    }
    case 'options':
      return (
        <MultiSelect
          className="w-full"
          aria-label={field.label}
          placeholder={field.label}
          value={value?.type === 'options' ? value.values : []}
          options={field.options ?? []}
          onChange={(values) => onChange(values.length ? { type: 'options', values } : undefined)}
        />
      )
    case 'range': {
      const current =
        value?.type === 'range' ? value : { type: 'range' as const, min: null, max: null }
      return (
        <div className="flex items-center gap-2">
          <NumberField
            className="flex-1"
            aria-label={`${field.label} from`}
            placeholder="From"
            value={current.min}
            onChange={(min) => onChange({ ...current, min })}
          />
          <span className="text-fg-subtle">–</span>
          <NumberField
            className="flex-1"
            aria-label={`${field.label} to`}
            placeholder="To"
            value={current.max}
            onChange={(max) => onChange({ ...current, max })}
          />
          {field.unit ? <span className="text-fg-subtle text-sm">{field.unit}</span> : null}
        </div>
      )
    }
    case 'boolean':
      return (
        <Select
          className="w-full"
          aria-label={field.label}
          value={value?.type === 'boolean' ? (value.value ? 'yes' : 'no') : 'any'}
          onChange={(next) =>
            onChange(next === 'any' ? undefined : { type: 'boolean', value: next === 'yes' })
          }
          options={[
            { value: 'any', label: 'Any' },
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' },
          ]}
        />
      )
  }
}
