import { Plus, Trash2 } from 'lucide-react'
import type { UseFormReturn } from 'react-hook-form'
import { Field } from '@/shared/components/Field'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { TagsInput } from '@/shared/ui/TagsInput'
import { MAX_OPTIONS, type ProductFormValues } from '../model/product'

/**
 * Presets, because "option" is jargon until you have seen one. A first-time
 * user gets a working example in one click, and the dominant case in this
 * catalogue — a left and a right — needs no typing at all.
 */
const PRESETS: { name: string; values: string[] }[] = [
  { name: 'Side', values: ['Left', 'Right'] },
  { name: 'Colour', values: [] },
  { name: 'Size', values: [] },
  { name: 'Length', values: [] },
]

/**
 * The options a product varies along. Everything below this — how many
 * variations there are and what they are called — is generated from what is
 * entered here, so it comes first and nothing under it is typed twice.
 */
export function ProductOptionsEditor({
  form,
  options,
  onChange,
}: {
  form: UseFormReturn<ProductFormValues>
  options: ProductFormValues['options']
  /** Applies the change and rebuilds the variation grid from it. */
  onChange: (next: ProductFormValues['options']) => void
}) {
  const errors = form.formState.errors.options
  const usedNames = new Set(options.map((option) => option.name.trim().toLowerCase()))
  const availablePresets = PRESETS.filter((preset) => !usedNames.has(preset.name.toLowerCase()))
  const full = options.length >= MAX_OPTIONS

  const update = (index: number, patch: Partial<ProductFormValues['options'][number]>) =>
    onChange(options.map((option, i) => (i === index ? { ...option, ...patch } : option)))

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-fg-muted text-sm">
          Options<span className="text-danger ml-0.5">*</span>
        </p>
        <p className="text-fg-subtle text-2xs">
          {full ? `${MAX_OPTIONS} is the maximum` : `Up to ${MAX_OPTIONS}`}
        </p>
      </div>

      {options.map((option, index) => (
        <div
          key={option.id}
          className="border-border rounded-card grid gap-3 border p-3 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto]"
        >
          <Field label="Option name" error={errors?.[index]?.name?.message}>
            {(p) => (
              <Input
                {...p}
                placeholder="Side"
                value={option.name}
                onChange={(event) => update(index, { name: event.target.value })}
              />
            )}
          </Field>
          <Field
            label="Values"
            hint="Enter after each one"
            error={errors?.[index]?.values?.message}
          >
            {(p) => (
              <TagsInput
                id={p.id}
                value={option.values}
                onChange={(values) => update(index, { values })}
                placeholder="Left"
              />
            )}
          </Field>
          <div className="flex items-end">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remove the ${option.name || 'unnamed'} option`}
              title="Remove option"
              className="hover:text-danger"
              onClick={() => onChange(options.filter((_, i) => i !== index))}
            >
              <Trash2 />
            </Button>
          </div>
        </div>
      ))}

      {typeof errors?.message === 'string' ? (
        <p className="text-danger text-2xs">{errors.message}</p>
      ) : null}

      {full ? null : (
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() =>
              onChange([...options, { id: `opt-${Date.now()}`, name: '', values: [] }])
            }
          >
            <Plus />
            Add option
          </Button>
          {availablePresets.length ? (
            <>
              <span className="text-fg-subtle text-2xs ml-1">or</span>
              {availablePresets.map((preset) => (
                <Button
                  key={preset.name}
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    onChange([...options, { id: `opt-${Date.now()}-${preset.name}`, ...preset }])
                  }
                >
                  {preset.name}
                </Button>
              ))}
            </>
          ) : null}
        </div>
      )}
    </div>
  )
}
