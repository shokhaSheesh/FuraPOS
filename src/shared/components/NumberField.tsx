import { Input } from '@/shared/ui/Input'
import { cn } from '@/shared/lib/cn'

/**
 * A number input that can be genuinely empty.
 *
 * `register(..., { setValueAs })` cannot do this: react-hook-form reads a blank
 * `type="number"` input back as `0`, so "no reorder point" became 0, "no
 * discount" became a price of zero, and an empty MOQ failed a `positive()`
 * check with an error nothing on screen rendered. This is controlled instead —
 * blank means `null` and stays `null`.
 *
 * Use it through a `Controller`; pass `nullable={false}` where the field must
 * always hold a number, and blank then reads as 0.
 */
export function NumberField({
  id,
  value,
  onChange,
  onBlur,
  nullable = true,
  placeholder,
  step,
  min = 0,
  className,
  'aria-invalid': ariaInvalid,
  'aria-label': ariaLabel,
}: {
  id?: string
  value: number | null
  onChange: (value: number | null) => void
  onBlur?: () => void
  nullable?: boolean
  placeholder?: string
  step?: string | number
  min?: number
  className?: string
  'aria-invalid'?: boolean
  'aria-label'?: string
}) {
  return (
    <Input
      id={id}
      type="number"
      inputMode="decimal"
      step={step}
      min={min}
      placeholder={placeholder}
      aria-invalid={ariaInvalid}
      aria-label={ariaLabel}
      className={cn('text-right', className)}
      value={value === null || Number.isNaN(value) ? '' : String(value)}
      onBlur={onBlur}
      onChange={(event) => {
        const raw = event.target.value
        if (raw === '') return onChange(nullable ? null : 0)
        const next = Number(raw)
        onChange(Number.isNaN(next) ? (nullable ? null : 0) : next)
      }}
    />
  )
}
