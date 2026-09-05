import { useEffect, useState } from 'react'
import {
  endOfMonth,
  endOfYear,
  format,
  isValid,
  parse,
  startOfMonth,
  startOfYear,
  subDays,
  subMonths,
} from 'date-fns'
import { CalendarDays } from 'lucide-react'
import { cn } from '@/shared/lib/cn'
import { formatDate } from '@/shared/lib/format'
import { Button } from './Button'
import { Input } from './Input'
import { Popover } from './Popover'
import { Calendar, type DateRange } from './Calendar'

const INPUT_FORMAT = 'dd.MM.yyyy'

const today = () => new Date()

const presets: { label: string; range: () => DateRange }[] = [
  { label: 'Today', range: () => ({ from: today(), to: today() }) },
  {
    label: 'Yesterday',
    range: () => ({ from: subDays(today(), 1), to: subDays(today(), 1) }),
  },
  { label: 'Last 7 days', range: () => ({ from: subDays(today(), 6), to: today() }) },
  { label: 'Last 30 days', range: () => ({ from: subDays(today(), 29), to: today() }) },
  { label: 'This month', range: () => ({ from: startOfMonth(today()), to: today() }) },
  {
    label: 'Last month',
    range: () => ({
      from: startOfMonth(subMonths(today(), 1)),
      to: endOfMonth(subMonths(today(), 1)),
    }),
  },
  { label: 'This year', range: () => ({ from: startOfYear(today()), to: endOfYear(today()) }) },
]

/**
 * The from–to control. Presets on the left cover the common asks; the calendar
 * covers the rest; the two text fields let a known date be typed rather than
 * navigated to. Nothing is applied until Apply, so half-picked ranges never
 * fire a query — see docs/DESIGN_RULES.md § 11.3.
 */
export function DateRangePicker({
  value,
  onChange,
  className,
  placeholder = 'Custom range',
}: {
  value: DateRange
  onChange: (range: DateRange) => void
  className?: string
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<DateRange>(value)
  const [month, setMonth] = useState<Date>(value.from ?? new Date())
  const [fromText, setFromText] = useState('')
  const [toText, setToText] = useState('')

  // Re-seed the draft each time it opens: an abandoned edit must not persist.
  useEffect(() => {
    if (!open) return
    setDraft(value)
    setMonth(value.from ?? new Date())
    setFromText(value.from ? format(value.from, INPUT_FORMAT) : '')
    setToText(value.to ? format(value.to, INPUT_FORMAT) : '')
  }, [open, value])

  const syncFromText = (text: string, key: 'from' | 'to') => {
    const parsed = parse(text, INPUT_FORMAT, new Date())
    if (!isValid(parsed)) return
    setDraft((prev) => ({ ...prev, [key]: parsed }))
    setMonth(parsed)
  }

  const label =
    value.from && value.to
      ? `${formatDate(value.from)} – ${formatDate(value.to)}`
      : value.from
        ? formatDate(value.from)
        : placeholder

  const complete = Boolean(draft.from && draft.to)

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      align="start"
      trigger={
        <Button
          variant="secondary"
          className={cn('font-normal', !value.from && 'text-fg-muted', className)}
        >
          <CalendarDays />
          {label}
        </Button>
      }
    >
      <div className="flex">
        <div className="border-border w-36 shrink-0 border-r p-2">
          {presets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => {
                const next = preset.range()
                setDraft(next)
                setMonth(next.from ?? new Date())
                setFromText(next.from ? format(next.from, INPUT_FORMAT) : '')
                setToText(next.to ? format(next.to, INPUT_FORMAT) : '')
              }}
              className="rounded-control text-fg-muted hover:bg-surface-muted hover:text-fg w-full px-2 py-1.5 text-left text-sm"
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div>
          <div className="border-border flex items-center gap-2 border-b p-3">
            <Input
              value={fromText}
              onChange={(e) => {
                setFromText(e.target.value)
                syncFromText(e.target.value, 'from')
              }}
              placeholder={INPUT_FORMAT.toUpperCase()}
              aria-label="From"
              className="h-8 w-32 text-center"
            />
            <span className="text-fg-subtle text-sm">–</span>
            <Input
              value={toText}
              onChange={(e) => {
                setToText(e.target.value)
                syncFromText(e.target.value, 'to')
              }}
              placeholder={INPUT_FORMAT.toUpperCase()}
              aria-label="To"
              className="h-8 w-32 text-center"
            />
          </div>

          <Calendar
            range={draft}
            onRangeChange={(next) => {
              setDraft(next)
              setFromText(next.from ? format(next.from, INPUT_FORMAT) : '')
              setToText(next.to ? format(next.to, INPUT_FORMAT) : '')
            }}
            month={month}
            onMonthChange={setMonth}
            maxDate={new Date()}
          />

          <div className="border-border flex items-center justify-end gap-2 border-t p-3">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={!complete}
              onClick={() => {
                onChange(draft)
                setOpen(false)
              }}
            >
              Apply
            </Button>
          </div>
        </div>
      </div>
    </Popover>
  )
}

export type { DateRange }
