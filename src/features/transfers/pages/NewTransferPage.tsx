import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router'
import { useFieldArray, useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, ArrowRight, Trash2, Truck } from 'lucide-react'
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
import { formatNumber } from '@/shared/lib/format'
import { useDataStore } from '@/data/store'
import { useCreateTransfer } from '../api/transfers'
import { transferDraftSchema, type TransferDraft } from '../model/transfer'

/**
 * Build a transfer.
 *
 * The source location is chosen first and everything downstream depends on it:
 * the picker reports the quantity **on that shelf** rather than the company
 * total, and each line is checked against it. Picking the source last would
 * mean adding lines against a stock figure that then changes meaning.
 *
 * Sending is offered here as well as on the detail page, because most transfers
 * are written and dispatched in one go; saving as a draft is for the case where
 * someone else does the picking.
 */
export default function NewTransferPage() {
  const navigate = useNavigate()
  const locations = useDataStore((s) => s.locations)
  const variations = useDataStore((s) => s.variations)
  const create = useCreateTransfer()

  const form = useForm<TransferDraft>({
    resolver: zodResolver(transferDraftSchema),
    defaultValues: {
      fromLocationId: locations[0]?.id ?? '',
      toLocationId: '',
      comment: '',
      lines: [],
    },
  })

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'lines' })
  const lines = form.watch('lines')
  const fromLocationId = form.watch('fromLocationId')

  /** What the chosen source holds of one variation, right now. */
  const availableAt = useMemo(
    () => (variationId: string) =>
      variations
        .find((v) => v.id === variationId)
        ?.stockByLocation.find((row) => row.locationId === fromLocationId)?.quantity ?? 0,
    [variations, fromLocationId],
  )

  const totalUnits = lines.reduce(
    (sum, line) => sum + (Number.isFinite(line.requestedQuantity) ? line.requestedQuantity : 0),
    0,
  )

  const submit = (status: 'draft' | 'in_transit') =>
    form.handleSubmit(
      (values) => {
        // Checked here as well as in the store: the store refuses the move, but
        // the form can point at the offending row instead of a toast.
        const over = values.lines.findIndex(
          (line) => line.requestedQuantity > availableAt(line.variationId),
        )
        if (over > -1) {
          form.setError(`lines.${over}.requestedQuantity`, {
            message: `Only ${formatNumber(availableAt(values.lines[over]!.variationId))} here`,
          })
          return
        }

        create.mutate(
          { ...values, status },
          {
            onSuccess: (transfer) => {
              toast.success(
                status === 'draft'
                  ? `${transfer.number} saved as a draft`
                  : `${transfer.number} sent to ${transfer.toLocationName}`,
              )
              navigate(paths.products.transferDetail(transfer.id))
            },
          },
        )
      },
      () => toast.error('Check the highlighted fields'),
    )

  const from = locations.find((l) => l.id === fromLocationId)

  return (
    <form>
      <Button variant="link" size="sm" className="h-auto px-0" asChild>
        <Link to={paths.products.transfers}>
          <ArrowLeft />
          Transfers
        </Link>
      </Button>

      <PageHeader
        title="New transfer"
        description="Take stock off one shelf and put it on another."
        action={
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={submit('draft')}>
              Save as draft
            </Button>
            <Button type="button" variant="primary" onClick={submit('in_transit')}>
              <Truck />
              Send now
            </Button>
          </div>
        }
      />

      <div className="mt-4 space-y-3">
        <Card>
          <CardHeader>
            <CardTitle>Route</CardTitle>
          </CardHeader>
          <CardBody className="grid items-start gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
            <Field label="From" required error={form.formState.errors.fromLocationId?.message}>
              {(p) => (
                <Controller
                  control={form.control}
                  name="fromLocationId"
                  render={({ field }) => (
                    <Select
                      {...p}
                      className="w-full"
                      value={field.value || undefined}
                      onChange={(next) => {
                        field.onChange(next)
                        // Quantities were validated against the old shelf, so
                        // starting over is safer than silently keeping them.
                        if (lines.length) {
                          form.setValue('lines', [])
                          toast.info('Lines cleared — stock differs by location')
                        }
                      }}
                      options={locations.map((l) => ({ value: l.id, label: l.name }))}
                    />
                  )}
                />
              )}
            </Field>
            <div className="text-fg-subtle hidden self-center pt-6 sm:block">
              <ArrowRight className="size-4" />
            </div>
            <Field label="To" required error={form.formState.errors.toLocationId?.message}>
              {(p) => (
                <Controller
                  control={form.control}
                  name="toLocationId"
                  render={({ field }) => (
                    <Select
                      {...p}
                      className="w-full"
                      value={field.value || undefined}
                      onChange={field.onChange}
                      placeholder="Pick a destination"
                      options={locations
                        // The same place at both ends is a no-op, so it is not
                        // offered rather than rejected after the fact.
                        .filter((l) => l.id !== fromLocationId)
                        .map((l) => ({ value: l.id, label: l.name }))}
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
              <CardTitle>Items</CardTitle>
              {lines.length ? (
                <span className="text-fg-muted text-sm tabular-nums">
                  {formatNumber(lines.length)} items · {formatNumber(totalUnits)} units
                </span>
              ) : null}
            </div>
            <p className="text-fg-subtle text-2xs">
              Quantities shown are what {from?.name ?? 'the source'} holds, not the company total.
            </p>
          </CardHeader>
          <CardBody className="space-y-3">
            <ProductPicker
              placeholder={`Search a product to move out of ${from?.name ?? 'the source'}…`}
              disabled={!fromLocationId}
              stockLabel={(variation) => {
                const here = availableAt(variation.id)
                return {
                  text: `${formatNumber(here)} ${variation.unit} here`,
                  muted: here > 0,
                }
              }}
              onPick={(variation) => {
                const existing = lines.findIndex((line) => line.variationId === variation.id)
                if (existing > -1) {
                  // Adding the same part twice means "one more", not a second row.
                  form.setValue(
                    `lines.${existing}.requestedQuantity`,
                    (lines[existing]?.requestedQuantity ?? 0) + 1,
                    { shouldDirty: true },
                  )
                  return
                }
                append({
                  id: `line-${Date.now()}`,
                  variationId: variation.id,
                  productId: variation.productId,
                  sku: variation.sku,
                  name: variation.fullName,
                  imageUrl: variation.imageUrl,
                  unit: variation.unit,
                  requestedQuantity: 1,
                  // Filled in at dispatch and at receipt, when reality is known.
                  sentQuantity: null,
                  receivedQuantity: null,
                  // Snapshotted now, so the document keeps its value later.
                  unitCost: variation.costPrice,
                  costCurrency: variation.costCurrency,
                  unitPrice: variation.salePrice,
                })
              }}
            />

            {form.formState.errors.lines?.root ? (
              <p className="text-danger text-2xs">{form.formState.errors.lines.root.message}</p>
            ) : null}

            {fields.length === 0 ? (
              <p className="text-fg-subtle text-sm">
                Nothing added yet. Search above to put a product on this transfer.
              </p>
            ) : (
              <div className="border-border rounded-card overflow-x-auto border">
                <table className="w-full text-sm">
                  <thead className="bg-canvas">
                    <tr className="text-fg-muted text-2xs tracking-wide uppercase">
                      <th className="px-3 py-2 text-left font-semibold">Product</th>
                      <th className="px-3 py-2 text-left font-semibold">SKU</th>
                      <th className="px-3 py-2 text-right font-semibold">At source</th>
                      <th className="px-3 py-2 text-right font-semibold">Order</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {fields.map((field, index) => {
                      const line = lines[index]
                      const here = line ? availableAt(line.variationId) : 0
                      const error = form.formState.errors.lines?.[index]?.requestedQuantity?.message
                      return (
                        <tr key={field.id} className="border-border border-t">
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2.5">
                              <ProductThumb src={line?.imageUrl ?? null} size="sm" />
                              <span className="font-medium">{line?.name}</span>
                            </div>
                          </td>
                          <td className="text-fg-muted text-2xs px-3 py-2 font-mono">
                            {line?.sku}
                          </td>
                          <td className="text-fg-muted px-3 py-2 text-right tabular-nums">
                            {formatNumber(here)} {line?.unit}
                          </td>
                          <td className="px-2 py-1.5 text-right">
                            <Controller
                              control={form.control}
                              name={`lines.${index}.requestedQuantity`}
                              render={({ field: f }) => (
                                <NumberField
                                  className="w-24"
                                  nullable={false}
                                  min={1}
                                  aria-invalid={error ? true : undefined}
                                  aria-label={`Quantity of ${line?.name}`}
                                  value={f.value}
                                  onChange={(v) => f.onChange(v ?? 0)}
                                  onBlur={f.onBlur}
                                />
                              )}
                            />
                            {error ? <p className="text-danger text-2xs mt-0.5">{error}</p> : null}
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
            <Field label="Comment" hint="Why this is moving — useful when it is queried later">
              {(p) => <Input {...p} placeholder="Weekly top-up" {...form.register('comment')} />}
            </Field>
          </CardBody>
        </Card>
      </div>
    </form>
  )
}
