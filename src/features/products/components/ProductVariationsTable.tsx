import { ArrowDownToLine } from 'lucide-react'
import { Controller, type UseFormReturn } from 'react-hook-form'
import { NumberField } from '@/shared/components/NumberField'
import { Button } from '@/shared/ui/Button'
import { Checkbox } from '@/shared/ui/Checkbox'
import { Input } from '@/shared/ui/Input'
import { MultiSelect, type MultiSelectOption } from '@/shared/ui/MultiSelect'
import { Select } from '@/shared/ui/Select'
import { cn } from '@/shared/lib/cn'
import type { ProductField } from '@/shared/types/productFields'
import { combinationName, type ProductFormValues } from '../model/product'
import { CustomFieldInput } from './CustomFieldInput'

const CURRENCIES = [
  { value: 'USD', label: 'USD' },
  { value: 'UZS', label: 'UZS' },
]

/**
 * The generated variations, as a table rather than a stack of cards.
 *
 * As OX lays it out: one row per variation with every field it carries in a
 * column of its own, scrolling sideways, so a row is filled left to right
 * without opening anything. The name and the "sold" tick stay pinned on the
 * left. The name is not a column you can type in: it is generated from the
 * option values, which is the whole point of options.
 *
 * "Fill down" on cost and price matters more than it looks: variations of one
 * part are usually priced identically, and typing the same number nine times is
 * where a user gives up on the options model and goes back to nine products.
 */
