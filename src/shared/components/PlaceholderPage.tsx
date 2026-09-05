import { Construction } from 'lucide-react'
import { Card } from '@/shared/ui/Card'
import { PageHeader } from './PageHeader'
import { EmptyState } from './EmptyState'

/**
 * Every screen in the information architecture is routed from day one, so the
 * whole product is navigable while modules are built one at a time. Replace a
 * placeholder with a real page — never add a route that 404s.
 */
export function PlaceholderPage({
  title,
  description,
  note,
}: {
  title: string
  description?: string
  note?: string
}) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <Card>
        <EmptyState
          icon={Construction}
          title="Not built yet"
          description={note ?? 'This screen is part of the planned scope and has a route reserved.'}
        />
      </Card>
    </>
  )
}
