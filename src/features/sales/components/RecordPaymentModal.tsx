import { useState } from 'react'
import { Modal } from '@/shared/ui/Modal'
import { Input } from '@/shared/ui/Input'
import { formatMoney } from '@/shared/lib/format'

/**
 * Settling a debt. The amount defaults to the whole balance, which is what
 * happens most of the time; anything less is a part payment.
 */
export function RecordPaymentModal({
  open,
  onOpenChange,
  debt,
  submitting,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  debt: number
  submitting?: boolean
  onConfirm: (amount: number) => void
}) {
  const [amount, setAmount] = useState('')
  const value = Number(amount) || debt
  const remaining = Math.max(0, debt - value)

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) setAmount('')
        onOpenChange(next)
      }}
      title="Record a payment"
      size="sm"
      submitting={submitting}
      primary={{
        label: 'Record payment',
        onClick: () => onConfirm(value),
        disabled: value <= 0,
      }}
    >
      <div className="space-y-3">
        <p className="text-fg-muted text-sm">
          Outstanding balance is{' '}
          <strong className="text-fg font-medium">{formatMoney(debt)}</strong>.
        </p>
        <label className="block space-y-1">
          <span className="text-fg-muted text-sm">Amount</span>
          <Input
            type="number"
            min={0}
            max={debt}
            autoFocus
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder={String(debt)}
            className="text-right"
          />
        </label>
        {remaining > 0 ? (
          <p className="text-warning text-2xs">
            {formatMoney(remaining)} will still be owed after this payment.
          </p>
        ) : (
          <p className="text-success text-2xs">This settles the sale in full.</p>
        )}
      </div>
    </Modal>
  )
}
