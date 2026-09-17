import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Controller, type UseFormReturn } from 'react-hook-form'
import { NumberField } from '@/shared/components/NumberField'
import { Checkbox } from '@/shared/ui/Checkbox'
import { Input } from '@/shared/ui/Input'
import { ImageField } from '@/shared/components/ImageField'
import { Select } from '@/shared/ui/Select'
import { cn } from '@/shared/lib/cn'
import { formatNumber } from '@/shared/lib/format'
import { combinationName, type ProductFormValues } from '../model/product'

const CURRENCIES = [
  { value: 'USD', label: 'USD' },
  { value: 'UZS', label: 'UZS' },
]

const STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
]

/**
 * The generated variations, as a spreadsheet rather than a wall of inputs.
 *
 * Twelve columns of boxed fields reads as noise: at a glance you cannot tell
 * what is filled in from what is empty. So a cell shows its **value**, and a
 * double-click turns that one cell into a field — the grid the reference
 * product uses, and the behaviour anybody who has used a spreadsheet expects.
 * Escape leaves without keeping the keystroke, Enter and Tab commit.
 *
 * The "sold" tick and the variation's name stay pinned on the left, so the row
 * being filled is still named once the table is scrolled sideways.
 */
export function ProductVariationsTable({
  form,
  productName,
}: {
  form: UseFormReturn<ProductFormValues>
  productName: string
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

  const cell = 'p-0 align-middle'
  const th = 'px-2.5 py-2 text-left font-semibold whitespace-nowrap'
  const pinned = 'bg-surface sticky z-10'

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
              <th className={th}>Picture</th>
              <th className={th}>Variation name</th>
              <th className={th}>
                SKU<span className="text-danger ml-0.5">*</span>
              </th>
              <th className={th}>Barcode</th>
              <th className={th}>Part</th>
              <th className={th}>OEM</th>
              <th className={th}>Storage address</th>
              <th className={th}>Cost</th>
              <th className={th}>
                Sale price<span className="text-danger ml-0.5">*</span>
              </th>
              <th className={th}>Wholesale price</th>
              <th className={th}>Cargo weight</th>
              <th className={th}>Cargo size</th>
              <th className={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {variations.map((variation, index) => {
              const name = combinationName(variation.optionValues)
              const sold = variation.enabled
              const row = errors?.[index]
              const value = form.watch(`variations.${index}`)
              const money = (amount: number | null, currency: string) =>
                amount === null ? '' : `${formatNumber(amount)} ${currency}`

              return (
                // Keyed by the combination, which is unique by construction:
                // two rows can briefly share an id while options are edited.
                <tr key={name || index} className="border-border border-t">
                  <td className={cn(cell, pinned, 'left-0 px-3')}>
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
                  <td className={cn(cell, pinned, 'border-border left-10 border-r px-3 py-2')}>
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

                  {/* The picture leads the row: it is what tells two variations apart
                      at a glance, and it is a control rather than a cell to open. */}
                  <td className={cn(cell, 'px-2 py-1.5')}>
                    <Controller
                      control={form.control}
                      name={`variations.${index}.imageUrl`}
                      render={({ field }) => (
                        <ImageField size="sm" value={field.value} onChange={field.onChange} />
                      )}
                    />
                  </td>

                  <Cell
                    value={value.name}
                    sold={sold}
                    width="w-36"
                    label={`Variation name — ${name}`}
                  >
                    {() => (
                      <Input
                        className="h-8 w-36"
                        placeholder={name}
                        aria-label={`Variation name — ${name}`}
                        {...form.register(`variations.${index}.name`)}
                      />
                    )}
                  </Cell>

                  <Cell
                    value={value.sku}
                    sold={sold}
                    width="w-36"
                    error={row?.sku?.message}
                    label={`SKU — ${name}`}
                  >
                    {() => (
                      <Input
                        className="h-8 w-36"
                        aria-label={`SKU — ${name}`}
                        aria-invalid={row?.sku ? true : undefined}
                        {...form.register(`variations.${index}.sku`)}
                      />
                    )}
                  </Cell>

                  <Cell value={value.barcode} sold={sold} width="w-36" label={`Barcode — ${name}`}>
                    {() => (
                      <Input
                        className="h-8 w-36"
                        aria-label={`Barcode — ${name}`}
                        {...form.register(`variations.${index}.barcode`)}
                      />
                    )}
                  </Cell>

                  <Cell value={value.partSide} sold={sold} width="w-28" label={`Part — ${name}`}>
                    {() => (
                      <Input
                        className="h-8 w-28"
                        placeholder="Left"
                        aria-label={`Part — ${name}`}
                        {...form.register(`variations.${index}.partSide`)}
                      />
                    )}
                  </Cell>

                  <Cell value={value.oem} sold={sold} width="w-32" label={`OEM — ${name}`}>
                    {() => (
                      <Input
                        className="h-8 w-32"
                        placeholder="1234567"
                        aria-label={`OEM — ${name}`}
                        {...form.register(`variations.${index}.oem`)}
                      />
                    )}
                  </Cell>

                  <Cell
                    value={value.shelfAddress}
                    sold={sold}
                    width="w-32"
                    label={`Storage address — ${name}`}
                  >
                    {() => (
                      <Input
                        className="h-8 w-32"
                        placeholder="1-A-23-4"
                        aria-label={`Storage address — ${name}`}
                        {...form.register(`variations.${index}.shelfAddress`, {
                          // Also runs on the stored value when the form loads, which is null for
                          // a variation without an address — not only on what is typed.
                          setValueAs: (v: string | null) =>
                            typeof v === 'string' ? v.trim() || null : null,
                        })}
                      />
                    )}
                  </Cell>

                  <Cell
                    value={money(value.costPrice, value.costCurrency)}
                    sold={sold}
                    width="w-40"
                    align="right"
                    error={row?.costPrice?.message}
                    label={`Cost — ${name}`}
                  >
                    {() => (
                      <div className="flex gap-1.5">
                        <Controller
                          control={form.control}
                          name={`variations.${index}.costPrice`}
                          render={({ field }) => (
                            <NumberField
                              className="h-8 w-24"
                              nullable={false}
                              step="any"
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
                              aria-label={`Cost currency — ${name}`}
                              className="h-8 w-20"
                            />
                          )}
                        />
                      </div>
                    )}
                  </Cell>

                  <Cell
                    value={money(value.salePrice, value.saleCurrency)}
                    sold={sold}
                    width="w-44"
                    align="right"
                    error={row?.salePrice?.message}
                    label={`Sale price — ${name}`}
                  >
                    {() => (
                      <div className="flex gap-1.5">
                        <Controller
                          control={form.control}
                          name={`variations.${index}.salePrice`}
                          render={({ field }) => (
                            <NumberField
                              className="h-8 w-28"
                              nullable={false}
                              aria-label={`Sale price — ${name}`}
                              value={field.value}
                              onChange={(v) => field.onChange(v ?? 0)}
                              onBlur={field.onBlur}
                            />
                          )}
                        />
                        <Controller
                          control={form.control}
                          name={`variations.${index}.saleCurrency`}
                          render={({ field }) => (
                            <Select
                              value={field.value}
                              onChange={field.onChange}
                              options={CURRENCIES}
                              aria-label={`Sale price currency — ${name}`}
                              className="h-8 w-20"
                            />
                          )}
                        />
                      </div>
                    )}
                  </Cell>

                  <Cell
                    value={money(value.wholesalePrice, value.wholesaleCurrency)}
                    sold={sold}
                    width="w-44"
                    align="right"
                    label={`Wholesale price — ${name}`}
                  >
                    {() => (
                      <div className="flex gap-1.5">
                        <Controller
                          control={form.control}
                          name={`variations.${index}.wholesalePrice`}
                          render={({ field }) => (
                            <NumberField
                              className="h-8 w-28"
                              aria-label={`Wholesale price — ${name}`}
                              value={field.value}
                              onChange={field.onChange}
                              onBlur={field.onBlur}
                            />
                          )}
                        />
                        <Controller
                          control={form.control}
                          name={`variations.${index}.wholesaleCurrency`}
                          render={({ field }) => (
                            <Select
                              value={field.value}
                              onChange={field.onChange}
                              options={CURRENCIES}
                              aria-label={`Wholesale price currency — ${name}`}
                              className="h-8 w-20"
                            />
                          )}
                        />
                      </div>
                    )}
                  </Cell>

                  <Cell
                    value={
                      value.cargoWeightKg === null ? '' : `${formatNumber(value.cargoWeightKg)} kg`
                    }
                    sold={sold}
                    width="w-28"
                    align="right"
                    label={`Cargo weight — ${name}`}
                  >
                    {() => (
                      <Controller
                        control={form.control}
                        name={`variations.${index}.cargoWeightKg`}
                        render={({ field }) => (
                          <NumberField
                            className="h-8 w-24"
                            step="any"
                            aria-label={`Cargo weight — ${name}`}
                            value={field.value}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                          />
                        )}
                      />
                    )}
                  </Cell>

                  <Cell
                    value={value.cargoSize}
                    sold={sold}
                    width="w-28"
                    label={`Cargo size — ${name}`}
                  >
                    {() => (
                      <Input
                        className="h-8 w-28"
                        placeholder="120*60*30"
                        aria-label={`Cargo size — ${name}`}
                        {...form.register(`variations.${index}.cargoSize`)}
                      />
                    )}
                  </Cell>

                  <Cell
                    value={value.status === 'active' ? 'Active' : 'Archived'}
                    sold={sold}
                    width="w-28"
                    label={`Status — ${name}`}
                  >
                    {() => (
                      <Controller
                        control={form.control}
                        name={`variations.${index}.status`}
                        render={({ field }) => (
                          <Select
                            className="h-8 w-28"
                            aria-label={`Status — ${name}`}
                            value={field.value}
                            onChange={field.onChange}
                            options={STATUSES}
                          />
                        )}
                      />
                    )}
                  </Cell>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="border-border text-fg-subtle border-t px-3 py-2 text-[11px]">
        Double-click a cell to change it. Escape leaves it as it was.
      </p>
    </div>
  )
}

/**
 * One cell: its value until somebody double-clicks it, then the field itself.
 * The field is focused on open and closes on blur, Enter, Tab or Escape.
 */
function Cell({
  value,
  children,
  sold,
  width,
  align = 'left',
  error,
  label,
}: {
  value: string | number | null
  children: () => ReactNode
  sold: boolean
  width: string
  align?: 'left' | 'right'
  error?: string
  label: string
}) {
  const [editing, setEditing] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!editing) return
    // The first control in the cell takes focus, and text is selected so a
    // double-click into a filled cell can simply be typed over.
    const field = box.current?.querySelector('input, [role="combobox"], button')
    if (field instanceof HTMLInputElement) {
      field.focus()
      field.select()
    } else if (field instanceof HTMLElement) field.focus()
  }, [editing])

  const shown = value === null || value === '' ? null : String(value)

  return (
    <td className={cn('p-0 align-middle', align === 'right' && 'text-right')}>
      {editing ? (
        <div
          ref={box}
          className="px-2 py-1.5"
          onBlur={(event) => {
            // Leaving for another control inside the same cell — a currency
            // select beside its amount — is not leaving the cell.
            if (!event.currentTarget.contains(event.relatedTarget as Node)) setEditing(false)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape' || event.key === 'Enter') {
              event.preventDefault()
              setEditing(false)
            }
          }}
        >
          {children()}
        </div>
      ) : (
        <button
          type="button"
          disabled={!sold}
          aria-label={`${label} — double-click to change`}
          onDoubleClick={() => setEditing(true)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              setEditing(true)
            }
          }}
          className={cn(
            'hover:bg-surface-muted focus-visible:ring-ring/40 block h-11 px-2.5 text-left focus-visible:ring-2 focus-visible:outline-none',
            width,
            align === 'right' && 'text-right',
            !sold && 'cursor-not-allowed opacity-50',
          )}
        >
          <span className={cn('block truncate', error && 'text-danger')}>
            {shown ?? <span className="text-fg-subtle">—</span>}
          </span>
          {error ? <span className="text-danger text-2xs block truncate">{error}</span> : null}
        </button>
      )}
    </td>
  )
}
