import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { Card } from '@/shared/ui/Card'
import { Skeleton } from '@/shared/ui/Skeleton'
import { cn } from '@/shared/lib/cn'
import { formatPercent } from '@/shared/lib/format'

interface StatCardProps {
  label: string
  value: string
  /** Period-over-period change as a ratio; positive is not always good. */
  change?: number
  /** Set false where a rise is bad (e.g. cost, refunds). */
  higherIsBetter?: boolean
  loading?: boolean
}

export function StatCard({
  label,
  value,
  change,
  higherIsBetter = true,
  loading,
}: StatCardProps) {
  if (loading) {
    return (
      <Card className="space-y-2 p-4">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-7 w-32" />
      </Card>
    )
  }

  const positive = change !== undefined && (higherIsBetter ? change >= 0 : change < 0)
  const Arrow = change !== undefined && change >= 0 ? ArrowUpRight : ArrowDownRight

  return (
    <Card className="p-4">
      <p className="text-sm text-fg-muted">{label}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <p className="text-xl font-semibold tabular-nums tracking-tight">{value}</p>
        {change !== undefined ? (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-sm font-medium',
              positive ? 'text-success' : 'text-danger',
            )}
          >
            <Arrow className="size-3.5" />
            {formatPercent(Math.abs(change))}
          </span>
        ) : null}
      </div>
    </Card>
  )
}
