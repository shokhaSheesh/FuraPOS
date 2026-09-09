import { useEffect, useState } from 'react'
import { Modal } from '@/shared/ui/Modal'
import { Field } from '@/shared/components/Field'
import { NumberField } from '@/shared/components/NumberField'
import { Input } from '@/shared/ui/Input'
import { toast } from '@/shared/ui/toast'
import { formatMoney } from '@/shared/lib/format'
import { useShiftActions, type ShiftRow } from '../api/shifts'
import { movementsIn, movementsOut, verdictOf } from '../model/shift'
import { VarianceBadge } from './VarianceBadge'

/**
 * Closing a drawer.
 *
 * The expected figure is deliberately **not** pre-filled into the counted
 * field. Pre-filling it turns a count into a click, and a variance nobody can
 * ever be surprised by is worth nothing. The difference appears only once a
 * number has been typed.
 */
export function CloseShiftModal({
  shift,
  open,
  onOpenChange,
}: {
  shift: ShiftRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const actions = useShiftActions()
  const [counted, setCounted] = useState<number | null>(null)
  const [comment, setComment] = useState('')

  useEffect(() => {
    if (open) {
      setCounted(null)
      setComment('')
    }
  }, [open, shift?.id])

  if (!shift) return null

  const difference = counted === null ? null : counted - shift.expected
  const verdict = verdictOf(difference)
  const needsWords = verdict === 'short' || verdict === 'over'

  const submit = () => {
    if (counted === null) {
      toast.error('Count the drawer before closing it')
      return
    }
    if (needsWords && comment.trim().length === 0) {
      // A large difference with no explanation is the thing this whole
      // feature exists to stop being normal.
      toast.error('A difference this size needs a note')
      return
    }
    const result = actions.close(shift.id, counted, comment.trim() || null)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(`${shift.number} closed`)
    onOpenChange(false)
  }

  const rows: [string, string][] = [
    ['Opening float', formatMoney(shift.openingFloat)],
    ['Cash sales', formatMoney(shift.totals.cash)],
    ['Paid in', formatMoney(movementsIn(shift))],
    ['Paid out', `−${formatMoney(movementsOut(shift))}`],
  ]

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={`Close ${shift.number}`}
      description={`${shift.registerName} · ${shift.employeeName}`}
      primary={{ label: 'Close the drawer', onClick: submit }}
    >
      <div className="space-y-4">
        <div className="border-border rounded-card divide-border divide-y border">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="text-fg-muted">{label}</span>
              <span className="text-fg tabular-nums">{value}</span>
            </div>
          ))}
          <div className="bg-canvas flex items-center justify-between gap-3 px-3 py-2 text-sm">
            <span className="text-fg font-medium">Should be in the drawer</span>
            <span className="text-fg font-semibold tabular-nums">
              {formatMoney(shift.expected)}
            </span>
          </div>
        </div>

        <Field label="Counted in the drawer" required>
          {(p) => (
            <NumberField
              {...p}
              className="w-full"
              value={counted}
              placeholder="Count it, then type the total"
              onChange={setCounted}
            />
          )}
        </Field>

        {difference !== null ? (
          <div className="flex items-center justify-between gap-3">
            <span className="text-fg-muted text-sm">Difference</span>
            <VarianceBadge difference={difference} />
          </div>
        ) : null}

        <Field
          label={needsWords ? 'What happened' : 'Note'}
          required={needsWords}
          hint={needsWords ? undefined : 'Optional'}
        >
          {(p) => (
            <Input
              {...p}
              value={comment}
              placeholder={needsWords ? 'A note is required for a difference this size' : ''}
              onChange={(event) => setComment(event.target.value)}
            />
          )}
        </Field>
      </div>
    </Modal>
  )
}
