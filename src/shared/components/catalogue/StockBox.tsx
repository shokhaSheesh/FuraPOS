import { cn } from '@/shared/lib/cn'
import { formatNumber } from '@/shared/lib/format'
import { stockLevel } from './browse'

/**
 * How a stock figure is coloured while picking a transfer — the client's
 * mockup.
 *
 * Only **your own** shelf is judged: the one you are sending from, or the one
 * you are asking stock for. Red at 2 or fewer, amber from 3 to 5, green above.
 * The other end's figure is always blue — it is information, not a verdict.
 */
export type StockSide = 'mine' | 'theirs'

const LEVEL = {
  critical: 'bg-danger-soft text-danger',
  low: 'bg-caution-soft text-caution',
  good: 'bg-success-soft text-success',
} as const

const stockTone = (side: StockSide, units: number) =>
  side === 'theirs' ? 'bg-primary-soft text-primary' : LEVEL[stockLevel(units)]

/** A labelled box holding one stock figure, for cards and summaries. */
export function StockBox({
  side,
  label,
  units,
  large = false,
}: {
  side: StockSide
  label: string
  units: number
  large?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-control min-w-0',
        large ? 'px-3 py-2' : 'px-2 py-1.5',
        stockTone(side, units),
      )}
    >
      <p className={cn('text-2xs truncate opacity-80')} title={label}>
        {label}
      </p>
      <p className="text-sm font-semibold tabular-nums">{formatNumber(units)}</p>
    </div>
  )
}

/** The same colouring on a bare number, for table cells. */
export function StockPill({ side, units }: { side: StockSide; units: number }) {
  return (
    <span
      className={cn(
        'inline-block min-w-10 rounded-full px-2 py-0.5 text-center text-sm font-semibold tabular-nums',
        stockTone(side, units),
      )}
    >
      {formatNumber(units)}
    </span>
  )
}
