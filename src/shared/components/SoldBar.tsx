import { formatNumber, formatPercent } from '@/shared/lib/format'
import { t } from '@/shared/i18n'

/**
 * How much of a delivery has sold, as a bar and a rounded percentage — never a
 * unit count, because the figure is an estimate and should not read as one
 * somebody could reconcile to the unit. Goods receipts and transfers both show
 * it in their lists.
 */
export function SoldBar({
  received,
  sold,
  ratio,
  place,
}: {
  received: number
  sold: number
  ratio: number
  /** Where it sold, for the tooltip — "since it arrived", "at Shop — Chilonzor". */
  place: string
}) {
  if (received === 0) return <span className="text-fg-subtle">—</span>
  return (
    <div
      className="flex items-center gap-2"
      title={t('About {p0} of the {p1} units have sold {place}', {
        p0: formatNumber(sold),
        p1: formatNumber(received),
        place: place,
      })}
    >
      <span className="bg-surface-inset h-1.5 w-20 shrink-0 overflow-hidden rounded-full">
        <span
          className={`block h-full rounded-full ${ratio >= 1 ? 'bg-success' : 'bg-info'}`}
          style={{ width: `${Math.min(100, Math.round(ratio * 100))}%` }}
        />
      </span>
      <span className="text-fg-muted text-2xs tabular-nums">{formatPercent(ratio)}</span>
    </div>
  )
}
