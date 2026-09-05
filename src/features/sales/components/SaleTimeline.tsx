import { CheckCircle2, Circle, Clock } from 'lucide-react'
import { formatDateTime } from '@/shared/lib/format'
import type { Sale } from '../model/sale'

/**
 * What has actually happened to this sale, from the timestamps we hold. It is
 * deliberately not a full audit log — we do not record one yet, and inventing
 * entries would be worse than showing the three moments we can prove.
 */
export function SaleTimeline({ sale }: { sale: Sale }) {
  const events = [
    { label: 'Created', at: sale.createdAt, done: true },
    {
      label: 'Last updated',
      at: sale.updatedAt !== sale.createdAt ? sale.updatedAt : null,
      done: sale.updatedAt !== sale.createdAt,
    },
    {
      label: sale.expiresAt ? 'Reservation expires' : null,
      at: sale.expiresAt,
      done: false,
      pending: true,
    },
    { label: 'Finished', at: sale.finishedAt, done: Boolean(sale.finishedAt) },
  ].filter((event) => event.label)

  return (
    <ol className="space-y-3">
      {events.map((event) => {
        const Icon = event.pending ? Clock : event.done ? CheckCircle2 : Circle
        return (
          <li key={event.label} className="flex items-start gap-2.5">
            <Icon
              className={
                event.pending
                  ? 'text-warning mt-0.5 size-4 shrink-0'
                  : event.done
                    ? 'text-success mt-0.5 size-4 shrink-0'
                    : 'text-fg-subtle mt-0.5 size-4 shrink-0'
              }
            />
            <div>
              <p className="text-fg text-sm">{event.label}</p>
              <p className="text-fg-subtle text-2xs">
                {event.at ? formatDateTime(event.at) : 'Not yet'}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
