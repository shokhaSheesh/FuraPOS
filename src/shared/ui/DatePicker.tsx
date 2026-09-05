import { useEffect, useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { cn } from '@/shared/lib/cn'
import { formatDate } from '@/shared/lib/format'
import { Button } from './Button'
import { Popover } from './Popover'
import { Calendar } from './Calendar'

/**
 * One date. Same overlay and same three-step calendar as the range picker —
 * a native <input type="date"> is never used, because its popup is the
 * browser's, not ours (docs/DESIGN_RULES.md § 11).
 *
 * Unlike the range picker there is no Apply: with a single date the pick *is*
 * the decision, so it commits and closes.
 */
export function DatePicker({
  value,
  onChange,
  placeholder = 'Pick a date',
  minDate,
  maxDate,
  className,
}: {
  value: Date | null
  onChange: (date: Date | null) => void
  placeholder?: string
  minDate?: Date
  maxDate?: Date
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState<Date>(value ?? new Date())

  useEffect(() => {
    if (open) setMonth(value ?? new Date())
  }, [open, value])

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button
          variant="secondary"
          className={cn('w-full justify-start font-normal', !value && 'text-fg-muted', className)}
        >
          <CalendarDays />
          {value ? formatDate(value) : placeholder}
        </Button>
      }
    >
      <Calendar
        mode="single"
        range={{ from: value, to: value }}
        onRangeChange={(next) => {
          onChange(next.from)
          setOpen(false)
        }}
        month={month}
        onMonthChange={setMonth}
        minDate={minDate}
        maxDate={maxDate}
      />
    </Popover>
  )
}