export function ProductVariationsTable({
  form,
  productName,
  variationChoices,
  customFields,
}: {
  form: UseFormReturn<ProductFormValues>
  productName: string
  /** What analogues and bought-together can point at. */
  variationChoices: MultiSelectOption<string>[]
  /** The business's own variation-level columns, one table column each. */
  customFields: ProductField[]
}) {
  const variations = form.watch('variations')
  const errors = form.formState.errors.variations

  const soldCount = variations.filter((v) => v.enabled).length
  const allSold = soldCount === variations.length
  const someSold = soldCount > 0 && !allSold

  const setAllSold = (next: boolean) =>
    variations.forEach((_, index) =>
      form.setValue(`variations.${index}.enabled`, next, { shouldDirty: true }),
    )

  /** Copies the first sold row down onto the others; skips what is not sold. */
  const fillDown = (field: 'costPrice' | 'salePrice') => {
    const source = variations.findIndex((v) => v.enabled)
    if (source === -1) return
    const value = form.getValues(`variations.${source}.${field}`)
    const currency = form.getValues(`variations.${source}.costCurrency`)
    variations.forEach((variation, index) => {
      if (index === source || !variation.enabled) return
      form.setValue(`variations.${index}.${field}`, value, { shouldDirty: true })
      if (field === 'costPrice') {
        form.setValue(`variations.${index}.costCurrency`, currency, { shouldDirty: true })
      }
    })
  }

  const cell = 'px-1.5 py-1.5 align-top'
  const th = 'px-2 py-2 text-left font-semibold whitespace-nowrap'
  /** Pinned left, so the row being filled stays named while the table scrolls sideways. */
  const pinned = 'bg-surface sticky z-10'
  const errorText = (message?: string) =>
    message ? <p className="text-danger text-2xs mt-0.5 whitespace-normal">{message}</p> : null

  return (
    <div className="border-border rounded-card overflow-hidden border">
      <div className="overflow-x-auto">
        <table className="w-max min-w-full text-sm">
          <thead className="bg-canvas">
            <tr className="text-fg-muted text-2xs tracking-wide uppercase">
              <th className={cn(th, 'bg-canvas sticky left-0 z-10 w-10')}>
                <span className="sr-only">Sold</span>
                <Checkbox
                  aria-label={allSold ? 'Stop selling every combination' : 'Sell every combination'}
                  checked={someSold ? 'indeterminate' : allSold}
                  onCheckedChange={(next) => setAllSold(next)}
                />
              </th>
              <th className={cn(th, 'bg-canvas border-border sticky left-10 z-10 border-r')}>
                Variation
              </th>
              <th className={th}>
                SKU<span className="text-danger ml-0.5">*</span>
              </th>
              <th className={th}>Barcode</th>
              <FillableHeader
                label="Cost"
                onFill={() => fillDown('costPrice')}
                many={variations.length > 1}
              />
              <FillableHeader
                label="Sale price"
                required
                onFill={() => fillDown('salePrice')}
                many={variations.length > 1}
              />
              <th className={th}>Landed cost</th>
              <th className={th}>Shelf</th>
              <th className={th}>Zone</th>
              <th className={th}>Mobile SKU</th>
              <th className={th}>Mobile product name</th>
              <th className={th}>Analogues</th>
              <th className={th}>Frequently bought together</th>
              {customFields.map((field) => (
                <th key={field.id} className={th}>
                  {field.name}
                </th>
              ))}
              <th className={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {variations.map((variation, index) => {
              const name = combinationName(variation.optionValues)
              const sold = variation.enabled
              const rowError = errors?.[index]
              return (
                // Keyed by the combination, which is unique by construction:
                // two rows can briefly share an id while options are edited.
                <tr key={name || index} className="border-border border-t">
                  <td className={cn(cell, pinned, 'left-0 px-3 py-3.5')}>
                    <Controller
                      control={form.control}
                      name={`variations.${index}.enabled`}
                      render={({ field }) => (
                        <Checkbox
                          aria-label={`Sell ${name}`}
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      )}
                    />
                  </td>
                  <td className={cn(cell, pinned, 'border-border left-10 border-r px-3 py-3')}>
                    {/* Generated, never typed — the reason options exist. */}
                    <span
                      className={cn(
                        'text-fg whitespace-nowrap',
                        !sold && 'text-fg-subtle line-through',
                      )}
                    >
                      {name}
                    </span>
                    <span className="text-fg-subtle text-2xs block whitespace-nowrap">
                      {sold ? productName : 'not sold'}
                    </span>
                  </td>
                  <td className={cell}>
                    <Input
                      className="w-36"
                      aria-label={`SKU — ${name}`}
                      disabled={!sold}
                      aria-invalid={rowError?.sku ? true : undefined}
                      {...form.register(`variations.${index}.sku`)}
                    />
                    {errorText(rowError?.sku?.message)}
                  </td>
                  <td className={cell}>
                    <Input
                      className="w-36"
                      aria-label={`Barcode — ${name}`}
                      disabled={!sold}
                      {...form.register(`variations.${index}.barcode`)}
                    />
                  </td>
                  <td className={cell}>
                    <div className="flex gap-1.5">
                      <Controller
                        control={form.control}
                        name={`variations.${index}.costPrice`}
                        render={({ field }) => (
                          <NumberField
                            className="w-24"
                            nullable={false}
                            step="any"
                            disabled={!sold}
                            aria-label={`Cost — ${name}`}
                            value={field.value}
                            onChange={(v) => field.onChange(v ?? 0)}
                            onBlur={field.onBlur}
                          />
                        )}
                      />
                      <Controller
                        control={form.control}
                        name={`variations.${index}.costCurrency`}
                        render={({ field }) => (
                          <Select
                            value={field.value}
                            onChange={field.onChange}
                            options={CURRENCIES}
                            disabled={!sold}
                            aria-label={`Cost currency — ${name}`}
                            className="w-20"
                          />
                        )}
                      />
                    </div>
                    {errorText(rowError?.costPrice?.message)}
                  </td>
                  <td className={cell}>
                    <Controller
                      control={form.control}
                      name={`variations.${index}.salePrice`}
                      render={({ field }) => (
                        <NumberField
                          className="w-32"
                          nullable={false}
                          disabled={!sold}
                          aria-label={`Sale price — ${name}`}
                          value={field.value}
                          onChange={(v) => field.onChange(v ?? 0)}
                          onBlur={field.onBlur}
                        />
                      )}
                    />
                    {errorText(rowError?.salePrice?.message)}
                  </td>
                  <td className={cell}>
                    <Controller
                      control={form.control}
                      name={`variations.${index}.landedCost`}
                      render={({ field }) => (
                        <NumberField
                          className="w-32"
                          disabled={!sold}
                          aria-label={`Landed cost — ${name}`}
                          {...fieldProps(field)}
                        />
                      )}
                    />
                    {errorText(rowError?.landedCost?.message)}
                  </td>
                  <td className={cell}>
                    <Input
                      className="w-28"
                      placeholder="A-12-3"
                      aria-label={`Shelf — ${name}`}
                      disabled={!sold}
                      {...form.register(`variations.${index}.shelfAddress`)}
                    />
                  </td>
                  <td className={cell}>
                    <Input
                      className="w-28"
                      placeholder="Zone A"
                      aria-label={`Zone — ${name}`}
                      disabled={!sold}
                      {...form.register(`variations.${index}.zone`)}
                    />
                  </td>
                  <td className={cell}>
                    <Input
                      className="w-36"
                      aria-label={`Mobile SKU — ${name}`}
                      disabled={!sold}
                      {...form.register(`variations.${index}.mobileSku`)}
                    />
                  </td>
                  <td className={cell}>
                    <Input
                      className="w-48"
                      aria-label={`Mobile product name — ${name}`}
                      disabled={!sold}
                      {...form.register(`variations.${index}.mobileName`)}
                    />
                  </td>
                  <td className={cell}>
                    <Controller
                      control={form.control}
                      name={`variations.${index}.analogueIds`}
                      render={({ field }) => (
                        <MultiSelect
                          aria-label={`Analogues — ${name}`}
                          className="w-48"
                          disabled={!sold}
                          value={field.value}
                          onChange={field.onChange}
                          options={variationChoices}
                          placeholder="None"
                        />
                      )}
                    />
                  </td>
                  <td className={cell}>
                    <Controller
                      control={form.control}
                      name={`variations.${index}.boughtTogetherIds`}
                      render={({ field }) => (
                        <MultiSelect
                          aria-label={`Frequently bought together — ${name}`}
                          className="w-48"
                          disabled={!sold}
                          value={field.value}
                          onChange={field.onChange}
                          options={variationChoices}
                          placeholder="None"
                        />
                      )}
                    />
                  </td>
                  {customFields.map((field) => (
                    <td key={field.id} className={cell}>
                      <CustomFieldInput
                        form={form}
                        field={field}
                        name={`variations.${index}.customFields.${field.id}`}
                        className="w-36"
                        disabled={!sold}
                        label={`${field.name} — ${name}`}
                      />
                    </td>
                  ))}
                  <td className={cell}>
                    <Controller
                      control={form.control}
                      name={`variations.${index}.status`}
                      render={({ field }) => (
                        <Select
                          className="w-32"
                          aria-label={`Status — ${name}`}
                          disabled={!sold}
                          value={field.value}
                          onChange={field.onChange}
                          options={[
                            { value: 'active', label: 'Active' },
                            { value: 'archived', label: 'Archived' },
                          ]}
                        />
                      )}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Wires a Controller field onto NumberField without repeating four lines. */
const fieldProps = (field: {
  value: number | null
  onChange: (value: number | null) => void
  onBlur: () => void
}) => ({ value: field.value, onChange: field.onChange, onBlur: field.onBlur })

function FillableHeader({
  label,
  required,
  onFill,
  many,
}: {
  label: string
  required?: boolean
  onFill: () => void
  many: boolean
}) {
  return (
    <th className="px-2 py-2 text-left font-semibold whitespace-nowrap">
      <span className="inline-flex items-center gap-1.5">
        {label}
        {required ? <span className="text-danger">*</span> : null}
        {many ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-5"
            aria-label={`Copy the first ${label.toLowerCase()} to every variation`}
            title="Fill down from the first row"
            onClick={onFill}
          >
            <ArrowDownToLine className="size-3.5" />
          </Button>
        ) : null}
      </span>
    </th>
  )
}
