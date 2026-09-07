import { Link, useNavigate } from 'react-router'
import { useFieldArray, useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, PackageCheck, Plus, Trash2 } from 'lucide-react'
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
import { formatMoney, formatNumber, formatPercent } from '@/shared/lib/format'
import { useDataStore } from '@/data/store'
import { USD_RATE } from '@/data/seed'
import { useCreateReceipt, useSuppliers } from '../api/receipts'
import {
  landedUnitCost,
  receiptDraftSchema,
  supplierTotal,
  extraCostsTotal,
  toUzs,
  type ReceiptDraft,
} from '../model/receipt'

const CURRENCIES = [
  { value: 'USD', label: 'USD' },
  { value: 'UZS', label: 'UZS' },
]

/** Named so a first-time user sees what "additional cost" is meant to mean. */
const COMMON_COSTS = ['Freight', 'Customs duty', 'Broker fee', 'Insurance']

/**
 * Record a delivery.
 *
 * The screen exists to answer one question the supplier's invoice cannot: what
 * did this actually cost once it was on our shelf. Freight and duty are entered
 * as their own lines and spread across the goods by value, and the landed cost
 * per unit updates as they are typed — so the person entering the invoice can
 * see the margin they are really buying, not the one the invoice implies.
 */
export default function NewGoodsReceiptPage() {
  const navigate = useNavigate()
  const locations = useDataStore((s) => s.locations)
  const { data: suppliers } = useSuppliers()
  const create = useCreateReceipt()

  const form = useForm<ReceiptDraft>({
    resolver: zodResolver(receiptDraftSchema),
    defaultValues: {
      supplierId: null,
      invoiceNumber: '',
      locationId: locations[0]?.id ?? '',
      comment: '',
      lines: [],
      additionalCosts: [],
    },
  })

  const lineArray = useFieldArray({ control: form.control, name: 'lines' })
  const costArray = useFieldArray({ control: form.control, name: 'additionalCosts' })
  const lines = form.watch('lines')
  const additionalCosts = form.watch('additionalCosts')
  const locationId = form.watch('locationId')

  // The draft is shaped like a receipt already, so the model's own arithmetic
  // can price it live rather than the page re-deriving it.
  const draft = { lines: lines.map((l) => ({ ...l, receivedQuantity: null })), additionalCosts }
  const goods = supplierTotal(draft, USD_RATE)
  const extras = extraCostsTotal(draft, USD_RATE)

  const submit = (status: 'draft' | 'received') =>
    form.handleSubmit(
      (values) => {
        create.mutate(
          { ...values, status },
          {
            onSuccess: (receipt) => {
              toast.success(
                status === 'draft'
                  ? `${receipt.number} saved as a draft`
                  : `${receipt.number} posted into ${receipt.locationName}`,
              )
              navigate(paths.products.goodsReceiptDetail(receipt.id))
            },
          },
        )
      },
      () => toast.error('Check the highlighted fields'),
    )

  return (
    <form>
      <Button variant="link" size="sm" className="h-auto px-0" asChild>
        <Link to={paths.products.goodsReceipt}>
          <ArrowLeft />
          Goods receipt
        </Link>
      </Button>

      <PageHeader
        title="New receipt"
        description="What a supplier delivered, and everything that made it cost more than the invoice."
        action={
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={submit('draft')}>
              Save as draft
            </Button>
            <Button type="button" variant="primary" onClick={submit('received')}>
              <PackageCheck />
              Post receipt
            </Button>
          </div>
        }
      />

      <div className="mt-4 space-y-3">
        <Card>
          <CardHeader>
            <CardTitle>Delivery</CardTitle>
          </CardHeader>
          <CardBody className="grid gap-3 sm:grid-cols-3">
            <Field label="Supplier">
              {(p) => (
                <Controller
                  control={form.control}
                  name="supplierId"
                  render={({ field }) => (
                    <Select
                      {...p}
                      className="w-full"
                      value={field.value ?? undefined}
                      onChange={field.onChange}
                      placeholder="Not recorded"
                      options={suppliers.items.map((s) => ({ value: s.id, label: s.name }))}
                    />
                  )}
                />
              )}
            </Field>
            <Field label="Invoice number" hint="Theirs, for matching against their paperwork">
              {(p) => <Input {...p} placeholder="INV-40218" {...form.register('invoiceNumber')} />}
            </Field>
            <Field label="Lands at" required error={form.formState.errors.locationId?.message}>
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
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="flex-col items-stretch gap-1">
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Items</CardTitle>
              {lines.length ? (
                <span className="text-fg-muted text-sm tabular-nums">
                  {formatNumber(lines.length)} items · {formatMoney(goods)} from the supplier
                </span>
              ) : null}
            </div>
            <p className="text-fg-subtle text-2xs">
              Enter the supplier&rsquo;s price in the currency they invoiced. Landed cost is worked
              out below.
            </p>
          </CardHeader>
          <CardBody className="space-y-3">
            <ProductPicker
              placeholder="Search a product to add to this delivery…"
              disabled={!locationId}
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
                lineArray.append({
                  id: `line-${Date.now()}`,
                  variationId: variation.id,
                  productId: variation.productId,
                  sku: variation.sku,
                  name: variation.fullName,
                  imageUrl: variation.imageUrl,
                  unit: variation.unit,
                  orderedQuantity: 1,
                  receivedQuantity: null,
                  // Last known cost, as a starting point the buyer corrects.
                  unitCost: variation.costPrice,
                  costCurrency: variation.costCurrency,
                })
              }}
            />

            {form.formState.errors.lines?.root ? (
              <p className="text-danger text-2xs">{form.formState.errors.lines.root.message}</p>
            ) : null}

            {lineArray.fields.length === 0 ? (
              <p className="text-fg-subtle text-sm">
                Nothing added yet. Search above to put a product on this delivery.
              </p>
            ) : (
              <div className="border-border rounded-card overflow-x-auto border">
                <table className="w-full text-sm">
                  <thead className="bg-canvas">
                    <tr className="text-fg-muted text-2xs tracking-wide uppercase">
                      <th className="px-3 py-2 text-left font-semibold">Product</th>
                      <th className="px-3 py-2 text-right font-semibold">Quantity</th>
                      <th className="px-3 py-2 text-right font-semibold">Unit price</th>
                      <th className="px-3 py-2 text-right font-semibold">Landed</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {lineArray.fields.map((field, index) => {
                      const line = lines[index]
                      const landed = line
                        ? landedUnitCost({ ...line, receivedQuantity: null }, draft, USD_RATE)
                        : 0
                      const supplierUnit = line
                        ? toUzs(line.unitCost, line.costCurrency, USD_RATE)
                        : 0
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
                          <td className="px-2 py-1.5 text-right">
                            <Controller
                              control={form.control}
                              name={`lines.${index}.orderedQuantity`}
                              render={({ field: f }) => (
                                <NumberField
                                  className="w-20"
                                  nullable={false}
                                  min={1}
                                  aria-label={`Quantity of ${line?.name}`}
                                  value={f.value}
                                  onChange={(v) => f.onChange(v ?? 0)}
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
                                    aria-label={`Unit price of ${line?.name}`}
                                    value={f.value}
                                    onChange={(v) => f.onChange(v ?? 0)}
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
                            {formatMoney(Math.round(landed))}
                            {landed > supplierUnit ? (
                              <span className="text-fg-subtle text-2xs ml-1">
                                +{formatPercent((landed - supplierUnit) / supplierUnit)}
                              </span>
                            ) : null}
                          </td>
                          <td className="px-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label={`Remove ${line?.name}`}
                              className="hover:text-danger"
                              onClick={() => lineArray.remove(index)}
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
          <CardHeader className="flex-col items-stretch gap-1">
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Freight, duty and the rest</CardTitle>
              {extras > 0 && goods > 0 ? (
                <span className="text-fg-muted text-sm tabular-nums">
                  {formatMoney(extras)} · {formatPercent(extras / goods)} on top
                </span>
              ) : null}
            </div>
            <p className="text-fg-subtle text-2xs">
              Spread across the items above in proportion to their value. Leave empty and landed
              cost is simply the supplier&rsquo;s price.
            </p>
          </CardHeader>
          <CardBody className="space-y-3">
            {costArray.fields.map((field, index) => (
              <div key={field.id} className="flex items-end gap-2">
                <Field
                  label="Cost"
                  className="flex-1"
                  error={form.formState.errors.additionalCosts?.[index]?.label?.message}
                >
                  {(p) => (
                    <Input
                      {...p}
                      placeholder="Freight"
                      list="common-costs"
                      {...form.register(`additionalCosts.${index}.label`)}
                    />
                  )}
                </Field>
                <Field label="Amount">
                  {(p) => (
                    <Controller
                      control={form.control}
                      name={`additionalCosts.${index}.amount`}
                      render={({ field: f }) => (
                        <NumberField
                          {...p}
                          className="w-32"
                          nullable={false}
                          step="any"
                          value={f.value}
                          onChange={(v) => f.onChange(v ?? 0)}
                          onBlur={f.onBlur}
                        />
                      )}
                    />
                  )}
                </Field>
                <Controller
                  control={form.control}
                  name={`additionalCosts.${index}.currency`}
                  render={({ field: f }) => (
                    <Select
                      value={f.value}
                      onChange={f.onChange}
                      options={CURRENCIES}
                      aria-label="Currency"
                      className="w-24"
                    />
                  )}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remove this cost"
                  className="hover:text-danger"
                  onClick={() => costArray.remove(index)}
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
            <datalist id="common-costs">
              {COMMON_COSTS.map((label) => (
                <option key={label} value={label} />
              ))}
            </datalist>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() =>
                costArray.append({
                  id: `cost-${Date.now()}`,
                  label: '',
                  amount: 0,
                  currency: 'USD',
                })
              }
            >
              <Plus />
              Add a cost
            </Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Note</CardTitle>
          </CardHeader>
          <CardBody>
            <Field label="Comment" hint="Anything worth knowing when this is queried later">
              {(p) => (
                <Input {...p} placeholder="Part of container 3" {...form.register('comment')} />
              )}
            </Field>
          </CardBody>
        </Card>
      </div>
    </form>
  )
}
