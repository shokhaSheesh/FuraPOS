import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useFieldArray, useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, ArrowRight, Check, Pencil, Plus, Send, Wand2 } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { variationDetails } from '@/shared/lib/catalogueSearch'
import { matches } from '@/data/query'
import { LineItemsTable, type LineRow } from '@/shared/components/LineItemsTable'
import type { TableColumn } from '@/shared/components/table/features'
import { Steps } from '@/shared/components/Steps'
import { Field } from '@/shared/components/Field'
import { NumberField } from '@/shared/components/NumberField'
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { Select } from '@/shared/ui/Select'
import { DatePicker } from '@/shared/ui/DatePicker'
import { SegmentedControl } from '@/shared/ui/SegmentedControl'
import { useSession } from '@/app/providers/SessionProvider'
import { toast } from '@/shared/ui/toast'
import { paths } from '@/shared/config/paths'
import { formatDate, formatMoney, formatMoneyIn, formatNumber } from '@/shared/lib/format'
import { useDataStore } from '@/data/store'
import { USD_RATE } from '@/data/seed'
import { unitsSoldAt } from '@/shared/lib/demand'
import { catalogueFor, type CatalogueEntry } from '@/features/suppliers/model/catalogue'
import { useCreateOrder } from '../api/orders'
import { GenerateOrderModal } from '../components/GenerateOrderModal'
import { FullScreenDialog } from '@/shared/ui/FullScreenDialog'
import { ProductForm } from '@/features/products/pages/ProductFormPage'
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
  /** Details first, products second — the reference product's two-page create. */
  const [step, setStep] = useState<1 | 2>(1)
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

  /** The catalogue depends on the details, so they have to be complete before step 2. */
  const goToProducts = async () => {
    const ok = await form.trigger(['kind', 'supplierId', 'locationId'])
    if (!ok) {
      toast.error(
        fromOurs ? 'Pick where it lands first' : 'Pick the supplier and where it lands first',
      )
      return
    }
    setStep(2)
    window.scrollTo({ top: 0 })
  }

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

  const lineRows: LineRow[] = fields.map((field, index) => ({
    key: field.id,
    index,
    variationId: lines[index]?.variationId ?? '',
    quantity: lines[index]?.orderedQuantity ?? 0,
  }))

  /*
   * The order's own columns, after the product name: quantity, the agreed
   * price and what the line comes to — and, on a China order, sales in both
   * windows and how urgently each line is needed.
   */
  const lineColumns: TableColumn<LineRow>[] = [
    ...(china
      ? ([
          {
            id: 'sold',
            header: 'Sold',
            meta: { align: 'right' },
            cell: ({ row }) => (
              <div className="leading-tight tabular-nums">
                <p className="text-fg">
                  {formatNumber(unitsSoldAt(sales, row.original.variationId, null, 3))} in 3m
                </p>
                <p className="text-fg-subtle text-2xs">
                  {formatNumber(unitsSoldAt(sales, row.original.variationId, null, 6))} in 6m
                </p>
              </div>
            ),
          },
          {
            id: 'urgency',
            header: 'Urgency',
            enableHiding: false,
            cell: ({ row }) => (
              <Controller
                control={form.control}
                name={`lines.${row.original.index}.urgencyId`}
                render={({ field: f }) => (
                  <Select
                    aria-label="Urgency"
                    className="w-32"
                    value={f.value || NO_URGENCY}
                    onChange={(next) => f.onChange(next === NO_URGENCY ? null : next)}
                    options={[
                      { value: NO_URGENCY, label: 'Not set' },
                      ...levels.map((level) => ({ value: level.id, label: level.name })),
                    ]}
                  />
                )}
              />
            ),
          },
        ] satisfies TableColumn<LineRow>[])
      : []),
    {
      id: 'quantity',
      header: 'Quantity',
      enableHiding: false,
      meta: { align: 'right' },
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Controller
            control={form.control}
            name={`lines.${row.original.index}.orderedQuantity`}
            render={({ field: f }) => (
              <NumberField
                className="w-24"
                nullable={false}
                min={1}
                aria-label="Quantity"
                value={f.value}
                onChange={(next) => f.onChange(Math.max(1, next ?? 1))}
                onBlur={f.onBlur}
              />
            )}
          />
        </div>
      ),
    },
    {
      id: 'agreedPrice',
      header: 'Agreed price',
      enableHiding: false,
      meta: { align: 'right' },
      cell: ({ row }) => (
        <div className="flex justify-end gap-1.5">
          <Controller
            control={form.control}
            name={`lines.${row.original.index}.unitCost`}
            render={({ field: f }) => (
              <NumberField
                className="w-28"
                nullable={false}
                step="any"
                aria-label="Agreed price"
                value={f.value}
                onChange={(next) => f.onChange(next ?? 0)}
                onBlur={f.onBlur}
              />
            )}
          />
          <Controller
            control={form.control}
            name={`lines.${row.original.index}.costCurrency`}
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
      ),
    },
    {
      id: 'lineTotal',
      header: 'Line total',
      meta: { align: 'right' },
      cell: ({ row }) => {
        const line = lines[row.original.index]
        return (
          <span className="text-fg font-medium tabular-nums">
            {line
              ? formatMoney(
                  Math.round(
                    line.orderedQuantity * toUzs(line.unitCost, line.costCurrency, USD_RATE),
                  ),
                )
              : '—'}
          </span>
        )
      },
    },
  ]

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
        below={
          <Steps
            steps={['Details', 'Products']}
            current={step}
            onSelect={(n) => setStep(n as 1 | 2)}
          />
        }
        action={
          step === 1 ? (
            <div className="flex items-center gap-2">
              <Button type="button" variant="secondary" asChild>
                <Link to={paths.procurement.orders}>Cancel</Link>
              </Button>
              <Button type="button" variant="primary" onClick={goToProducts}>
                Continue
                <ArrowRight />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button type="button" variant="secondary" onClick={() => setStep(1)}>
                <ArrowLeft />
                Back
              </Button>
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
          )
        }
      />

      <div className="mt-4 space-y-3">
        {step === 1 ? (
          <>
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
                  <Field
                    label="Supplier"
                    required
                    error={form.formState.errors.supplierId?.message}
                  >
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
                <Field
                  label="Landing at"
                  required
                  error={form.formState.errors.locationId?.message}
                >
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
              <CardHeader>
                <CardTitle>Note</CardTitle>
              </CardHeader>
              <CardBody>
                <Field label="Comment" hint="Anything worth knowing when this is chased later">
                  {(p) => <Input {...p} placeholder="Container 4" {...form.register('comment')} />}
                </Field>
              </CardBody>
            </Card>
          </>
        ) : (
          <>
            {/* What was decided on step 1, so the lines are picked with it in view. */}
            <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="text-fg-subtle text-2xs">
                  {ORDER_KINDS.find((k) => k.value === kind)?.label}
                </p>
                <p className="text-fg text-sm font-medium">
                  {fromOurs
                    ? form.watch('boughtFrom') || (china ? 'Factory not named' : 'Market')
                    : (supplier?.name ?? '—')}
                  <span className="text-fg-subtle font-normal">
                    {' '}
                    · into {locations.find((l) => l.id === form.watch('locationId'))?.name ?? '—'}
                    {form.watch('expectedAt')
                      ? ` · expected ${formatDate(form.watch('expectedAt')!)}`
                      : ''}
                  </span>
                </p>
                {form.watch('comment') ? (
                  <p className="text-fg-subtle text-2xs truncate">{form.watch('comment')}</p>
                ) : null}
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={() => setStep(1)}>
                <Pencil />
                Edit details
              </Button>
            </Card>
            <LineItemsTable
              storageKey={`order-lines-${kind}`}
              rows={lineRows}
              columns={lineColumns}
              error={form.formState.errors.lines?.root?.message}
              totals={
                lines.length
                  ? [{ label: 'Order total', value: formatMoney(Math.round(total)) }]
                  : []
              }
              emptyDescription={
                fromOurs
                  ? 'Use “Add products” to pick from our catalogue, add a new item, or let the system suggest.'
                  : `Use “Add products” to pick from ${supplier?.name ?? 'the supplier'}’s catalogue, or let the system suggest.`
              }
              onRemove={(row) => remove(row.index)}
              catalogue={{
                label: fromOurs
                  ? 'our catalogue'
                  : `${supplier?.name ?? 'the supplier'}’s catalogue`,
                search: (term) => {
                  const wanted = term.trim()
                  if (!wanted) return []
                  return entries
                    .filter((entry) =>
                      matches(
                        [
                          entry.product.name,
                          entry.product.supplierSku,
                          entry.product.brandName,
                          entry.variation?.barcode,
                          entry.variation?.sku,
                          entry.variation?.oem,
                          entry.variation?.vehicleMake,
                        ],
                        wanted,
                      ),
                    )
                    .slice(0, 30)
                    .map((entry) => ({
                      id: entry.product.id,
                      name: entry.product.name,
                      imageUrl: entry.variation?.imageUrl ?? null,
                      codes: [
                        entry.variation?.barcode,
                        fromOurs ? entry.variation?.sku : entry.product.supplierSku,
                      ].filter(Boolean) as string[],
                      details: entry.variation
                        ? variationDetails(entry.variation)
                        : ([entry.product.categoryName, entry.product.brandName].filter(
                            Boolean,
                          ) as string[]),
                      // Their price on a supplier order; what it last cost on ours.
                      price: formatMoneyIn(entry.product.price, entry.product.currency),
                      note: entry.variation
                        ? {
                            text: `${formatNumber(entry.stock)} in stock · sold ${formatNumber(
                              unitsSoldAt(sales, entry.variation.id, null, 3),
                            )} in 3m`,
                            tone: entry.stock === 0 ? ('danger' as const) : ('muted' as const),
                          }
                        : {
                            text: 'New to us — add it to the catalogue first',
                            tone: 'info' as const,
                          },
                      // A line needs one of our products to land stock on.
                      disabled: !entry.variation,
                    }))
                },
                onPick: (id) => {
                  const entry = entries.find((e) => e.product.id === id)
                  if (!entry?.variation) return null
                  addEntry(entry)
                  return entry.variation.id
                },
              }}
              addActions={[
                {
                  label: 'Suggest what to order',
                  hint: 'Sold in 3 or 6 months, less what is in stock',
                  icon: Wand2,
                  onSelect: () => setGenerating(true),
                },
                ...(fromOurs && can('products.list.create')
                  ? [
                      {
                        label: 'New item',
                        hint: 'Something we do not carry yet',
                        icon: Plus,
                        onSelect: () => setAddingItem(true),
                      },
                    ]
                  : []),
              ]}
            />
          </>
        )}
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

      {/* The Product list's own form, full screen over the order, so the order
          being built is still here when it closes. */}
      <FullScreenDialog open={addingItem} onOpenChange={setAddingItem} title="New product">
        <ProductForm
          embedded
          onCancel={() => setAddingItem(false)}
          onSaved={(productId) => {
            // Straight onto the order — the reason it was created at all. A
            // product with several variations puts each of them on.
            const created = useDataStore
              .getState()
              .variations.filter((variation) => variation.productId === productId)
            for (const entry of ownCatalogue(created)) addEntry(entry)
            setAddingItem(false)
            if (created.length) {
              toast.success(
                created.length === 1
                  ? 'Added to the order'
                  : `${created.length} variations added to the order`,
              )
            }
          }}
        />
      </FullScreenDialog>
    </form>
  )
}
