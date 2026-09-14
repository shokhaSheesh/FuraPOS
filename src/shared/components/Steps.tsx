import { Check } from 'lucide-react'
import { cn } from '@/shared/lib/cn'

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
}: {
  steps: string[]
  /** 1-based. */
  current: number
  onSelect: (step: number) => void
}) {
  return (
    <ol className="flex flex-wrap items-center gap-2 text-sm" aria-label="Steps">
      {steps.map((label, index) => {
        const number = index + 1
        const done = number < current
        const active = number === current
        return (
          <li key={label} className="flex items-center gap-2">
            {index > 0 ? <span className="bg-border h-px w-6" aria-hidden /> : null}
            <button
              type="button"
              disabled={!done}
              onClick={() => onSelect(number)}
              aria-current={active ? 'step' : undefined}
              className={cn(
                'flex items-center gap-2 rounded-full py-0.5 pr-2.5 pl-0.5',
                done && 'hover:bg-surface-inset',
                !done && 'cursor-default',
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
              <span className={cn(active ? 'text-fg font-medium' : 'text-fg-muted')}>{label}</span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
