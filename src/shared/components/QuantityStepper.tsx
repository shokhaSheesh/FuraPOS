import { Minus, Plus } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { NumberField } from '@/shared/components/NumberField'
import { cn } from '@/shared/lib/cn'
import { t } from '@/shared/i18n'

/** The compact − / number / + a variation's quantity is set with. */
export function QuantityStepper({
  value,
  max,
  label,
  onChange,
  size = 'sm',
}: {
  value: number
  max?: number
  /** `lg` in the variations dialog, where quantities are the whole job (client request). */
  size?: 'sm' | 'lg'
  /** What is being counted, for the buttons' names — the variation's full name. */
  label: string
  onChange: (next: number) => void
}) {
  const button = size === 'lg' ? 'size-9 [&_svg]:size-4.5' : 'size-6 [&_svg]:size-3.5'
  return (
    <div className={cn('flex items-center justify-end', size === 'lg' ? 'gap-1.5' : 'gap-1')}>
      <Button
        type="button"
        variant="secondary"
        size="icon"
        className={button}
        aria-label={t('One fewer {label}', { label: label })}
        disabled={value <= 0}
        onClick={() => onChange(value - 1)}
      >
        <Minus />
      </Button>
      <NumberField
        className={size === 'lg' ? 'h-9 w-16 px-2 text-center text-sm' : 'h-6 w-14 px-1.5 text-xs'}
        nullable={false}
        min={0}
        aria-label={t('Quantity of {label}', { label: label })}
        value={value}
        onChange={(next) => onChange(next ?? 0)}
      />
      <Button
        type="button"
        variant="secondary"
        size="icon"
        className={button}
        aria-label={t('One more {label}', { label: label })}
        disabled={max !== undefined && value >= max}
        onClick={() => onChange(value + 1)}
      >
        <Plus />
      </Button>
    </div>
  )
}
