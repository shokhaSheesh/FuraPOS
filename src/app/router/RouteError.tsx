import { isRouteErrorResponse, useNavigate, useRouteError } from 'react-router'
import { TriangleAlert } from 'lucide-react'
import { Card } from '@/shared/ui/Card'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/components/EmptyState'

export function RouteError() {
  const error = useRouteError()
  const navigate = useNavigate()

  const title = isRouteErrorResponse(error)
    ? `${error.status} — ${error.statusText}`
    : 'Something went wrong'

  return (
    <div className="p-6">
      <Card>
        <EmptyState
          icon={TriangleAlert}
          title={title}
          description={
            error instanceof Error ? error.message : 'This screen failed to load. Try again.'
          }
          action={
            <Button variant="secondary" onClick={() => navigate(0)}>
              Reload
            </Button>
          }
        />
      </Card>
    </div>
  )
}
