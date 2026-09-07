import { useMemo, useState, useEffect } from 'react'
import { CalendarClock, PackageCheck, Sparkles } from 'lucide-react'
import { Modal } from '@/shared/ui/Modal'
import { Select } from '@/shared/ui/Select'
import { Switch } from '@/shared/ui/Switch'
import { Field } from '@/shared/components/Field'
import { NumberField } from '@/shared/components/NumberField'
import { cn } from '@/shared/lib/cn'
import { formatMoney, formatNumber } from '@/shared/lib/format'
import { useDataStore } from '@/data/store'
import { USD_RATE } from '@/data/seed'
import type { ScheduleInput } from '@/data/store'
import { useReorderLines } from '../api/reorder'
import { coverageHorizon, lineCostUzs, needsOrdering, DEFAULT_SETTINGS } from '../model/reorder'
import {
  describeDays,
  nextRunAt,
  scheduleDraftSchema,
  type ReorderSchedule,
} from '../model/schedule'

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1)

const TIMES = Array.from({ length: 24 }, (_, hour) => {
  const value = `${String(hour).padStart(2, '0')}:00`
  return { value, label: value }
})

interface State {
  supplierId: string
  locationId: string
  daysOfMonth: number[]
  timeOfDay: string
  salesWindowDays: number
  leadTimeDays: number
  orderIntervalDays: number
  safetyDays: number
  active: boolean
}

const stateOf = (schedule: ReorderSchedule | null, fallbackLocation: string): State => ({
  supplierId: schedule?.supplierId ?? '',
  locationId: schedule?.locationId ?? fallbackLocation,
  daysOfMonth: schedule?.daysOfMonth ?? [1],
  timeOfDay: schedule?.timeOfDay ?? '09:00',
  salesWindowDays: schedule?.settings.salesWindowDays ?? DEFAULT_SETTINGS.salesWindowDays,
  leadTimeDays: schedule?.settings.leadTimeDays ?? DEFAULT_SETTINGS.leadTimeDays,
  orderIntervalDays: schedule?.settings.orderIntervalDays ?? DEFAULT_SETTINGS.orderIntervalDays,
  safetyDays: schedule?.settings.safetyDays ?? DEFAULT_SETTINGS.safetyDays,
  active: schedule?.active ?? true,
})

/**
 * Setting up a schedule.
 *
 * The dialog shows **what a run would order right now**, recalculated as the
 * numbers change. A schedule is a promise about the future made out of four
 * abstract knobs, and nobody can tell from the knobs alone whether they have
 * asked for eleven products or eleven hundred — so the answer is on screen
 * before it is saved rather than a fortnight later in an order nobody expected.
 */
