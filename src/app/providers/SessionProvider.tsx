import { createContext, use, useCallback, useMemo, useState, type ReactNode } from 'react'
import type { Id } from '@/shared/types'
import { useDataStore } from '@/data/store'
import { authenticate } from '@/features/auth/model/auth'

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
  signIn: (login: string, password: string) => { ok: true } | { ok: false; error: string }
  signOut: () => void
  /**
   * True when the last sign-out was the user's own. The sign-in redirect uses it
   * to forget the page they were on, so whoever signs in next is not dropped
   * onto somebody else's screen.
   */
  signedOutByUser: boolean
}

const SessionContext = createContext<SessionContextValue | null>(null)

/*
 * Which employee is signed in, remembered across reloads. Only the id is kept,
 * and the rest is looked up fresh each time, so a role changed in Access &
 * roles applies on the next render rather than on the next sign-in.
 *
 * Wrapped in try/catch because storage can be unavailable (private windows,
 * blocked site data), and a screen that crashes on that is worse than one that
 * simply asks you to sign in again.
 */
const STORAGE_KEY = 'fura.session.employeeId'

const readStored = () => {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}
const writeStored = (id: string | null) => {
  try {
    if (id) localStorage.setItem(STORAGE_KEY, id)
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Signed in for this tab only.
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const employees = useDataStore((s) => s.employees)
  const roles = useDataStore((s) => s.roles)
  const company = useDataStore((s) => s.company)
  const [employeeId, setEmployeeId] = useState<string | null>(readStored)
  const [signedOutByUser, setSignedOutByUser] = useState(false)

  const user = useMemo<CurrentUser | null>(() => {
    const employee = employees.find((e) => e.id === employeeId)
    // An account suspended while signed in stops working straight away.
    if (!employee || employee.status !== 'active') return null
    const role = roles.find((r) => r.id === employee.roleId)
    if (!role) return null
    return {
      id: employee.id,
      name: employee.fullName,
      email: employee.email ?? '',
      avatarUrl: employee.avatarUrl,
      role: { id: role.id, name: role.name },
      company: { id: 'cmp-1', name: company.name, plan: 'pro' },
      locationIds: employee.locationId ? [employee.locationId] : [],
      permissions: role.permissions,
    }
  }, [employees, roles, company.name, employeeId])

  const signIn = useCallback<SessionContextValue['signIn']>(
    (login, password) => {
      const result = authenticate(employees, roles, login, password)
      if (!result.ok) return result
      setEmployeeId(result.employee.id)
      setSignedOutByUser(false)
      writeStored(result.employee.id)
      return { ok: true }
    },
    [employees, roles],
  )

  const signOut = useCallback(() => {
    setEmployeeId(null)
    setSignedOutByUser(true)
    writeStored(null)
  }, [])

  const value = useMemo<SessionContextValue>(() => {
    const granted = new Set(user?.permissions ?? [])
    return {
      user,
      isLoading: false,
      can: (permission) => granted.has('*') || granted.has(permission),
      signIn,
      signOut,
      signedOutByUser,
    }
  }, [user, signIn, signOut, signedOutByUser])

  return <SessionContext value={value}>{children}</SessionContext>
}

export function useSession() {
  const context = use(SessionContext)
  if (!context) throw new Error('useSession must be used inside <SessionProvider>')
  return context
}
