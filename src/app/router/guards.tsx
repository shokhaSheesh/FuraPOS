import type { ReactNode } from 'react'
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
