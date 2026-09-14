import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useFieldArray, useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Check, Plus, Send, Trash2, Wand2 } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { Field } from '@/shared/components/Field'
import { NumberField } from '@/shared/components/NumberField'
import { ProductThumb } from '@/shared/components/ProductThumb'
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { Select } from '@/shared/ui/Select'
import { DatePicker } from '@/shared/ui/DatePicker'
import { SegmentedControl } from '@/shared/ui/SegmentedControl'
import { useSession } from '@/app/providers/SessionProvider'
import { toast } from '@/shared/ui/toast'
import { paths } from '@/shared/config/paths'
import { formatMoney, formatNumber } from '@/shared/lib/format'
import { useDataStore } from '@/data/store'
import { USD_RATE } from '@/data/seed'
import { unitsSoldAt } from '@/shared/lib/demand'
import {
  catalogueFor,
  summariseCatalogue,
  type CatalogueEntry,
} from '@/features/suppliers/model/catalogue'
import { useCreateOrder } from '../api/orders'
import { SupplierCatalogue } from '../components/SupplierCatalogue'
import { GenerateOrderModal } from '../components/GenerateOrderModal'
import { NewItemModal } from '../components/NewItemModal'
import { ownCatalogue } from '../model/ownCatalogue'
import {
  ORDER_KINDS,
  orderDraftSchema,
  toUzs,
  type OrderDraft,
  type OrderKind,
} from '../model/order'

