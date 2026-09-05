import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { Card } from '@/shared/ui/Card'
import { Skeleton } from '@/shared/ui/Skeleton'
import { cn } from '@/shared/lib/cn'
import { formatPercent } from '@/shared/lib/format'

interface StatCardProps {
  label: string
  value: string
  /** Period-over-period change as a ratio; positive is not always good. */
  change?: number | null
  comparedTo?: string
  /** Set false where a rise is bad (cost, refunds). */
  higherIsBetter?: boolean
  loading?: boolean
}

export function StatCard({
  label,
  value,
  change,
  comparedTo,
  higherIsBetter = true,
  loading,
}: StatCardProps) {
  if (loading) {
    return (
      <Card className="space-y-2.5 p-4">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-7 w-36" />
        <Skeleton className="h-3 w-28" />
      </Card>
    )
  }

  const hasChange = change !== undefined && change !== null
  const positive = hasChange && (higherIsBetter ? change >= 0 : change < 0)
  const Arrow = hasChange && change >= 0 ? ArrowUpRight : ArrowDownRight

  return (
    <Card className="p-4">
      <p className="text-fg-muted text-sm">{label}</p>
      {/* Proportional figures: tabular digits make a standalone number look
          loose at display size. Tabular is for columns, not heroes. */}
      <p className="mt-1 text-xl font-semibold tracking-tight">{value}</p>
      {hasChange ? (
        <p className="text-2xs mt-1.5 flex items-center gap-1">
          <span
            className={cn(
              'inline-flex items-center gap-0.5 font-medium',
              positive ? 'text-success' : 'text-danger',
            )}
          >
            <Arrow className="size-3" />
            {formatPercent(Math.abs(change))}
          </span>
          {comparedTo ? <span className="text-fg-subtle">vs {comparedTo}</span> : null}
        </p>
      ) : null}
    </Card>
  )
}
