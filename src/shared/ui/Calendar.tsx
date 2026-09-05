import { useMemo, useRef, useState } from 'react'
import {
  addDays,
  addMonths,
  addYears,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  setMonth,
  setYear,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/shared/lib/cn'
import { LOCALE } from '@/shared/lib/format'

export interface DateRange {
  from: Date | null
  to: Date | null
}

/** days → months → years. The header title zooms out; picking zooms back in. */
type CalendarView = 'days' | 'months' | 'years'

const YEARS_PER_PAGE = 12
/** Monday-first: the convention in this market. */
const WEEK_STARTS_ON = 1 as const

const monthNames = (format: 'short' | 'long') =>
  Array.from({ length: 12 }, (_, month) =>
    new Intl.DateTimeFormat(LOCALE, { month: format }).format(new Date(2020, month, 1)),
  )

const weekdayNames = () => {
  const base = startOfWeek(new Date(2021, 0, 4), { weekStartsOn: WEEK_STARTS_ON })
  return Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(LOCALE, { weekday: 'short' }).format(addDays(base, i)),
  )
}

interface CalendarProps {
  range: DateRange
  onRangeChange: (range: DateRange) => void
  month: Date
  onMonthChange: (month: Date) => void
  minDate?: Date
  maxDate?: Date
  /** 'single' collapses the range to one day; the zoom behaviour is identical. */
  mode?: 'single' | 'range'
}

export function Calendar({
  range,
  onRangeChange,
  month,
  onMonthChange,
  minDate,
  maxDate,
  mode = 'range',
}: CalendarProps) {
  const [view, setView] = useState<CalendarView>('days')
  const [hovered, setHovered] = useState<Date | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  const yearPageStart = Math.floor(month.getFullYear() / YEARS_PER_PAGE) * YEARS_PER_PAGE

  const title =
    view === 'days'
      ? new Intl.DateTimeFormat(LOCALE, { month: 'long', year: 'numeric' }).format(month)
      : view === 'months'
        ? String(month.getFullYear())
        : `${yearPageStart} – ${yearPageStart + YEARS_PER_PAGE - 1}`

  const step = (direction: -1 | 1) => {
    if (view === 'days') onMonthChange(addMonths(month, direction))
    else if (view === 'months') onMonthChange(addYears(month, direction))
    else onMonthChange(addYears(month, direction * YEARS_PER_PAGE))
  }

  return (
    <div className="w-70 p-3">
      <header className="mb-2 flex items-center gap-1">
        <NavButton label="Previous" onClick={() => step(-1)}>
          <ChevronLeft className="size-4" />
        </NavButton>

        <button
          type="button"
          onClick={() => setView(view === 'days' ? 'months' : view === 'months' ? 'years' : 'days')}
          className="rounded-control text-fg hover:bg-surface-muted flex-1 px-2 py-1 text-sm font-semibold first-letter:uppercase"
        >
          {title}
        </button>

        <NavButton label="Next" onClick={() => step(1)}>
          <ChevronRight className="size-4" />
        </NavButton>
      </header>

      {view === 'days' ? (
        <DaysView
          ref={gridRef}
          month={month}
          range={range}
          hovered={mode === 'single' ? null : hovered}
          minDate={minDate}
          maxDate={maxDate}
          onHover={setHovered}
          onMonthChange={onMonthChange}
          onPick={(day) =>
            onRangeChange(mode === 'single' ? { from: day, to: day } : nextRange(range, day))
          }
        />
      ) : view === 'months' ? (
        <Grid
          items={monthNames('short').map((label, index) => ({ key: index, label }))}
          isActive={(index) => index === month.getMonth()}
          onPick={(index) => {
            onMonthChange(setMonth(month, index))
            setView('days')
          }}
        />
      ) : (
        <Grid
          items={Array.from({ length: YEARS_PER_PAGE }, (_, i) => ({
            key: yearPageStart + i,
            label: String(yearPageStart + i),
          }))}
          isActive={(year) => year === month.getFullYear()}
          onPick={(year) => {
            onMonthChange(setYear(month, year))
            setView('months')
          }}
        />
      )}
    </div>
  )
}

/** Second click completes the range; clicking before the start restarts it. */
function nextRange(range: DateRange, day: Date): DateRange {
  if (!range.from || range.to) return { from: day, to: null }
  if (isBefore(day, range.from)) return { from: day, to: null }
  return { from: range.from, to: day }
}

function NavButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="rounded-control text-fg-muted hover:bg-surface-muted hover:text-fg flex size-7 items-center justify-center"
    >
      {children}
    </button>
  )
}

function Grid<T extends number>({
  items,
  isActive,
  onPick,
}: {
  items: { key: T; label: string }[]
  isActive: (key: T) => boolean
  onPick: (key: T) => void
}) {
  return (
    <div className="grid grid-cols-3 gap-1">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => onPick(item.key)}
          className={cn(
            'rounded-control h-9 text-sm capitalize',
            isActive(item.key)
              ? 'bg-primary text-primary-fg font-medium'
              : 'text-fg hover:bg-surface-muted',
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

interface DaysViewProps {
  month: Date
  range: DateRange
  hovered: Date | null
  minDate?: Date
  maxDate?: Date
  onHover: (day: Date | null) => void
  onPick: (day: Date) => void
  onMonthChange: (month: Date) => void
  ref?: React.Ref<HTMLDivElement>
}

function DaysView({
  month,
  range,
  hovered,
  minDate,
  maxDate,
  onHover,
  onPick,
  onMonthChange,
  ref,
}: DaysViewProps) {
  const days = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(startOfMonth(month), { weekStartsOn: WEEK_STARTS_ON }),
        end: endOfWeek(endOfMonth(month), { weekStartsOn: WEEK_STARTS_ON }),
      }),
    [month],
  )

  const today = startOfDay(new Date())
  // While picking the second date, preview the range under the cursor.
  const previewTo = range.from && !range.to ? hovered : range.to

  const inRange = (day: Date) => {
    if (!range.from || !previewTo) return false
    const [start, end] = isBefore(previewTo, range.from)
      ? [previewTo, range.from]
      : [range.from, previewTo]
    return !isBefore(day, start) && !isAfter(day, end)
  }

  // Arrow keys move by day/week so the grid is usable without a mouse.
  const onKeyDown = (event: React.KeyboardEvent, day: Date) => {
    const delta =
      event.key === 'ArrowLeft'
        ? -1
        : event.key === 'ArrowRight'
          ? 1
          : event.key === 'ArrowUp'
            ? -7
            : event.key === 'ArrowDown'
              ? 7
              : 0
    if (!delta) return
    event.preventDefault()
    const next = addDays(day, delta)
    if (!isSameMonth(next, month)) onMonthChange(startOfMonth(next))
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLButtonElement>(
        `[data-day="${next.toISOString().slice(0, 10)}"]`,
      )
      el?.focus()
    })
  }

  return (
    <div ref={ref} onMouseLeave={() => onHover(null)}>
      <div className="mb-1 grid grid-cols-7">
        {weekdayNames().map((name) => (
          <span
            key={name}
            className="text-fg-subtle text-2xs flex h-7 items-center justify-center font-medium capitalize"
          >
            {name}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-0.5">
        {days.map((day) => {
          const outside = !isSameMonth(day, month)
          const disabled =
            (maxDate ? isAfter(day, maxDate) : false) || (minDate ? isBefore(day, minDate) : false)
          const isStart = range.from && isSameDay(day, range.from)
          const isEnd = previewTo && isSameDay(day, previewTo)
          const isEdge = Boolean(isStart || isEnd)
          const middle = inRange(day) && !isEdge

          return (
            <button
              key={day.toISOString()}
              type="button"
              data-day={day.toISOString().slice(0, 10)}
              disabled={disabled}
              tabIndex={isSameDay(day, range.from ?? today) ? 0 : -1}
              onKeyDown={(event) => onKeyDown(event, day)}
              onMouseEnter={() => onHover(day)}
              onClick={() => onPick(day)}
              className={cn(
                'relative h-9 text-sm tabular-nums',
                // The connecting fill is square so a run of days reads as one
                // bar; only the two ends are rounded.
                middle && 'bg-primary-soft text-fg',
                isEdge && 'bg-primary text-primary-fg font-semibold',
                isStart && 'rounded-l-control',
                isEnd && 'rounded-r-control',
                !isEdge && !middle && 'rounded-control hover:bg-surface-muted',
                outside && !isEdge && !middle && 'text-fg-subtle',
                disabled && 'text-fg-subtle cursor-not-allowed opacity-40 hover:bg-transparent',
              )}
            >
              {day.getDate()}
              {isSameDay(day, today) && !isEdge ? (
                <span
                  aria-hidden
                  className="bg-primary absolute inset-x-0 bottom-1 mx-auto size-1 rounded-full"
                />
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
