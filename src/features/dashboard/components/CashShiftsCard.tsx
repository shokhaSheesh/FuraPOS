import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Skeleton } from '@/shared/ui/Skeleton'
import { EmptyState } from '@/shared/components/EmptyState'
import { formatDateTime, formatMoney } from '@/shared/lib/format'
import type { DashboardSummary } from '../api/summary'

/** OX parity: which registers are open right now and what is in them. */
export function CashShiftsCard({
  shifts,
  loading,
}: {
  shifts: DashboardSummary['cashShifts']
  loading?: boolean
}) {
  const open = shifts.filter((shift) => shift.status === 'open')

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cash shifts</CardTitle>
      </CardHeader>
      <CardBody>
        {loading ? (
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : open.length === 0 ? (
          <EmptyState title="No open shifts" description="Every register is closed." />
        ) : (
          <ul className="divide-border divide-y">
            {open.map((shift) => (
              <li key={shift.id} className="flex items-center gap-3 py-2.5 first:pt-0">
                <span aria-hidden className="bg-success size-1.5 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{shift.locationName}</p>
                  <p className="text-fg-subtle text-2xs">
                    {shift.terminal} · open since {formatDateTime(shift.openedAt)}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-medium tabular-nums">
                  {formatMoney(shift.total)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  )
}
