import { useEffect, useState } from 'react'
import { Delete, LogOut } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { Modal } from '@/shared/ui/Modal'
import { cn } from '@/shared/lib/cn'
import { t } from '@/shared/i18n'
import { BACK_OFFICE_PIN } from '@/data/seed'

/** The keys, in calculator order — 7 8 9 on top, 0 at the foot. */
const KEYS = ['7', '8', '9', '4', '5', '6', '1', '2', '3']

/**
 * Leaving the till for the back office asks for a PIN (client request).
 *
 * Not the cashier's own password: a separate code the business sets, so that
 * whoever is minding the counter cannot wander into stock, costs and wages
 * just because they are signed in to sell. It is typed on screen — the till
 * may be a touch monitor with no keyboard in front of it — though the number
 * keys work too.
 */
export function BackOfficePin({
  open,
  onOpenChange,
  onUnlocked,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onUnlocked: () => void
}) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)

  const press = (digit: string) => {
    setError(false)
    setPin((current) => (current + digit).slice(0, BACK_OFFICE_PIN.length))
  }

  // Cleared between visits, so a half-typed code is never left on screen.
  useEffect(() => {
    if (!open) {
      setPin('')
      setError(false)
    }
  }, [open])

  // Checked as soon as it is long enough: nobody presses OK on a PIN pad.
  useEffect(() => {
    if (pin.length < BACK_OFFICE_PIN.length) return
    if (pin === BACK_OFFICE_PIN) {
      onUnlocked()
      return
    }
    setError(true)
    const timer = window.setTimeout(() => setPin(''), 600)
    return () => window.clearTimeout(timer)
  }, [pin, onUnlocked])

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t('Leave the till')}
      description={t('Enter the code that opens the back office.')}
      size="sm"
      footer={
        <div className="flex justify-end">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            {t('Cancel')}
          </Button>
        </div>
      }
    >
      <div
        className="space-y-4"
        onKeyDown={(event) => {
          if (/^\d$/.test(event.key)) press(event.key)
          if (event.key === 'Backspace') setPin((current) => current.slice(0, -1))
        }}
        tabIndex={-1}
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
      >
        <div className="flex justify-center gap-2" aria-label={t('Code')} role="status">
          {Array.from({ length: BACK_OFFICE_PIN.length }, (_, index) => (
            <span
              key={index}
              className={cn(
                'size-3.5 rounded-full border transition-colors',
                error
                  ? 'border-danger bg-danger'
                  : index < pin.length
                    ? 'border-primary bg-primary'
                    : 'border-border-strong',
              )}
            />
          ))}
        </div>

        {error ? (
          <p role="alert" className="text-danger text-center text-sm">
            {t('Wrong code')}
          </p>
        ) : null}

        <div className="mx-auto grid w-56 grid-cols-3 gap-2">
          {KEYS.map((key) => (
            <Button
              key={key}
              type="button"
              variant="secondary"
              className="h-14 text-lg font-medium"
              onClick={() => press(key)}
            >
              {key}
            </Button>
          ))}
          <span />
          <Button
            type="button"
            variant="secondary"
            className="h-14 text-lg font-medium"
            onClick={() => press('0')}
          >
            0
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-14"
            aria-label={t('Delete a digit')}
            onClick={() => setPin((current) => current.slice(0, -1))}
          >
            <Delete />
          </Button>
        </div>

        <p className="text-fg-subtle flex items-center justify-center gap-1.5 text-xs">
          <LogOut className="size-3.5" />
          {t('The till stays signed in and its open sales are kept.')}
        </p>
      </div>
    </Modal>
  )
}
