import { useQuery } from '@tanstack/react-query'
import { http } from '@/shared/lib/http'
import type { DashboardSummary } from '@/mocks/handlers/dashboard'

export type { DashboardSummary }

export function useDashboardSummary() {
  return useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: () => http.get<DashboardSummary>('/dashboard/summary'),
  })
}
