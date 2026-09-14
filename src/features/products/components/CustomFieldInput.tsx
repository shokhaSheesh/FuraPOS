import { Controller, type FieldPath, type UseFormReturn } from 'react-hook-form'
import { NumberField } from '@/shared/components/NumberField'
import { Input } from '@/shared/ui/Input'
import { Select } from '@/shared/ui/Select'
import { Switch } from '@/shared/ui/Switch'
import type { ProductField } from '@/shared/types/productFields'
import type { ProductFormValues } from '../model/product'

/** "Not set" for a list column: Radix Select reads an empty value as cleared. */
const NONE = '__none__'

/**
 * The input for one of the business's own columns, chosen by its type. Used on
 * the product form wherever a column's level puts it — the Product card, the
 * single variation's section, or a cell of the variations table.
 */
export function CustomFieldInput({
  form,
  field,
  name,
  id,
  className,
  disabled,
  label,
}: {
  form: UseFormReturn<ProductFormValues>
  field: ProductField
  /** Where the answer lives: `customFields.<id>` or `variations.<n>.customFields.<id>`. */
  name: FieldPath<ProductFormValues>
  id?: string
  className?: string
  disabled?: boolean
  /** For a cell with no visible label. */
  label?: string
}) {
  return (
    <Controller
      control={form.control}
      name={name}
      render={({ field: f }) => {
        const value = f.value as string | number | boolean | null | undefined
        if (field.type === 'yesno') {
          return (
            <div className="flex h-9 items-center">
              <Switch
                aria-label={label ?? field.name}
                disabled={disabled}
                checked={value === true}
                onCheckedChange={f.onChange}
              />
            </div>
          )
        }
        if (field.type === 'number') {
          return (
            <NumberField
              id={id}
              aria-label={label}
              className={className}
              step="any"
              disabled={disabled}
              value={typeof value === 'number' ? value : null}
              onChange={f.onChange}
              onBlur={f.onBlur}
            />
          )
        }
        if (field.type === 'select') {
          return (
            <Select
              aria-label={label ?? field.name}
              className={className}
              disabled={disabled}
              value={typeof value === 'string' && value ? value : NONE}
              onChange={(next) => f.onChange(next === NONE ? null : next)}
              options={[
                { value: NONE, label: 'Not set' },
                ...field.options.map((option) => ({ value: option, label: option })),
              ]}
            />
          )
        }
        return (
          <Input
            id={id}
            aria-label={label}
            className={className}
            disabled={disabled}
            value={typeof value === 'string' ? value : ''}
            onChange={(event) => f.onChange(event.target.value || null)}
            onBlur={f.onBlur}
          />
        )
      }}
    />
  )
}
