import { Check } from 'lucide-react'
import { cn } from '@/shared/lib/cn'
import { t } from '@/shared/i18n'

/**
 * Where you are in a two-step create screen — details first, then products.
 *
 * Splitting the page this way follows the reference product: the header of a
 * document (where from, where to, who for) is decided before anybody starts
 * picking lines, because the lines depend on it — the catalogue shown, the
 * stock quoted and the prices offered all change with those answers.
 *
 * A finished step can be clicked to go back to it; a later one cannot be
 * jumped to, since it needs the earlier one filled in first.
 */
export function Steps({
  steps,
  current,
  onSelect,
  selectable = false,
  wide = false,
}: {
  steps: string[]
  /** 1-based. */
  current: number
  onSelect: (step: number) => void
  /**
   * Lets a later step be clicked as well as an earlier one. A create screen
   * whose steps depend on each other — a transfer's lines need its route —
   * leaves this off; a form whose steps are only a way of grouping questions
   * turns it on and decides for itself what to do about half-filled ones.
   */
  selectable?: boolean
  /**
   * Stretches the steps across the full width with the connectors taking up the
   * slack, for a document that *is* the steps rather than a form that has them.
   */
  wide?: boolean
}) {
  return (
    <ol
      className={cn(
        'flex flex-wrap items-center gap-2 text-sm',
        wide && 'border-border w-full flex-nowrap border-b pb-3',
      )}
      aria-label={t('Steps')}
    >
      {steps.map((label, index) => {
        const number = index + 1
        const done = number < current
        const active = number === current
        return (
          /*
            Only the connectors stretch, never the labels. Giving every step an
            equal share of the width leaves the first one — which has no
            connector before it — with all that space as padding, so the gaps
            between steps come out different lengths.
          */
          <li
            key={label}
            className={cn('flex items-center gap-2', wide && index > 0 && 'min-w-0 flex-1')}
          >
            {index > 0 ? (
              <span className={cn('bg-border h-px', wide ? 'flex-1' : 'w-6')} aria-hidden />
            ) : null}
            <button
              type="button"
              disabled={!selectable && !done}
              onClick={() => onSelect(number)}
              aria-current={active ? 'step' : undefined}
              className={cn(
                'flex items-center gap-2 rounded-full py-0.5 pr-2.5 pl-0.5',
                (done || selectable) && !active && 'hover:bg-surface-inset',
                !done && !selectable && 'cursor-default',
              )}
            >
              <span
                className={cn(
                  'text-2xs flex size-6 items-center justify-center rounded-full font-semibold',
                  active && 'bg-primary text-primary-fg',
                  done && 'bg-primary-soft text-primary',
                  !active && !done && 'bg-surface-inset text-fg-subtle',
                )}
              >
                {done ? <Check className="size-3.5" /> : number}
              </span>
              <span className={cn('truncate', active ? 'text-fg font-medium' : 'text-fg-muted')}>
                {label}
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
