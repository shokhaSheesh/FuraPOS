import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { paths } from '@/shared/config/paths'
import { navigation } from '@/shared/config/navigation'
import { Lock } from 'lucide-react'
import { useSession } from '@/app/providers/SessionProvider'
import { Card } from '@/shared/ui/Card'
import { EmptyState } from '@/shared/components/EmptyState'
import { Skeleton } from '@/shared/ui/Skeleton'

/**
 * Guards a route by permission key. A user without access sees an explicit
 * "no access" card, not a blank screen or a redirect they can't explain.
 */
export function RequirePermission({
  permission,
  children,
}: {
  permission: string
  children: ReactNode
}) {
  const { can, isLoading } = useSession()

  if (isLoading) return <Skeleton className="h-64 w-full" />

  if (!can(permission)) {
    return (
      <Card>
        <EmptyState
          icon={Lock}
          title="You don't have access to this screen"
          description="Ask an administrator to grant your role the matching permission."
        />
      </Card>
    )
  }

  return <>{children}</>
}

/**
 * Keeps everything behind sign-in. Remembers where somebody was heading, so
 * signing in puts them there rather than on the dashboard.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useSession()
  const location = useLocation()
  if (!user) {
    return (
      <Navigate
        to={paths.auth.login}
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    )
  }
  return <>{children}</>
}

/**
 * The home page for whoever is signed in. Someone who can see the dashboard
 * gets it; a role that cannot (a Seller, a Storekeeper) is sent to the first
 * screen in the sidebar it *can* open, rather than landing on "no access"
 * straight after signing in.
 */
export function HomeRoute({ children }: { children: ReactNode }) {
  const { can } = useSession()
  if (can('dashboard.view')) return <>{children}</>
  const first = navigation
    .flatMap((section) => section.items ?? [])
    .find((item) => item.to !== paths.dashboard && (!item.permission || can(item.permission)))
  return first ? <Navigate to={first.to} replace /> : <>{children}</>
}
