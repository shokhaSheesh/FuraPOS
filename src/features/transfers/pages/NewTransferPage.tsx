import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useFieldArray, useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, ArrowRight, Trash2, Truck, Wand2 } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { Field } from '@/shared/components/Field'
import { NumberField } from '@/shared/components/NumberField'
import { ProductBrowser } from '../components/ProductBrowser'
import { GenerateTransferModal } from '../components/GenerateTransferModal'
import type { TransferSuggestion } from '../model/suggest'
import { ProductThumb } from '@/shared/components/ProductThumb'
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { Select } from '@/shared/ui/Select'
import { SegmentedControl } from '@/shared/ui/SegmentedControl'
import { toast } from '@/shared/ui/toast'
import { paths } from '@/shared/config/paths'
import { formatNumber } from '@/shared/lib/format'
import { useDataStore } from '@/data/store'
import { useCreateTransfer } from '../api/transfers'
import { TRANSFER_KINDS, transferDraftSchema, type TransferDraft } from '../model/transfer'
import { demandAt, hasStalled } from '../model/demand'
import type { VariationRow } from '@/features/products/model/product'

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
      kind: 'send',
      fromLocationId: locations[0]?.id ?? '',
      toLocationId: '',
      comment: '',
      lines: [],
    },
  })

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'lines' })
  const lines = form.watch('lines')
  const fromLocationId = form.watch('fromLocationId')
  const kind = form.watch('kind')
  const requesting = kind === 'request'

  /** What the chosen source holds of one variation, right now. */
  const availableAt = useMemo(
    () => (variationId: string) =>
      variations
        .find((v) => v.id === variationId)
        ?.stockByLocation.find((row) => row.locationId === fromLocationId)?.quantity ?? 0,
    [variations, fromLocationId],
  )

  const toLocationId = form.watch('toLocationId')
  const sales = useDataStore((s) => s.sales)
  const categories = useDataStore((s) => s.categories)
  const brands = useDataStore((s) => s.brands)

  /** What any shelf holds of one variation. */
  const stockAt = useMemo(
    () => (variationId: string, locationId: string) =>
      variations
        .find((v) => v.id === variationId)
        ?.stockByLocation.find((row) => row.locationId === locationId)?.quantity ?? 0,
    [variations],
  )

  /*
    Narrowing the catalogue before searching it. Somebody topping up a shop
    thinks in "brakes" or "Bosch" long before they think of a part number, and
    with a filter on, the picker opens on its own rather than waiting to be
    typed into.
  */
  const [categoryId, setCategoryId] = useState('')
  const [brandId, setBrandId] = useState('')
  const [generating, setGenerating] = useState(false)

  /** Adds what the proposal chose, leaving anything already listed alone. */
  const addSuggestions = (suggestions: TransferSuggestion[]) => {
    const current = form.getValues('lines')
    const existing = new Set(current.map((line) => line.variationId))
    const added = suggestions
      .filter((suggestion) => !existing.has(suggestion.variationId))
      .map((suggestion) => ({
        id: `line-${suggestion.variationId}-${Date.now()}`,
        variationId: suggestion.variationId,
        productId: suggestion.productId,
        sku: suggestion.sku,
        name: suggestion.name,
        imageUrl: suggestion.imageUrl,
        unit: suggestion.unit,
        requestedQuantity: suggestion.suggested,
        sentQuantity: null,
        receivedQuantity: null,
        unitCost: suggestion.costPrice,
        costCurrency: suggestion.costCurrency,
        unitPrice: suggestion.salePrice,
      }))
    if (added.length === 0) {
      toast.info('Everything suggested is already on this transfer')
      return
    }
    form.setValue('lines', [...current, ...added], { shouldDirty: true })
    toast.success(
      `${formatNumber(added.length)} ${added.length === 1 ? 'product' : 'products'} added`,
    )
  }

  const pickerFilter = useMemo(() => {
    if (!categoryId && !brandId) return undefined
    return (variation: VariationRow) =>
      (!categoryId || variation.categoryId === categoryId) &&
      (!brandId || variation.brandId === brandId)
  }, [categoryId, brandId])

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
  const to = locations.find((l) => l.id === toLocationId)

  /** Whose sales are worth showing against each line. */
  const demandLocationId = requesting ? toLocationId : fromLocationId
  const demandLocation = requesting ? to : from

  return (
    <form>
      <Button variant="link" size="sm" className="h-auto px-0" asChild>
        <Link to={paths.products.transfers}>
          <ArrowLeft />
          Transfers
        </Link>
      </Button>

      <PageHeader
        title={requesting ? 'New request' : 'New transfer'}
        description={
          requesting
            ? 'Ask another location to supply this one.'
            : 'Take stock off one shelf and put it on another.'
        }
        action={
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={submit('draft')}>
              Save as draft
            </Button>
            {/* A request cannot dispatch: the goods are on somebody else's
                shelf and they have not agreed to part with them yet. */}
            <Button
              type="button"
              variant="primary"
              onClick={submit(requesting ? 'draft' : 'in_transit')}
            >
              <Truck />
              {requesting ? 'Send the request' : 'Send now'}
            </Button>
          </div>
        }
      />

      <div className="mt-4 space-y-3">
        <Card>
          <CardHeader className="flex-col items-stretch gap-2">
            <CardTitle>Route</CardTitle>
            <Controller
              control={form.control}
              name="kind"
              render={({ field }) => (
                <SegmentedControl
                  aria-label="Sending or requesting"
                  value={field.value}
                  onChange={(next) => {
                    /*
                      Only the mode changes. Swapping the two ends automatically
                      seemed helpful and was not: `Select` passes an empty value
                      through as `undefined`, which flips Radix from controlled
                      to uncontrolled, after which it keeps its own idea of what
                      is chosen. Writing either end during the switch produced a
                      destination that looked empty, or kept a stale value, or
                      defaulted to the source. The locations are the user's to
                      set; the switch says what the document *is*.
                    */
                    field.onChange(next)
                  }}
                  options={TRANSFER_KINDS.map((entry) => ({
                    value: entry.value,
                    label: entry.label,
                  }))}
                />
              )}
            />
            <p className="text-fg-subtle text-2xs">
              {TRANSFER_KINDS.find((entry) => entry.value === kind)?.hint}
            </p>
          </CardHeader>
          <CardBody className="grid items-start gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
            <Field
              label={requesting ? 'Ask' : 'From'}
              required
              error={form.formState.errors.fromLocationId?.message}
            >
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
            <Field
              label={requesting ? 'Deliver to' : 'To'}
              required
              error={form.formState.errors.toLocationId?.message}
            >
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
              <div className="flex items-center gap-3">
                {lines.length ? (
                  <span className="text-fg-muted text-sm tabular-nums">
                    {formatNumber(lines.length)} items · {formatNumber(totalUnits)} units
                  </span>
                ) : null}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  // Both ends are needed before anything can be worked out:
                  // the proposal is about one shelf relative to another.
                  disabled={!fromLocationId || !toLocationId}
                  title={
                    !fromLocationId || !toLocationId ? 'Choose both locations first' : undefined
                  }
                  onClick={() => setGenerating(true)}
                >
                  <Wand2 />
                  {requesting ? 'Suggest what to ask for' : 'Suggest what to send'}
                </Button>
              </div>
            </div>
            <p className="text-fg-subtle text-2xs">
              Quantities shown are what {from?.name ?? 'the source'} holds, not the company total.
            </p>
          </CardHeader>
          <CardBody className="space-y-3">
            {!toLocationId ? (
              <p className="text-fg-subtle text-2xs">
                {requesting
                  ? 'Pick who to ask, and the system can suggest what to ask for.'
                  : 'Pick a destination to have the system suggest what to send.'}
              </p>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Category" hint="Narrows the search below">
                {(p) => (
                  <Select
                    {...p}
                    className="w-full"
                    value={categoryId || undefined}
                    onChange={setCategoryId}
                    placeholder="Any category"
                    options={[
                      { value: '', label: 'Any category' },
                      ...categories.map((c) => ({ value: c.id, label: c.name })),
                    ]}
                  />
                )}
              </Field>
              <Field label="Brand" hint="Narrows the search below">
                {(p) => (
                  <Select
                    {...p}
                    className="w-full"
                    value={brandId || undefined}
                    onChange={setBrandId}
                    placeholder="Any brand"
                    options={[
                      { value: '', label: 'Any brand' },
                      ...brands.map((b) => ({ value: b.id, label: b.name })),
                    ]}
                  />
                )}
              </Field>
            </div>

            <ProductBrowser
              filter={pickerFilter}
              addedIds={lines.map((line) => line.variationId)}
              disabled={!fromLocationId}
              emptyLabel={
                categoryId || brandId
                  ? 'Nothing in this category or brand.'
                  : 'Nothing in the catalogue yet.'
              }
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
                      {/* Named rather than "source" and "destination": nobody
                          should have to remember which end is which. */}
                      <th className="px-3 py-2 text-right font-semibold">
                        At {from?.name ?? 'source'}
                      </th>
                      <th className="px-3 py-2 text-right font-semibold">
                        At {to?.name ?? 'destination'}
                      </th>
                      <th className="px-3 py-2 text-right font-semibold">
                        Sold at {demandLocation?.name ?? (requesting ? 'here' : 'source')}
                      </th>
                      <th className="px-3 py-2 text-right font-semibold">Move</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {fields.map((field, index) => {
                      const line = lines[index]
                      const here = line ? availableAt(line.variationId) : 0
                      const there =
                        line && toLocationId ? stockAt(line.variationId, toLocationId) : null
                      // Without a location there is nothing to count, and a
                      // bare zero would read as "never sells" rather than
                      // "not chosen yet".
                      const demand =
                        line && demandLocationId
                          ? demandAt(sales, line.variationId, demandLocationId)
                          : null
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
                          <td className="text-fg-muted px-3 py-2 text-right tabular-nums">
                            {there === null ? (
                              <span className="text-fg-subtle">pick a destination</span>
                            ) : (
                              `${formatNumber(there)} ${line?.unit ?? ''}`
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {/* Spelled out in words rather than "3m / 6m", and
                                the two together say what one cannot: sales six
                                months ago with none since is a part that has
                                stopped moving. */}
                            {demand ? (
                              <>
                                <p className="text-fg tabular-nums">
                                  {formatNumber(demand[3])} in 3 months
                                </p>
                                <p className="text-fg-subtle text-2xs tabular-nums">
                                  {formatNumber(demand[6])} in 6 months
                                </p>
                              </>
                            ) : (
                              <span className="text-fg-subtle">pick a destination</span>
                            )}
                            {demand && hasStalled(demand) ? (
                              <p className="text-warning text-2xs">not selling lately</p>
                            ) : null}
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

        <GenerateTransferModal
          open={generating}
          onOpenChange={setGenerating}
          fromLocationId={fromLocationId}
          toLocationId={toLocationId}
          fromName={from?.name ?? 'the source'}
          toName={to?.name ?? 'the destination'}
          onAdd={addSuggestions}
        />

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
