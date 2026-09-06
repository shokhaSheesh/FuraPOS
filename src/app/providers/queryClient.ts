import { QueryClient } from '@tanstack/react-query'
import { ApiError } from '@/shared/lib/http'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      /**
       * Back-office data does not change under you second to second, and a
       * refetch on every navigation means a skeleton every time you move
       * between screens you just looked at. Five minutes fresh, half an hour
       * cached: revisiting a page is instant, and anything that writes
       * invalidates its own keys anyway.
       */
      staleTime: 5 * 60_000,
      gcTime: 30 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      retry: (failureCount, error) => {
        // Never retry the user's own mistakes — only transient failures.
        if (error instanceof ApiError && error.status < 500) return false
        return failureCount < 2
      },
    },
  },
})
