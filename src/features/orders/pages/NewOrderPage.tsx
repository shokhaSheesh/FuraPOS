import { Link, useNavigate } from 'react-router'
import { useFieldArray, useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Send, Trash2 } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { Field } from '@/shared/components/Field'
import { NumberField } from '@/shared/components/NumberField'
import { ProductPicker } from '@/shared/components/ProductPicker'
import { ProductThumb } from '@/shared/components/ProductThumb'
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { Select } from '@/shared/ui/Select'
import { DatePicker } from '@/shared/ui/DatePicker'
import { toast } from '@/shared/ui/toast'
import { paths } from '@/shared/config/paths'
import { formatMoney, formatNumber } from '@/shared/lib/format'
import { useDataStore } from '@/data/store'
import { USD_RATE } from '@/data/seed'
import { useCreateOrder } from '../api/orders'
import { orderDraftSchema, toUzs, type OrderDraft } from '../model/order'

const CURRENCIES = [
  { value: 'USD', label: 'USD' },
  { value: 'UZS', label: 'UZS' },
]

/**
 * Raise an order.
 *
 * The price is editable per line and defaults to the last known cost, because
 * an order is where a price is *agreed* — it is the number a delivery will be
 * checked against, and taking it from the catalogue without letting anyone
 * change it would make the check meaningless.
 */
