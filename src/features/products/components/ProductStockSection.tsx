import { Check } from 'lucide-react'
import type { UseFormReturn } from 'react-hook-form'
import { Controller } from 'react-hook-form'
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card'
import { NumberField } from '@/shared/components/NumberField'
import { cn } from '@/shared/lib/cn'
import { formatNumber } from '@/shared/lib/format'
import type { ProductFormValues } from '../model/product'

/**
 * Stock, as its own section, because it answers a different question from the
 * rest of the form: not "what is this part" but "where is it, and how many".
 *
 * Two steps, in the order a user thinks about them. First pick the locations
 * that stock the product at all — a shop that never carries a part should not
 * show a zero, it should show nothing (the reference behaviour in Shopify's
 * "Edit locations"). Then fill in a quantity per variation per location.
 *
 * The form always carries a row for every location and hides the unpicked ones,
 * so toggling a location off and on again does not renumber the fields under
 * react-hook-form. Unpicked rows are dropped on submit.
 */
export function ProductStockSection({
  form,
  locations,
  editing,
}: {
  form: UseFormReturn<ProductFormValues>
  locations: readonly { id: string; name: string }[]
  editing: boolean
}) {
  const locationIds = form.watch('locationIds')
  const variations = form.watch('variations')
  const single = form.watch('variationMode') === 'single'
  const productName = form.watch('name').trim()
  const selected = locations.filter((location) => locationIds.includes(location.id))

  const toggle = (id: string) => {
    const next = locationIds.includes(id)
      ? locationIds.filter((existing) => existing !== id)
      : [...locationIds, id]
    form.setValue('locationIds', next, { shouldValidate: true, shouldDirty: true })
  }

  return (
    <Card>
      <CardHeader className="flex-col items-stretch gap-1">
        <CardTitle>Stock</CardTitle>
        <p className="text-fg-subtle text-2xs">
          {editing
            ? 'Editing a quantity here records a correction against that location.'
            : 'Opening quantities. Everything after this arrives through goods receipt, corrections and stocktaking.'}
        </p>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="space-y-1.5">
          <p className="text-fg-muted text-sm">
            Stocked at<span className="text-danger ml-0.5">*</span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {locations.map((location) => {
              const on = locationIds.includes(location.id)
              return (
                <button
                  key={location.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(location.id)}
                  className={cn(
                    'rounded-control inline-flex items-center gap-1.5 border px-2.5 py-1 text-sm transition-colors',
                    on
                      ? 'border-fg bg-fg text-fg-inverted'
                      : 'border-border text-fg-muted hover:border-border-strong hover:text-fg',
                  )}
                >
                  {on ? <Check className="size-3.5" /> : null}
                  {location.name}
                </button>
              )
            })}
          </div>
          {form.formState.errors.locationIds ? (
            <p className="text-danger text-2xs">{form.formState.errors.locationIds.message}</p>
          ) : null}
        </div>

        {selected.length === 0 ? (
          <p className="text-fg-subtle text-sm">
            Pick a location above to enter quantities against it.
          </p>
        ) : (
          <div className="border-border rounded-card overflow-x-auto border">
            <table className="w-full text-sm">
              <thead className="bg-canvas">
                <tr className="text-fg-muted text-2xs tracking-wide uppercase">
                  <th className="px-3 py-2 text-left font-semibold">
                    {single ? 'Product' : 'Variation'}
                  </th>
                  {selected.map((location) => (
                    <th key={location.id} className="px-3 py-2 text-right font-semibold">
                      {location.name}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {variations.map((variation, index) => {
                  const total = variation.stockByLocation.reduce(
                    (sum, row, rowIndex) =>
                      locationIds.includes(locations[rowIndex]?.id ?? '')
                        ? sum + (Number.isFinite(row.quantity) ? row.quantity : 0)
                        : sum,
                    0,
                  )
                  return (
                    <tr key={index} className="border-border border-t">
                      <td className="text-fg px-3 py-2">
                        {/* The same name the catalogue will list it under. */}
                        {single
                          ? productName || 'This product'
                          : [productName, variation.name.trim()].filter(Boolean).join(' — ') ||
                            `Variation ${index + 1}`}
                        <span className="text-fg-subtle text-2xs ml-2">
                          {variation.sku || 'no SKU'}
                        </span>
                      </td>
                      {locations.map((location, locationIndex) =>
                        locationIds.includes(location.id) ? (
                          <td key={location.id} className="px-2 py-1.5">
                            <Controller
                              control={form.control}
                              name={`variations.${index}.stockByLocation.${locationIndex}.quantity`}
                              render={({ field }) => (
                                <NumberField
                                  className="w-24"
                                  nullable={false}
                                  aria-label={`Quantity at ${location.name}`}
                                  value={field.value}
                                  onChange={(v) => field.onChange(v ?? 0)}
                                  onBlur={field.onBlur}
                                />
                              )}
                            />
                          </td>
                        ) : null,
                      )}
                      <td className="text-fg px-3 py-2 text-right font-medium tabular-nums">
                        {formatNumber(total)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
    </Card>
  )
}
