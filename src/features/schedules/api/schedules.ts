import { useMemo } from 'react'
import { useDataStore, type ScheduleInput } from '@/data/store'
import { isDue, nextRunAt, type ReorderSchedule } from '../model/schedule'

/**
 * Schedules, soonest-due first.
 *
 * A paused schedule has no next run, so it sinks to the bottom rather than
 * pretending to a position in a queue it is not in.
 */
export function useSchedules() {
  const schedules = useDataStore((s) => s.schedules)

  return useMemo(() => {
    const items = [...schedules]
      .map((schedule) => ({ schedule, next: nextRunAt(schedule) }))
      .sort((a, b) => (a.next?.getTime() ?? Infinity) - (b.next?.getTime() ?? Infinity))
      .map((entry) => entry.schedule)

    return { data: { items, total: items.length }, isLoading: false }
  }, [schedules])
}

export interface SchedulesSummary {
  active: number
  paused: number
  due: number
  /** What the last runs actually produced, across every schedule. */
  drafted: number
}

export function useSchedulesSummary(): SchedulesSummary {
  const schedules = useDataStore((s) => s.schedules)

  return useMemo(
    () => ({
      active: schedules.filter((s) => s.active).length,
      paused: schedules.filter((s) => !s.active).length,
      due: schedules.filter((s) => isDue(s)).length,
      drafted: schedules.filter((s) => s.lastRun?.orderId).length,
    }),
    [schedules],
  )
}

export function useScheduleActions() {
  const create = useDataStore((s) => s.createSchedule)
  const update = useDataStore((s) => s.updateSchedule)
  const remove = useDataStore((s) => s.deleteSchedule)
  const run = useDataStore((s) => s.runSchedule)

  return {
    create: (input: ScheduleInput) => create(input),
    update: (id: string, input: ScheduleInput) => update(id, input),
    remove,
    run,
    pause: (schedule: ReorderSchedule) =>
      update(schedule.id, {
        supplierId: schedule.supplierId,
        locationId: schedule.locationId,
        daysOfMonth: schedule.daysOfMonth,
        timeOfDay: schedule.timeOfDay,
        settings: schedule.settings,
        active: !schedule.active,
      }),
    isPending: false,
  }
}
