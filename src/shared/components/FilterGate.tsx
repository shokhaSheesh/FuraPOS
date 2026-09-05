import type { ReactNode } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { Card } from '@/shared/ui/Card'
import { EmptyState } from './EmptyState'

interface FilterGateProps {
  /** True once the user has pressed Apply with a valid filter set. */
  applied: boolean
  /** Why this report is gated, in one line. */
  explanation?: string
  children: ReactNode
}

/**
 * Heavy reports must not auto-run on navigation (CLAUDE.md). Wrap the result
 * area in this: until the user applies filters they see an explicit prompt,
 * never a silent spinner burning a query nobody asked for.
 */
export function FilterGate({ applied, explanation, children }: FilterGateProps) {
  if (applied) return <>{children}</>

  return (
    <Card>
      <EmptyState
        icon={SlidersHorizontal}
        title="Choose your filters, then press Apply"
        description={
          explanation ??
          'This report is expensive to build, so it only runs once you tell it what to cover.'
        }
      />
    </Card>
  )
}
