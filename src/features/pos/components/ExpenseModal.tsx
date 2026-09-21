import { useState } from 'react'
import { Field } from '@/shared/components/Field'
import { NumberField } from '@/shared/components/NumberField'
import { Input } from '@/shared/ui/Input'
import { Modal } from '@/shared/ui/Modal'
import { toast } from '@/shared/ui/toast'
import { cn } from '@/shared/lib/cn'
import { formatMoney } from '@/shared/lib/format'
import { t } from '@/shared/i18n'
import { useSession } from '@/app/providers/SessionProvider'
import { useShiftActions, type ShiftRow } from '@/features/cashShifts/api/shifts'
import { EXPENSE_CATEGORIES } from '@/features/cashShifts/model/shift'

/**
 * Money taken out of the drawer for something the shop needed — lunch for the
 * counter, a taxi, cleaning supplies (client request). It is a cash-out
 * movement on the open shift, so the cash-up expects exactly that much less
 * and nobody's drawer comes up short for a meal that was paid for honestly.
 *
 * It cannot take more than the drawer holds: a note of cash that is not there
 * is a variance waiting to happen.
 */
export function ExpenseModal({
  shift,
  open,
  onOpenChange,
}: {
  shift: ShiftRow
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { user } = useSession()
  const actions = useShiftActions()
  const [amount, setAmount] = useState<number | null>(null)
  const [category, setCategory] = useState('meal')
  const [comment, setComment] = useState('')
  const [tried, setTried] = useState(false)

  const tooMuch = amount !== null && amount > shift.expected
  const amountError = !tried
    ? undefined
    : !amount || amount <= 0
      ? t('An amount is required')
      : tooMuch
        ? t('The drawer only holds {amount}', { amount: formatMoney(shift.expected) })
        : undefined
  const commentError =
    tried && category === 'other' && !comment.trim() ? t('Say what it was for') : undefined

  const close = () => {
    setAmount(null)
    setCategory('meal')
    setComment('')
    setTried(false)
    onOpenChange(false)
  }

  const submit = () => {
    setTried(true)
    if (!amount || amount <= 0 || tooMuch) return
    if (category === 'other' && !comment.trim()) return
    const result = actions.move(shift.id, {
      kind: 'out',
      reason: 'expense',
      category,
      amount,
      comment: comment.trim() || null,
      by: user?.name,
    })
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(t('Expense of {amount} recorded', { amount: formatMoney(amount) }))
    close()
  }

  return (
    <Modal
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
      title={t('Add an expense')}
      description={t('Cash taken from the drawer at {register} for the shop’s needs.', {
        register: shift.registerName,
      })}
      primary={{ label: t('Record the expense'), onClick: submit }}
    >
      <div className="space-y-4">
        <Field label={t('What it was for')} required>
          {() => (
            <div className="grid grid-cols-3 gap-1.5">
              {EXPENSE_CATEGORIES.map((entry) => (
                <button
                  key={entry.value}
                  type="button"
                  aria-pressed={category === entry.value}
                  onClick={() => setCategory(entry.value)}
                  className={cn(
                    'rounded-control border px-2 py-2 text-sm transition-colors',
                    category === entry.value
                      ? 'border-primary bg-primary-soft text-primary font-medium'
                      : 'border-border text-fg-muted hover:border-border-strong',
                  )}
                >
                  {t(entry.label)}
                </button>
              ))}
            </div>
          )}
        </Field>
        <Field label={t('Amount')} required error={amountError}>
          {(p) => (
            <NumberField
              {...p}
              min={0}
              value={amount}
              onChange={setAmount}
              placeholder="0"
              className="text-right"
            />
          )}
        </Field>
        <Field label={t('Comment')} required={category === 'other'} error={commentError}>
          {(p) => (
            <Input
              {...p}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder={t('Lunch for the counter, taxi to the warehouse…')}
            />
          )}
        </Field>
        <div className="rounded-control bg-surface-muted flex items-baseline justify-between px-3 py-2 text-sm">
          <span className="text-fg-muted">{t('Left in the drawer')}</span>
          <span className={cn('font-semibold tabular-nums', tooMuch ? 'text-danger' : 'text-fg')}>
            {formatMoney(shift.expected - (amount ?? 0))}
          </span>
        </div>
      </div>
    </Modal>
  )
}