/** "Not set" in the urgency picker — Radix reads an empty value as cleared. */
const NO_URGENCY = '__none__'

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
  const supplierProducts = useDataStore((s) => s.supplierProducts)
  const variations = useDataStore((s) => s.variations)
  const sales = useDataStore((s) => s.sales)
  const [generating, setGenerating] = useState(false)
  const [addingItem, setAddingItem] = useState(false)
  const { can } = useSession()
  const create = useCreateOrder()

  const form = useForm<OrderDraft>({
    resolver: zodResolver(orderDraftSchema),
    defaultValues: {
      kind: 'supplier',
      supplierId: '',
      boughtFrom: '',
      locationId: locations[0]?.id ?? '',
      expectedAt: null,
      comment: '',
      lines: [],
    },
  })

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'lines' })
  const lines = form.watch('lines')
  const kind = form.watch('kind')
  const market = kind === 'market'
  const china = kind === 'china'
  /** Market and China both pick from our catalogue; only a supplier order has its own. */
  const fromOurs = market || china
  const urgencyLevels = useDataStore((s) => s.urgencyLevels)
  const levels = useMemo(() => [...urgencyLevels].sort((a, b) => a.rank - b.rank), [urgencyLevels])
  const supplierId = form.watch('supplierId')
  const supplier = fromOurs ? undefined : suppliers.find((s) => s.id === supplierId)
  /** Whether there is a catalogue to show yet: always at the market, once chosen otherwise. */
  const ready = fromOurs || Boolean(supplier)

  /* The catalogue this order is picked from: a supplier's own, or ours for a
     market run. Everything below works the same either way. */
  const entries = useMemo(
    () =>
      fromOurs
        ? ownCatalogue(variations)
        : supplierId
          ? catalogueFor(supplierProducts, variations, supplierId)
          : [],
    [fromOurs, supplierProducts, variations, supplierId],
  )
  const summary = summariseCatalogue(entries)
  const addedIds = entries
    .filter((entry) => entry.variation && lines.some((l) => l.variationId === entry.variation!.id))
    .map((entry) => entry.product.id)

  /** Put a catalogue line on the order, or top up the one already there. */
  const addEntry = (entry: CatalogueEntry, quantity?: number) => {
    const variation = entry.variation
    if (!variation) return
    const current = form.getValues('lines')
    const existing = current.findIndex((line) => line.variationId === variation.id)
    if (existing > -1) {
      form.setValue(
        `lines.${existing}.orderedQuantity`,
        quantity ?? (current[existing]?.orderedQuantity ?? 0) + 1,
        { shouldDirty: true },
      )
      return
    }
    append({
      id: `line-${variation.id}`,
      variationId: variation.id,
      productId: variation.productId,
      sku: variation.sku,
      name: variation.fullName,
      imageUrl: variation.imageUrl,
      unit: variation.unit,
      orderedQuantity: quantity ?? entry.product.moq ?? 1,
      receivedQuantity: 0,
      // Their catalogue price is where the agreement starts, not our last cost.
      unitCost: entry.product.price,
      costCurrency: entry.product.currency,
      // Left unset rather than guessed: how urgent a line is, is the buyer's call.
      urgencyId: null,
    })
  }

  /** Switching between a supplier and the market starts the items again. */
  const switchKind = (next: OrderKind) => {
    if (next === kind) return
    // Supplier lines carry their prices; market lines carry ours. Keeping them
    // across the switch would leave an order priced from two places.
    if (form.getValues('lines').length) {
      form.setValue('lines', [])
      toast.info('Items cleared — they were priced for the other kind of order')
    }
    form.setValue('kind', next)
    form.setValue('supplierId', '')
    form.clearErrors()
  }

  const total = lines.reduce(
    (sum, line) => sum + line.orderedQuantity * toUzs(line.unitCost, line.costCurrency, USD_RATE),
    0,
  )
  const units = lines.reduce((sum, line) => sum + line.orderedQuantity, 0)

  const submit = (status: 'draft' | 'sent' | 'confirmed') =>
    form.handleSubmit(
      (values) => {
        create.mutate(
          { ...values, status },
          {
            onSuccess: (order) => {
              toast.success(
                status === 'draft'
                  ? `${order.number} saved as a draft`
                  : market
                    ? `${order.number} confirmed — receive it when the goods are back`
                    : china
                      ? `${order.number} sent — download the PDF for the factory from the order`
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
        description={
          market
            ? 'A market run: what to buy at the bazaar, and what it cost. It is received like any order when the goods are back.'
            : china
              ? 'An order for a factory in China: what to make, how urgently, and a PDF to hand them.'
              : 'What to ask a supplier for, and at what price. The delivery gets checked against it.'
        }
        action={
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={submit('draft')}>
              Save as draft
            </Button>
            {market ? (
              // Nobody to send a market list to, so it is confirmed instead.
              <Button type="button" variant="primary" onClick={submit('confirmed')}>
                <Check />
                Confirm purchase
              </Button>
            ) : (
              <Button type="button" variant="primary" onClick={submit('sent')}>
                <Send />
                {china ? 'Send to factory' : 'Send to supplier'}
              </Button>
            )}
          </div>
        }
      />

      <div className="mt-4 space-y-3">
        <Card>
          <CardHeader className="flex-col items-stretch gap-2">
            <CardTitle>Order</CardTitle>
            <div className="self-start">
              <SegmentedControl
                aria-label="Where the goods come from"
                value={kind}
                onChange={switchKind}
                options={ORDER_KINDS.map((k) => ({ value: k.value, label: k.label }))}
              />
            </div>
            <p className="text-fg-subtle text-2xs">
              {ORDER_KINDS.find((k) => k.value === kind)?.hint}
            </p>
          </CardHeader>
          <CardBody className="grid gap-3 sm:grid-cols-3">
            {fromOurs ? (
              <Field
                label={china ? 'Factory or agent' : 'Bought from'}
                hint={
                  china
                    ? 'Who is making it — the factory, or the agent placing it for us'
                    : 'The market, the stall or the seller — for when this is asked about later'
                }
              >
                {(p) => (
                  <Input
                    {...p}
                    placeholder={
                      china ? 'Guangzhou Auto Parts Co. — Mr Chen' : 'Jomiy bozori, row 4'
                    }
                    {...form.register('boughtFrom')}
                  />
                )}
              </Field>
            ) : (
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
                        onChange={(next) => {
                          // Lines priced from one supplier's catalogue mean nothing
                          // on an order to another, so switching starts again.
                          if (next !== field.value && form.getValues('lines').length) {
                            form.setValue('lines', [])
                            toast.info('Items cleared — they came from the other supplier')
                          }
                          field.onChange(next)
                        }}
                        placeholder="Pick a supplier"
                        options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
                      />
                    )}
                  />
                )}
              </Field>
            )}
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
              hint={
                china
                  ? 'When the factory said it will ship.'
                  : market
                    ? 'When the goods should be back at the warehouse.'
                    : 'When they promised it. Without a date nothing can be late.'
              }
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
              <div className="flex items-center gap-3">
                {lines.length ? (
                  <span className="text-fg-muted text-sm tabular-nums">
                    {formatNumber(units)} {units === 1 ? 'unit' : 'units'} ·{' '}
                    {formatMoney(Math.round(total))}
                  </span>
                ) : null}
                {fromOurs && can('products.list.create') ? (
                  <Button type="button" variant="secondary" onClick={() => setAddingItem(true)}>
                    <Plus />
                    Add item
                  </Button>
                ) : null}
                {ready ? (
                  <Button type="button" variant="secondary" onClick={() => setGenerating(true)}>
                    <Wand2 />
                    Suggest what to order
                  </Button>
                ) : null}
              </div>
            </div>
            <p className="text-fg-subtle text-2xs">
              {china
                ? `Our catalogue — ${formatNumber(summary.products)} products. Mark how urgent each line is; the factory sees them in that order on the PDF.`
                : market
                  ? `Our catalogue — ${formatNumber(summary.products)} products. Not here? Add it as a new item. The price starts at what it last cost; change it to what you paid.`
                  : supplier
                    ? `${supplier.name}'s catalogue — ${formatNumber(summary.products)} products across ${formatNumber(summary.categories.length)} categories and ${formatNumber(summary.brands.length)} brands. The price starts at what they ask; change it to what was agreed.`
                    : 'Pick a supplier and their catalogue appears here.'}
            </p>
          </CardHeader>
          <CardBody className="space-y-3">
            {ready ? (
              <SupplierCatalogue
                searchPlaceholder={fromOurs ? 'Search our catalogue by name or SKU…' : undefined}
                emptyLabel={
                  fromOurs ? 'Nothing in our catalogue matches — add it as a new item' : undefined
                }
                entries={entries}
                addedIds={addedIds}
                onPick={(entry) => addEntry(entry)}
                soldFor={(entry) =>
                  entry.variation ? unitsSoldAt(sales, entry.variation.id, null, 3) : 0
                }
              />
            ) : (
              <div className="border-border rounded-card text-fg-muted border border-dashed p-6 text-center text-sm">
                Choose a supplier above to see what they sell.
              </div>
            )}

            {form.formState.errors.lines?.root ? (
              <p className="text-danger text-2xs">{form.formState.errors.lines.root.message}</p>
            ) : null}

            {fields.length === 0 ? (
              ready ? (
                <p className="text-fg-subtle text-sm">
                  Nothing added yet. Pick from their catalogue, or let the system suggest.
                </p>
              ) : null
            ) : (
              <div className="border-border rounded-card overflow-x-auto border">
                <table className="w-full text-sm">
                  <thead className="bg-canvas">
                    <tr className="text-fg-muted text-2xs tracking-wide uppercase">
                      <th className="px-3 py-2 text-left font-semibold">Product</th>
                      {china ? (
                        <>
                          <th className="px-3 py-2 text-right font-semibold">Sold</th>
                          <th className="px-3 py-2 text-left font-semibold">Urgency</th>
                        </>
                      ) : null}
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
                          {china && line ? (
                            <>
                              {/* Both windows, as on Transfers: the pair says whether
                                  a part is still moving or has gone quiet. */}
                              <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
                                <p className="text-fg">
                                  {formatNumber(unitsSoldAt(sales, line.variationId, null, 3))} in
                                  3m
                                </p>
                                <p className="text-fg-subtle text-2xs">
                                  {formatNumber(unitsSoldAt(sales, line.variationId, null, 6))} in
                                  6m
                                </p>
                              </td>
                              <td className="px-2 py-1.5">
                                <Controller
                                  control={form.control}
                                  name={`lines.${index}.urgencyId`}
                                  render={({ field: f }) => (
                                    <Select
                                      aria-label={`Urgency of ${line.name}`}
                                      className="w-32"
                                      value={f.value || NO_URGENCY}
                                      onChange={(next) =>
                                        f.onChange(next === NO_URGENCY ? null : next)
                                      }
                                      options={[
                                        { value: NO_URGENCY, label: 'Not set' },
                                        ...levels.map((level) => ({
                                          value: level.id,
                                          label: level.name,
                                        })),
                                      ]}
                                    />
                                  )}
                                />
                              </td>
                            </>
                          ) : null}
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

      {ready ? (
        <GenerateOrderModal
          open={generating}
          onOpenChange={setGenerating}
          entries={entries}
          supplierName={market ? 'the market' : china ? 'China' : (supplier?.name ?? '')}
          scope={fromOurs ? 'Everything in our catalogue' : undefined}
          onAdd={(suggestions) => {
            for (const suggestion of suggestions) {
              const entry = entries.find((e) => e.product.id === suggestion.supplierProductId)
              if (entry) addEntry(entry, suggestion.suggested)
            }
            toast.success(`${suggestions.length} products added from the suggestion`)
          }}
        />
      ) : null}

      <NewItemModal
        open={addingItem}
        onOpenChange={setAddingItem}
        // Straight onto the order: the reason it was added at all.
        onCreated={(variation) => {
          const [entry] = ownCatalogue([variation])
          if (entry) addEntry(entry)
        }}
      />
    </form>
  )
}
