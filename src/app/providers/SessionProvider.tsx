import { createContext, use, useMemo, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { http } from '@/shared/lib/http'
import type { Id } from '@/shared/types'

export interface CurrentUser {
  id: Id
  name: string
  email: string
  avatarUrl: string | null
  role: { id: Id; name: string }
  company: { id: Id; name: string; plan: 'free' | 'standard' | 'pro' | 'enterprise' }
  locationIds: Id[]
  permissions: string[]
}

interface SessionContextValue {
  user: CurrentUser | null
  isLoading: boolean
  /** `can('catalog.products.edit')` — the only way to check access. */
  can: (permission: string) => boolean
}

const SessionContext = createContext<SessionContextValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const { data, isLoading } = useQuery({
    queryKey: ['session'],
    queryFn: () => http.get<CurrentUser>('/me'),
    staleTime: Infinity,
  })

  const value = useMemo<SessionContextValue>(() => {
    const granted = new Set(data?.permissions ?? [])
    return {
      user: data ?? null,
      isLoading,
      can: (permission) => granted.has('*') || granted.has(permission),
    }
  }, [data, isLoading])

  return <SessionContext value={value}>{children}</SessionContext>
}

export function useSession() {
  const context = use(SessionContext)
  if (!context) throw new Error('useSession must be used inside <SessionProvider>')
  return context
}
