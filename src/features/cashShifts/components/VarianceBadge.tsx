import { Badge } from '@/shared/ui/Badge'
import { formatMoney } from '@/shared/lib/format'
import { VERDICT_LABEL, verdictOf } from '../model/shift'

/**
 * The one number this whole feature exists for.
 *
 * Note that **over** is a warning, not a success: more cash than the system
 * expected usually means a sale went unrecorded, which is a worse problem than
 * being a few thousand short. Only an exact or near-exact drawer is green.
 */
export function VarianceBadge({ difference }: { difference: number | null }) {
  const verdict = verdictOf(difference)
  if (verdict === null || difference === null) {
    return <span className="text-fg-subtle">Not counted</span>
  }

  const tone = verdict === 'exact' || verdict === 'within' ? 'success' : 'warning'
  const sign = difference > 0 ? '+' : ''

  return (
    <Badge tone={tone}>
      {difference === 0
        ? VERDICT_LABEL.exact
        : `${VERDICT_LABEL[verdict]} ${sign}${formatMoney(difference)}`}
    </Badge>
  )
}
