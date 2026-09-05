import { useQuery } from '@tanstack/react-query'
import { http } from '@/shared/lib/http'
import type { DashboardPeriod, DashboardSummary } from '@/mocks/handlers/dashboard'
import type { DateRange } from '@/shared/ui/DateRangePicker'

const toIsoDay = (date: Date) => date.toISOString().slice(0, 10)

export type { DashboardPeriod, DashboardSummary, Metric } from '@/mocks/handlers/dashboard'

export function useDashboardSummary(period: DashboardPeriod, range?: DateRange) {
  const from = period === 'custom' && range?.from ? toIsoDay(range.from) : undefined
  const to = period === 'custom' && range?.to ? toIsoDay(range.to) : undefined

  return useQuery({
    queryKey: ['dashboard', 'summary', period, from, to],
    queryFn: () => http.get<DashboardSummary>('/dashboard/summary', { period, from, to }),
    // Keep the previous period on screen while the next loads, rather than
    // flashing skeletons over numbers the user is reading (DESIGN_RULES § 9.2).
    placeholderData: (previous) => previous,
  })
}
