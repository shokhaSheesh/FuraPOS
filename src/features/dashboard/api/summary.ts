import { useQuery } from '@tanstack/react-query'
import { http } from '@/shared/lib/http'
import type { DashboardPeriod, DashboardSummary } from '@/mocks/handlers/dashboard'

export type { DashboardPeriod, DashboardSummary, Metric } from '@/mocks/handlers/dashboard'

export function useDashboardSummary(period: DashboardPeriod) {
  return useQuery({
    queryKey: ['dashboard', 'summary', period],
    queryFn: () => http.get<DashboardSummary>('/dashboard/summary', { period }),
    // Keep the previous period on screen while the next loads, rather than
    // flashing skeletons over numbers the user is reading (DESIGN_RULES § 9.2).
    placeholderData: (previous) => previous,
  })
}
