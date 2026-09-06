import { createContext, use, useMemo, type ReactNode } from 'react'
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

const CURRENT_USER: CurrentUser = {
  id: 'usr-1',
  name: 'Akhmet Dauletmuratov',
  email: 'akhmet@fura.uz',
  avatarUrl: null,
  role: { id: 'role-1', name: 'Owner' },
  company: { id: 'cmp-1', name: 'Fura Retail', plan: 'pro' },
  locationIds: ['loc-1', 'loc-2', 'loc-3'],
  // '*' = everything. Swap for a narrow list to exercise the permission guards.
  permissions: ['*'],
}

export function SessionProvider({ children }: { children: ReactNode }) {
  /** No auth yet: a fixed user with every permission. */
  const data = CURRENT_USER
  const isLoading = false

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
