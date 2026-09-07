import { Fragment, useState } from 'react'
import { ChevronRight, ArrowDownToLine } from 'lucide-react'
import { Controller, type UseFormReturn } from 'react-hook-form'
import { Field } from '@/shared/components/Field'
import { NumberField } from '@/shared/components/NumberField'
import { Button } from '@/shared/ui/Button'
import { Checkbox } from '@/shared/ui/Checkbox'
import { Input } from '@/shared/ui/Input'
import { Select } from '@/shared/ui/Select'
import { cn } from '@/shared/lib/cn'
import { PART_SIDES, combinationName, isSideOption, type ProductFormValues } from '../model/product'

const CURRENCIES = [
  { value: 'USD', label: 'USD' },
  { value: 'UZS', label: 'UZS' },
]

/**
 * The generated variations, as a table rather than a stack of cards.
 *
 * Two options of three values each is nine variations; nine cards of eleven
 * fields is a page nobody scrolls. So the columns are the four things that
 * differ on every row — name, SKU, barcode and the two prices — and the rest
 * open per row. The name is not a column you can type in: it is generated from
 * the option values, which is the whole point of options.
 *
 * "Fill down" on cost and price matters more than it looks: variations of one
 * part are usually priced identically, and typing the same number nine times is
 * where a user gives up on the options model and goes back to nine products.
 */
export function ProductVariationsTable({
  form,
  productName,
}: {
  form: UseFormReturn<ProductFormValues>
  productName: string
}) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const variations = form.watch('variations')
  const options = form.watch('options')
  const errors = form.formState.errors.variations

  /** Side is driven by its option when there is one, so we never ask twice. */
  const sideFromOption = options.some(isSideOption)

  const toggle = (index: number) =>
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })

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

  return (
    <div className="border-border rounded-card overflow-hidden border">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-canvas">
            <tr className="text-fg-muted text-2xs tracking-wide uppercase">
              <th className="w-8" />
              <th className="w-10 px-3 py-2 text-left font-semibold">
                <span className="sr-only">Sold</span>
                <Checkbox
                  aria-label={allSold ? 'Stop selling every combination' : 'Sell every combination'}
                  checked={someSold ? 'indeterminate' : allSold}
                  onCheckedChange={(next) => setAllSold(next)}
                />
              </th>
              <th className="px-3 py-2 text-left font-semibold">Variation</th>
              <th className="px-3 py-2 text-left font-semibold">
                SKU<span className="text-danger ml-0.5">*</span>
              </th>
              <th className="px-3 py-2 text-left font-semibold">Barcode</th>
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
            </tr>
          </thead>
          <tbody>
            {variations.map((variation, index) => {
              const name = combinationName(variation.optionValues)
              const sold = variation.enabled
              const open = expanded.has(index) && sold
              const rowError = errors?.[index]
              return (
                // Keyed by the combination, which is unique by construction:
                // two rows can briefly share an id while options are edited.
                <Fragment key={name || index}>
                  <tr className="border-border border-t align-middle">
                    <td className="pl-2">
                      <button
                        type="button"
                        onClick={() => toggle(index)}
                        aria-expanded={open}
                        disabled={!sold}
                        aria-label={`More fields for ${name}`}
                        className="text-fg-subtle hover:text-fg grid size-6 place-items-center disabled:opacity-30"
                      >
                        <ChevronRight
                          className={cn('size-4 transition-transform', open && 'rotate-90')}
                        />
                      </button>
                    </td>
                    <td className="px-3 py-2">
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
                    <td className="px-3 py-2">
                      {/* Generated, never typed — the reason options exist. */}
                      <span className={cn('text-fg', !sold && 'text-fg-subtle line-through')}>
                        {name}
                      </span>
                      <span className="text-fg-subtle text-2xs ml-2">
                        {sold ? productName : 'not sold'}
                      </span>
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        className="w-36"
                        aria-label="SKU"
                        disabled={!sold}
                        aria-invalid={rowError?.sku ? true : undefined}
                        {...form.register(`variations.${index}.sku`)}
                      />
                      {rowError?.sku ? (
                        <p className="text-danger text-2xs mt-0.5">{rowError.sku.message}</p>
                      ) : null}
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        className="w-36"
                        aria-label="Barcode"
                        disabled={!sold}
                        {...form.register(`variations.${index}.barcode`)}
                      />
                    </td>
                    <td className="px-2 py-1.5">
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
                              aria-label="Cost"
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
                              aria-label="Cost currency"
                              className="w-20"
                            />
                          )}
                        />
                      </div>
                    </td>
                    <td className="px-2 py-1.5">
                      <Controller
                        control={form.control}
                        name={`variations.${index}.salePrice`}
                        render={({ field }) => (
                          <NumberField
                            className="w-32"
                            nullable={false}
                            disabled={!sold}
                            aria-label="Sale price"
                            value={field.value}
                            onChange={(v) => field.onChange(v ?? 0)}
                            onBlur={field.onBlur}
                          />
                        )}
                      />
                    </td>
                  </tr>

                  {open ? (
                    <tr className="bg-canvas/50">
                      <td colSpan={2} />
                      <td colSpan={5} className="px-3 pt-1 pb-3">
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          <Field
                            label="Discounted price"
                            hint="Leave empty for none"
                            error={rowError?.discountPrice?.message}
                          >
                            {(p) => (
                              <Controller
                                control={form.control}
                                name={`variations.${index}.discountPrice`}
                                render={({ field }) => (
                                  <NumberField {...p} {...fieldProps(field)} />
                                )}
                              />
                            )}
                          </Field>
                          <Field
                            label="Reorder point"
                            hint="Warn below this"
                            error={rowError?.lowStockThreshold?.message}
                          >
                            {(p) => (
                              <Controller
                                control={form.control}
                                name={`variations.${index}.lowStockThreshold`}
                                render={({ field }) => (
                                  <NumberField {...p} {...fieldProps(field)} />
                                )}
                              />
                            )}
                          </Field>
                          <Field label="Shelf">
                            {(p) => (
                              <Input
                                {...p}
                                placeholder="A-12-3"
                                {...form.register(`variations.${index}.shelfAddress`)}
                              />
                            )}
                          </Field>
                          <Field label="MOQ" hint="Supplier minimum" error={rowError?.moq?.message}>
                            {(p) => (
                              <Controller
                                control={form.control}
                                name={`variations.${index}.moq`}
                                render={({ field }) => (
                                  <NumberField {...p} min={1} {...fieldProps(field)} />
                                )}
                              />
                            )}
                          </Field>
                          {sideFromOption ? null : (
                            <Field label="Side" hint="Which side of the vehicle it fits">
                              {(p) => (
                                <Controller
                                  control={form.control}
                                  name={`variations.${index}.partSide`}
                                  render={({ field }) => (
                                    <Select
                                      {...p}
                                      className="w-full"
                                      value={field.value ?? undefined}
                                      onChange={field.onChange}
                                      options={PART_SIDES}
                                      placeholder="Not sided"
                                    />
                                  )}
                                />
                              )}
                            </Field>
                          )}
                          <Field label="Status">
                            {(p) => (
                              <Controller
                                control={form.control}
                                name={`variations.${index}.status`}
                                render={({ field }) => (
                                  <Select
                                    {...p}
                                    className="w-full"
                                    value={field.value}
                                    onChange={field.onChange}
                                    options={[
                                      { value: 'active', label: 'Active' },
                                      { value: 'archived', label: 'Archived' },
                                    ]}
                                  />
                                )}
                              />
                            )}
                          </Field>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
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
    <th className="px-3 py-2 text-left font-semibold">
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
