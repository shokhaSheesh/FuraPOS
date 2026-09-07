import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router'
import { useFieldArray, useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { Field } from '@/shared/components/Field'
import { NumberField } from '@/shared/components/NumberField'
import { ProductPicker } from '@/shared/components/ProductPicker'
import { ProductThumb } from '@/shared/components/ProductThumb'
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { Select } from '@/shared/ui/Select'
import { toast } from '@/shared/ui/toast'
import { paths } from '@/shared/config/paths'
import { formatMoney, formatNumber } from '@/shared/lib/format'
import { useDataStore } from '@/data/store'
import { USD_RATE } from '@/data/seed'
import { useCreateCorrection } from '../api/corrections'
import {
  CORRECTION_REASONS,
  correctionDraftSchema,
  type CorrectionDraft,
} from '../model/correction'

/**
 * Record a correction.
 *
 * The user types **what is actually on the shelf**, never the difference —
 * that is how counting works, and asking for "−2" invites a sign error that
 * silently doubles a loss. The delta is derived and shown as it is typed.
 *
 * It applies the moment it is saved: whoever counts, records. A review step
 * would sit between this screen and the stock movement without changing
 * anything here.
 */
export default function NewCorrectionPage() {
  const navigate = useNavigate()
  const locations = useDataStore((s) => s.locations)
  const variations = useDataStore((s) => s.variations)
  const create = useCreateCorrection()

  const form = useForm<CorrectionDraft>({
    resolver: zodResolver(correctionDraftSchema),
    defaultValues: {
      locationId: locations[0]?.id ?? '',
      reason: 'damaged',
      comment: '',
      lines: [],
    },
  })

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'lines' })
  const lines = form.watch('lines')
  const locationId = form.watch('locationId')
  const location = locations.find((l) => l.id === locationId)

  const stockAt = useMemo(
    () => (variationId: string) =>
      variations
        .find((v) => v.id === variationId)
        ?.stockByLocation.find((row) => row.locationId === locationId)?.quantity ?? 0,
    [variations, locationId],
  )

  const totals = lines.reduce(
    (acc, line) => {
      const delta = (line.countedAfter ?? 0) - line.countedBefore
      const unit = line.costCurrency === 'USD' ? line.unitCost * USD_RATE : line.unitCost
      return { units: acc.units + delta, value: acc.value + delta * unit }
    },
    { units: 0, value: 0 },
  )

  const submit = form.handleSubmit(
    (values) => {
      create.mutate(
        { ...values, lines: values.lines },
        {
          onSuccess: (correction) => {
            toast.success(`${correction.number} applied at ${correction.locationName}`)
            navigate(paths.products.correctionDetail(correction.id))
          },
        },
      )
    },
    () => toast.error('Check the highlighted fields'),
  )

  return (
    <form>
      <Button variant="link" size="sm" className="h-auto px-0" asChild>
        <Link to={paths.products.corrections}>
          <ArrowLeft />
          Corrections
        </Link>
      </Button>

      <PageHeader
        title="New correction"
        description="Record what is really on the shelf, and why it differs."
        action={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate(paths.products.corrections)}
            >
              Cancel
            </Button>
            <Button type="button" variant="primary" onClick={submit}>
              Apply correction
            </Button>
          </div>
        }
      />

      <div className="mt-4 space-y-3">
        <Card>
          <CardHeader>
            <CardTitle>What and where</CardTitle>
          </CardHeader>
          <CardBody className="grid gap-3 sm:grid-cols-2">
            <Field label="Location" required error={form.formState.errors.locationId?.message}>
              {(p) => (
                <Controller
                  control={form.control}
                  name="locationId"
                  render={({ field }) => (
                    <Select
                      {...p}
                      className="w-full"
                      value={field.value || undefined}
                      onChange={(next) => {
                        field.onChange(next)
                        // The counts were read off a different shelf, so they
                        // mean nothing here.
                        if (lines.length) {
                          form.setValue('lines', [])
                          toast.info('Lines cleared — counts are per location')
                        }
                      }}
                      options={locations.map((l) => ({ value: l.id, label: l.name }))}
                    />
                  )}
                />
              )}
            </Field>
            <Field
              label="Reason"
              required
              hint="The whole point of the document — “stock went from 9 to 7” is not information"
              error={form.formState.errors.reason?.message}
            >
              {(p) => (
                <Controller
                  control={form.control}
                  name="reason"
                  render={({ field }) => (
                    <Select
                      {...p}
                      className="w-full"
                      value={field.value}
                      onChange={field.onChange}
                      options={CORRECTION_REASONS.map((r) => ({
                        value: r.value,
                        label: r.label,
                      }))}
                    />
                  )}
                />
              )}
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="flex-col items-stretch gap-1">
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Counts</CardTitle>
              {lines.length ? (
                <span
                  className={`text-sm font-medium tabular-nums ${
                    totals.units < 0
                      ? 'text-danger'
                      : totals.units > 0
                        ? 'text-success'
                        : 'text-fg-muted'
                  }`}
                >
                  {totals.units > 0 ? '+' : totals.units < 0 ? '−' : ''}
                  {formatNumber(Math.abs(totals.units))} units · {totals.value < 0 ? '−' : ''}
                  {formatMoney(Math.abs(totals.value))}
                </span>
              ) : null}
            </div>
            <p className="text-fg-subtle text-2xs">
              Enter what you counted, not the difference. {location?.name ?? 'The location'}&rsquo;s
              current figure is shown beside it.
            </p>
          </CardHeader>
          <CardBody className="space-y-3">
            <ProductPicker
              placeholder={`Search a product to recount at ${location?.name ?? 'this location'}…`}
              disabled={!locationId}
              stockLabel={(variation) => {
                const here = stockAt(variation.id)
                return { text: `${formatNumber(here)} ${variation.unit} here`, muted: here > 0 }
              }}
              onPick={(variation) => {
                if (lines.some((line) => line.variationId === variation.id)) {
                  toast.info(`${variation.fullName} is already on this correction`)
                  return
                }
                const here = stockAt(variation.id)
                append({
                  id: `line-${Date.now()}`,
                  variationId: variation.id,
                  productId: variation.productId,
                  sku: variation.sku,
                  name: variation.fullName,
                  imageUrl: variation.imageUrl,
                  unit: variation.unit,
                  countedBefore: here,
                  // Starts at the current figure, so an untouched row is a
                  // no-op rather than an accidental write-off to zero.
                  countedAfter: here,
                  unitCost: variation.costPrice,
                  costCurrency: variation.costCurrency,
                })
              }}
            />

            {form.formState.errors.lines?.message || form.formState.errors.lines?.root ? (
              <p className="text-danger text-2xs">
                {form.formState.errors.lines.message ?? form.formState.errors.lines.root?.message}
              </p>
            ) : null}

            {fields.length === 0 ? (
              <p className="text-fg-subtle text-sm">
                Nothing added yet. Search above to recount a product.
              </p>
            ) : (
              <div className="border-border rounded-card overflow-x-auto border">
                <table className="w-full text-sm">
                  <thead className="bg-canvas">
                    <tr className="text-fg-muted text-2xs tracking-wide uppercase">
                      <th className="px-3 py-2 text-left font-semibold">Product</th>
                      <th className="px-3 py-2 text-right font-semibold">System says</th>
                      <th className="px-3 py-2 text-right font-semibold">Counted</th>
                      <th className="px-3 py-2 text-right font-semibold">Change</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {fields.map((field, index) => {
                      const line = lines[index]
                      const delta = (line?.countedAfter ?? 0) - (line?.countedBefore ?? 0)
                      const error = form.formState.errors.lines?.[index]?.countedAfter?.message
                      return (
                        <tr key={field.id} className="border-border border-t">
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2.5">
                              <ProductThumb src={line?.imageUrl ?? null} size="sm" />
                              <div className="min-w-0">
                                <p className="font-medium">{line?.name}</p>
                                <p className="text-fg-subtle text-2xs font-mono">{line?.sku}</p>
                              </div>
                            </div>
                          </td>
                          <td className="text-fg-muted px-3 py-2 text-right tabular-nums">
                            {formatNumber(line?.countedBefore ?? 0)} {line?.unit}
                          </td>
                          <td className="px-2 py-1.5 text-right">
                            <Controller
                              control={form.control}
                              name={`lines.${index}.countedAfter`}
                              render={({ field: f }) => (
                                <NumberField
                                  className="w-24"
                                  nullable={false}
                                  min={0}
                                  aria-invalid={error ? true : undefined}
                                  aria-label={`Counted ${line?.name}`}
                                  value={f.value}
                                  onChange={(v) => f.onChange(v ?? 0)}
                                  onBlur={f.onBlur}
                                />
                              )}
                            />
                            {error ? <p className="text-danger text-2xs mt-0.5">{error}</p> : null}
                          </td>
                          <td
                            className={`px-3 py-2 text-right font-medium tabular-nums ${
                              delta === 0
                                ? 'text-fg-subtle'
                                : delta < 0
                                  ? 'text-danger'
                                  : 'text-success'
                            }`}
                          >
                            {delta === 0
                              ? 'no change'
                              : `${delta > 0 ? '+' : '−'}${formatNumber(Math.abs(delta))}`}
                          </td>
                          <td className="px-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label={`Remove ${line?.name}`}
                              className="hover:text-danger"
                              onClick={() => remove(index)}
                            >
                              <Trash2 />
                            </Button>
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

        <Card>
          <CardHeader>
            <CardTitle>Note</CardTitle>
          </CardHeader>
          <CardBody>
            <Field label="Comment" hint="What happened, in the words you would use to explain it">
              {(p) => (
                <Input
                  {...p}
                  placeholder="Dropped during unloading"
                  {...form.register('comment')}
                />
              )}
            </Field>
          </CardBody>
        </Card>
      </div>
    </form>
  )
}