export function ScheduleDialog({
  open,
  onOpenChange,
  schedule,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Null when creating. */
  schedule: ReorderSchedule | null
  onSave: (input: ScheduleInput) => void
}) {
  const suppliers = useDataStore((s) => s.suppliers)
  const locations = useDataStore((s) => s.locations)
  const [state, setState] = useState<State>(() => stateOf(schedule, locations[0]?.id ?? ''))
  const [showErrors, setShowErrors] = useState(false)

  useEffect(() => {
    if (open) {
      setState(stateOf(schedule, locations[0]?.id ?? ''))
      setShowErrors(false)
    }
  }, [open, schedule, locations])

  const settings = useMemo(
    () => ({
      salesWindowDays: state.salesWindowDays,
      leadTimeDays: state.leadTimeDays,
      orderIntervalDays: state.orderIntervalDays,
      safetyDays: state.safetyDays,
    }),
    [state.salesWindowDays, state.leadTimeDays, state.orderIntervalDays, state.safetyDays],
  )

  const filters = useMemo(
    () => ({
      supplierId: state.supplierId || null,
      locationId: state.locationId || null,
      onlyNeeded: true,
    }),
    [state.supplierId, state.locationId],
  )

  const preview = useReorderLines(settings, filters).filter(needsOrdering)
  const previewUnits = preview.reduce((sum, line) => sum + line.suggested, 0)
  const previewValue = preview.reduce((sum, line) => sum + lineCostUzs(line, USD_RATE), 0)

  const parsed = scheduleDraftSchema.safeParse(state)
  const errors = showErrors && !parsed.success ? parsed.error.flatten().fieldErrors : {}

  const next = nextRunAt({ ...state, active: true })

  const toggleDay = (day: number) =>
    setState((current) => ({
      ...current,
      daysOfMonth: current.daysOfMonth.includes(day)
        ? current.daysOfMonth.filter((d) => d !== day)
        : [...current.daysOfMonth, day].sort((a, b) => a - b),
    }))

  const save = () => {
    setShowErrors(true)
    if (!parsed.success) return
    onSave({
      supplierId: state.supplierId,
      locationId: state.locationId,
      daysOfMonth: state.daysOfMonth,
      timeOfDay: state.timeOfDay,
      settings,
      active: state.active,
    })
    onOpenChange(false)
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={schedule ? `Edit the ${schedule.supplierName} schedule` : 'New reorder schedule'}
      description="On the days you pick, the system works out what to reorder from this supplier and leaves a draft order waiting in Orders. Nothing is ever sent automatically."
      primary={{ label: schedule ? 'Save changes' : 'Create schedule', onClick: save }}
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Supplier" required error={errors.supplierId?.[0]}>
            {(p) => (
              <Select
                {...p}
                className="w-full"
                placeholder="Pick a supplier"
                value={state.supplierId || undefined}
                onChange={(supplierId) => setState((c) => ({ ...c, supplierId }))}
                options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
              />
            )}
          </Field>
          <Field
            label="Landing at"
            required
            hint="The stock this run counts, and where the order lands"
            error={errors.locationId?.[0]}
          >
            {(p) => (
              <Select
                {...p}
                className="w-full"
                value={state.locationId || undefined}
                onChange={(locationId) => setState((c) => ({ ...c, locationId }))}
                options={locations.map((l) => ({ value: l.id, label: l.name }))}
              />
            )}
          </Field>
        </div>

        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-fg-muted text-sm">
              Days of the month<span className="text-danger ml-0.5">*</span>
            </p>
            <p className="text-fg-subtle text-2xs">
              {state.daysOfMonth.length
                ? `Runs on ${describeDays(state.daysOfMonth)} of every month`
                : 'Pick at least one day'}
            </p>
          </div>
          <div className="flex flex-wrap gap-1">
            {DAYS.map((day) => {
              const on = state.daysOfMonth.includes(day)
              return (
                <button
                  key={day}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleDay(day)}
                  className={cn(
                    'border-border h-8 w-8 rounded-md border text-sm tabular-nums transition-colors',
                    on
                      ? 'bg-primary border-primary-border text-primary-fg font-semibold'
                      : 'text-fg-muted hover:bg-surface-inset',
                  )}
                >
                  {day}
                </button>
              )
            })}
          </div>
          {errors.daysOfMonth?.[0] ? (
            <p className="text-danger text-2xs">{errors.daysOfMonth[0]}</p>
          ) : (
            <p className="text-fg-subtle text-2xs">
              A month without the day you picked runs on its last day instead — the 31st still runs
              in February.
            </p>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-5">
          <Field label="Time">
            {(p) => (
              <Select
                {...p}
                className="w-full"
                value={state.timeOfDay}
                onChange={(timeOfDay) => setState((c) => ({ ...c, timeOfDay }))}
                options={TIMES}
              />
            )}
          </Field>
          <Field label="Sales period" hint="Days of history">
            {(p) => (
              <NumberField
                {...p}
                nullable={false}
                min={1}
                value={state.salesWindowDays}
                onChange={(v) => setState((c) => ({ ...c, salesWindowDays: v ?? 1 }))}
              />
            )}
          </Field>
          <Field label="Delivery time" hint="Days to arrive">
            {(p) => (
              <NumberField
                {...p}
                nullable={false}
                min={0}
                value={state.leadTimeDays}
                onChange={(v) => setState((c) => ({ ...c, leadTimeDays: v ?? 0 }))}
              />
            )}
          </Field>
          <Field label="Order every" hint="Days between orders">
            {(p) => (
              <NumberField
                {...p}
                nullable={false}
                min={1}
                value={state.orderIntervalDays}
                onChange={(v) => setState((c) => ({ ...c, orderIntervalDays: v ?? 1 }))}
              />
            )}
          </Field>
          <Field label="Safety stock" hint="Spare days">
            {(p) => (
              <NumberField
                {...p}
                nullable={false}
                min={0}
                value={state.safetyDays}
                onChange={(v) => setState((c) => ({ ...c, safetyDays: v ?? 0 }))}
              />
            )}
          </Field>
        </div>

        <div className="border-border bg-surface-inset rounded-card space-y-3 border p-3">
          <div className="flex items-start gap-2.5">
            <Sparkles className="text-fg-muted mt-0.5 size-4 shrink-0" />
            <div className="min-w-0 space-y-1">
              <p className="text-fg text-sm font-medium">
                {state.supplierId
                  ? preview.length === 0
                    ? 'Run today, this would order nothing'
                    : `Run today, this would order ${formatNumber(preview.length)} products`
                  : 'Pick a supplier to see what this would order'}
              </p>
              {state.supplierId ? (
                <p className="text-fg-muted text-2xs tabular-nums">
                  {preview.length === 0
                    ? 'Every part from this supplier has enough cover for the horizon below.'
                    : `${formatNumber(previewUnits)} units, roughly ${formatMoney(Math.round(previewValue))} at the last known cost.`}
                </p>
              ) : null}
            </div>
          </div>

          <div className="text-fg-subtle text-2xs grid gap-1.5 sm:grid-cols-2">
            <p className="flex items-start gap-1.5">
              <PackageCheck className="mt-0.5 size-3.5 shrink-0" />
              <span>
                Each delivery has to last{' '}
                <span className="text-fg-muted font-medium">
                  {formatNumber(coverageHorizon(settings))} days
                </span>{' '}
                — {state.leadTimeDays} to arrive + {state.orderIntervalDays} until the next order +{' '}
                {state.safetyDays} spare.
              </span>
            </p>
            <p className="flex items-start gap-1.5">
              <CalendarClock className="mt-0.5 size-3.5 shrink-0" />
              <span>
                {next
                  ? `First run ${next.toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}`
                  : 'No run scheduled'}
                {state.active ? '' : ' — paused, so it will not actually run'}
              </span>
            </p>
          </div>
        </div>

        <label className="flex items-center justify-between gap-3">
          <span className="min-w-0">
            <span className="text-fg block text-sm font-medium">Active</span>
            <span className="text-fg-subtle text-2xs">
              A paused schedule keeps its settings and stops running. You can still run it by hand.
            </span>
          </span>
          <Switch
            aria-label="Active"
            checked={state.active}
            onCheckedChange={(active) => setState((c) => ({ ...c, active }))}
          />
        </label>
      </div>
    </Modal>
  )
}