export default function NewOrderPage() {
  const navigate = useNavigate()
  const suppliers = useDataStore((s) => s.suppliers)
  const locations = useDataStore((s) => s.locations)
  const create = useCreateOrder()

  const form = useForm<OrderDraft>({
    resolver: zodResolver(orderDraftSchema),
    defaultValues: {
      supplierId: '',
      locationId: locations[0]?.id ?? '',
      expectedAt: null,
      comment: '',
      lines: [],
    },
  })

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'lines' })
  const lines = form.watch('lines')

  const total = lines.reduce(
    (sum, line) => sum + line.orderedQuantity * toUzs(line.unitCost, line.costCurrency, USD_RATE),
    0,
  )
  const units = lines.reduce((sum, line) => sum + line.orderedQuantity, 0)

  const submit = (status: 'draft' | 'sent') =>
    form.handleSubmit(
      (values) => {
        create.mutate(
          { ...values, status },
          {
            onSuccess: (order) => {
              toast.success(
                status === 'draft'
                  ? `${order.number} saved as a draft`
                  : `${order.number} sent to ${order.supplierName}`,
              )
              navigate(paths.procurement.orderDetail(order.id))
            },
          },
        )
      },
      () => toast.error('Check the highlighted fields'),
    )

  return (
    <form>
      <Button variant="link" size="sm" className="h-auto px-0" asChild>
        <Link to={paths.procurement.orders}>
          <ArrowLeft />
          Orders
        </Link>
      </Button>

      <PageHeader
        title="New order"
        description="What to ask a supplier for, and at what price. The delivery gets checked against it."
        action={
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={submit('draft')}>
              Save as draft
            </Button>
            <Button type="button" variant="primary" onClick={submit('sent')}>
              <Send />
              Send to supplier
            </Button>
          </div>
        }
      />

      <div className="mt-4 space-y-3">
        <Card>
          <CardHeader>
            <CardTitle>Order</CardTitle>
          </CardHeader>
          <CardBody className="grid gap-3 sm:grid-cols-3">
            <Field label="Supplier" required error={form.formState.errors.supplierId?.message}>
              {(p) => (
                <Controller
                  control={form.control}
                  name="supplierId"
                  render={({ field }) => (
                    <Select
                      {...p}
                      className="w-full"
                      value={field.value || undefined}
                      onChange={field.onChange}
                      placeholder="Pick a supplier"
                      options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
                    />
                  )}
                />
              )}
            </Field>
            <Field label="Landing at" required error={form.formState.errors.locationId?.message}>
              {(p) => (
                <Controller
                  control={form.control}
                  name="locationId"
                  render={({ field }) => (
                    <Select
                      {...p}
                      className="w-full"
                      value={field.value || undefined}
                      onChange={field.onChange}
                      options={locations.map((l) => ({ value: l.id, label: l.name }))}
                    />
                  )}
                />
              )}
            </Field>
            <Field
              label="Expected"
              hint="When they promised it. Without a date nothing can be late."
            >
              {() => (
                <Controller
                  control={form.control}
                  name="expectedAt"
                  render={({ field }) => (
                    <DatePicker
                      className="w-full"
                      // The form carries an ISO string; the picker deals in
                      // dates, so the conversion happens at the boundary.
                      value={field.value ? new Date(field.value) : null}
                      onChange={(date) => field.onChange(date ? date.toISOString() : null)}
                      minDate={new Date()}
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
                  {formatNumber(units)} units · {formatMoney(Math.round(total))}
                </span>
              ) : null}
            </div>
            <p className="text-fg-subtle text-2xs">
              The price defaults to what it last cost. Change it to what was agreed — that is the
              number the delivery will be checked against.
            </p>
          </CardHeader>
          <CardBody className="space-y-3">
            <ProductPicker
              placeholder="Search a product to add to this order…"
              onPick={(variation) => {
                const existing = lines.findIndex((line) => line.variationId === variation.id)
                if (existing > -1) {
                  form.setValue(
                    `lines.${existing}.orderedQuantity`,
                    (lines[existing]?.orderedQuantity ?? 0) + 1,
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
                  orderedQuantity: variation.moq ?? 1,
                  receivedQuantity: 0,
                  unitCost: variation.costPrice,
                  costCurrency: variation.costCurrency,
                })
              }}
            />

            {form.formState.errors.lines?.root ? (
              <p className="text-danger text-2xs">{form.formState.errors.lines.root.message}</p>
            ) : null}

            {fields.length === 0 ? (
              <p className="text-fg-subtle text-sm">
                Nothing added yet. Search above to put a product on this order.
              </p>
            ) : (
              <div className="border-border rounded-card overflow-x-auto border">
                <table className="w-full text-sm">
                  <thead className="bg-canvas">
                    <tr className="text-fg-muted text-2xs tracking-wide uppercase">
                      <th className="px-3 py-2 text-left font-semibold">Product</th>
                      <th className="px-3 py-2 text-right font-semibold">Quantity</th>
                      <th className="px-3 py-2 text-right font-semibold">Agreed price</th>
                      <th className="px-3 py-2 text-right font-semibold">Line total</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {fields.map((field, index) => {
                      const line = lines[index]
                      return (
                        <tr key={field.id} className="border-border border-t">
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2.5">
                              <ProductThumb src={line?.imageUrl ?? null} size="sm" />
                              <div className="min-w-0">
                                <p className="text-fg font-medium">{line?.name}</p>
                                <p className="text-fg-subtle text-2xs font-mono">{line?.sku}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-2 py-1.5 text-right">
                            <Controller
                              control={form.control}
                              name={`lines.${index}.orderedQuantity`}
                              render={({ field: f }) => (
                                <NumberField
                                  className="w-24"
                                  nullable={false}
                                  min={1}
                                  aria-label={`Quantity of ${line?.name}`}
                                  value={f.value}
                                  onChange={(next) => f.onChange(Math.max(1, next ?? 1))}
                                  onBlur={f.onBlur}
                                />
                              )}
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <div className="flex justify-end gap-1.5">
                              <Controller
                                control={form.control}
                                name={`lines.${index}.unitCost`}
                                render={({ field: f }) => (
                                  <NumberField
                                    className="w-28"
                                    nullable={false}
                                    step="any"
                                    aria-label={`Price of ${line?.name}`}
                                    value={f.value}
                                    onChange={(next) => f.onChange(next ?? 0)}
                                    onBlur={f.onBlur}
                                  />
                                )}
                              />
                              <Controller
                                control={form.control}
                                name={`lines.${index}.costCurrency`}
                                render={({ field: f }) => (
                                  <Select
                                    value={f.value}
                                    onChange={f.onChange}
                                    options={CURRENCIES}
                                    aria-label="Currency"
                                    className="w-20"
                                  />
                                )}
                              />
                            </div>
                          </td>
                          <td className="text-fg px-3 py-2 text-right font-medium tabular-nums">
                            {line
                              ? formatMoney(
                                  Math.round(
                                    line.orderedQuantity *
                                      toUzs(line.unitCost, line.costCurrency, USD_RATE),
                                  ),
                                )
                              : '—'}
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
            <Field label="Comment" hint="Anything worth knowing when this is chased later">
              {(p) => <Input {...p} placeholder="Container 4" {...form.register('comment')} />}
            </Field>
          </CardBody>
        </Card>
      </div>
    </form>
  )
}
