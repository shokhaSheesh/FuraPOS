import { useMemo, useRef, useState } from 'react'
import { Plus, Search, X } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { Checkbox } from '@/shared/ui/Checkbox'
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

function readFieldIds(key: string): string[] | null {
  try {
    const raw = localStorage.getItem(`filter-fields:${key}`)
    return raw ? (JSON.parse(raw) as string[]) : null
  } catch {
    return null
  }
}

function storeFieldIds(key: string, ids: string[]) {
  try {
    localStorage.setItem(`filter-fields:${key}`, JSON.stringify(ids))
  } catch {
    // Private windows refuse storage; the panel simply resets next visit.
  }
}

/**
 * The search bar, OX-style: a text search that is also a filter by field.
 *
 * Typing searches as it always did. Clicking the bar opens a panel holding the
 * page's fields — a box per text field, a picker per list, from–to for numbers
 * — and Apply turns what was filled in into chips inside the bar, each removable
 * on its own. The panel starts with the fields most people filter by; "Add
 * field" brings in any other, and that choice is remembered per page.
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
  defaultFieldIds,
  storageKey,
  placeholder = 'Filter and search',
}: {
  fields: FilterField<T>[]
  /** What is applied now — usually read from the URL. */
  values: FilterValues
  onApply: (values: FilterValues) => void
  search: string
  onSearchChange: (search: string) => void
  /** The fields the panel shows before anybody adds one. */
  defaultFieldIds: string[]
  /** Remembers which fields this page's panel shows. */
  storageKey: string
  placeholder?: string
}) {
  const barRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<FilterValues>(values)
  const [shownIds, setShownIds] = useState<string[]>(
    () => readFieldIds(storageKey) ?? defaultFieldIds,
  )
  const [adding, setAdding] = useState(false)

  const byId = useMemo(() => new Map(fields.map((field) => [field.id, field] as const)), [fields])

  // A field with a value is always in the panel, whether or not it was added.
  const panelFields = fields.filter(
    (field) => shownIds.includes(field.id) || isActive(draft[field.id]),
  )
  const addable = fields.filter((field) => !panelFields.includes(field))

  const chips = Object.entries(values).flatMap(([id, value]) => {
    const field = byId.get(id)
    return field && isActive(value) ? [{ id, text: describe(field, value) }] : []
  })

  const openPanel = () => {
    if (open) return
    setDraft(values)
    setOpen(true)
  }

  const showFields = (ids: string[]) => {
    setShownIds(ids)
    storeFieldIds(storageKey, ids)
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
      className="flex max-h-[min(36rem,var(--radix-popover-content-available-height))] w-[max(var(--radix-popover-trigger-width),30rem)] flex-col"
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
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {panelFields.length === 0 ? (
          <p className="text-fg-subtle text-sm">No fields yet — add one below.</p>
        ) : null}
        {panelFields.map((field) => (
          <div key={field.id} className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-fg text-sm font-medium">{field.label}</span>
              <button
                type="button"
                className="text-fg-subtle hover:text-fg"
                aria-label={`Remove the ${field.label} field`}
                title="Remove this field"
                onClick={() => {
                  setField(field.id, undefined)
                  showFields(shownIds.filter((id) => id !== field.id))
                }}
              >
                <X className="size-3.5" />
              </button>
            </div>
            <FieldEditor
              field={field}
              value={draft[field.id]}
              onChange={(value) => setField(field.id, value)}
              onEnter={apply}
            />
          </div>
        ))}
      </div>

      <footer className="border-border flex items-center justify-between gap-2 border-t p-3">
        <Popover
          open={adding}
          onOpenChange={setAdding}
          align="start"
          className="max-h-72 w-56 overflow-y-auto p-1"
          trigger={
            <Button type="button" variant="link" size="sm" disabled={addable.length === 0}>
              <Plus />
              Add field
            </Button>
          }
        >
          {addable.map((field) => (
            <button
              key={field.id}
              type="button"
              className="text-fg hover:bg-surface-muted block w-full rounded px-2 py-1.5 text-left text-sm"
              onClick={() => {
                showFields([...shownIds, field.id])
                setAdding(false)
              }}
            >
              {field.label}
            </button>
          ))}
        </Popover>
        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" onClick={reset}>
            Reset
          </Button>
          <Button type="button" variant="primary" onClick={apply}>
            Apply
          </Button>
        </div>
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
        <div className="flex items-center gap-3">
          <Input
            className="flex-1"
            value={current.text}
            aria-label={field.label}
            placeholder={field.excludable ? 'One or several, separated by commas' : undefined}
            onChange={(event) => onChange({ ...current, text: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === 'Enter') onEnter()
            }}
          />
          {field.excludable ? (
            <label className="text-fg-muted flex shrink-0 cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                aria-label={`Exclude ${field.label}`}
                checked={Boolean(current.exclude)}
                onCheckedChange={(exclude) => onChange({ ...current, exclude })}
              />
              Exclude
            </label>
          ) : null}
        </div>
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
