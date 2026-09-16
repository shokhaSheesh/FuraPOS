import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useFieldArray, useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, ArrowRight, LayoutGrid, List, Pencil, Truck, Wand2 } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { DataTable } from '@/shared/components/DataTable'
import { EmptyState } from '@/shared/components/EmptyState'
import { ScrollSentinel } from '@/shared/components/ScrollSentinel'
import { SearchInput } from '@/shared/components/SearchInput'
import { useInfiniteRows } from '@/shared/hooks/useInfiniteRows'
import { Steps } from '@/shared/components/Steps'
import { buildTransferLineColumns, type TransferRow } from '../components/transferLineColumns'
import { Field } from '@/shared/components/Field'
import { GenerateTransferModal } from '../components/GenerateTransferModal'
import type { TransferSuggestion } from '../model/suggest'
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { Select } from '@/shared/ui/Select'
import { SegmentedControl } from '@/shared/ui/SegmentedControl'
import { toast } from '@/shared/ui/toast'
import { paths } from '@/shared/config/paths'
import { formatNumber } from '@/shared/lib/format'
import { useSession } from '@/app/providers/SessionProvider'
import { useDataStore } from '@/data/store'
import { useCreateTransfer } from '../api/transfers'
import { TRANSFER_KINDS, transferDraftSchema, type TransferDraft } from '../model/transfer'
import { demandAt, hasStalled } from '@/shared/lib/demand'

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

  const { append, remove } = useFieldArray({ control: form.control, name: 'lines' })
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

  /** What any shelf holds of one variation. */
  const stockAt = useMemo(
    () => (variationId: string, locationId: string) =>
      variations
        .find((v) => v.id === variationId)
        ?.stockByLocation.find((row) => row.locationId === locationId)?.quantity ?? 0,
    [variations],
  )

  const [generating, setGenerating] = useState(false)
  const { can } = useSession()
  const canSeeCost = can('products.cost.view')
  const [search, setSearch] = useState('')
  const [cards, setCards] = useState(false)
  /** Route and note first, products second — the reference product's two-page create. */
  const [step, setStep] = useState<1 | 2>(1)

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

  /** Products depend on the route, so it has to be complete before step 2. */
  const goToProducts = async () => {
    const ok = await form.trigger(['kind', 'fromLocationId', 'toLocationId'])
    if (!ok) {
      toast.error('Pick both locations first')
      return
    }
    setStep(2)
    window.scrollTo({ top: 0 })
  }

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

  const allRows: TransferRow[] = useMemo(() => {
    if (!fromLocationId) return []
    const indexOf = new Map(lines.map((line, index) => [line.variationId, index] as const))

    return variations
      .filter((variation) => variation.status === 'active' && availableAt(variation.id) > 0)
      .map((variation) => {
        const index = indexOf.get(variation.id) ?? -1
        const demand = demandLocationId
          ? demandAt(sales, variation.id, demandLocationId)
          : { 3: 0, 6: 0 }
        return {
          key: variation.id,
          variation,
          index,
          quantity: index > -1 ? (lines[index]?.requestedQuantity ?? 0) : 0,
          atSource: availableAt(variation.id),
          atDestination: toLocationId ? stockAt(variation.id, toLocationId) : 0,
          demand,
          stalled: hasStalled(demand),
        }
      })
  }, [
    variations,
    lines,
    fromLocationId,
    toLocationId,
    demandLocationId,
    sales,
    availableAt,
    stockAt,
  ])

  const matching = search.trim()
    ? allRows.filter((row) =>
        [
          row.variation.barcode,
          row.variation.sku,
          row.variation.fullName,
          row.variation.productName,
        ]
          .filter((field): field is string => Boolean(field))
          .some((field) => field.toLowerCase().includes(search.trim().toLowerCase())),
      )
    : allRows

  const { visible: rows, hasMore, shown, total, sentinel, showMore } = useInfiniteRows(matching)

  /** Change how many of a row are moving, whether or not it is on the transfer. */
  const setQuantity = (row: TransferRow, quantity: number) => {
    if (row.index > -1) {
      if (quantity > 0) {
        form.setValue(`lines.${row.index}.requestedQuantity`, quantity, { shouldDirty: true })
      } else {
        remove(row.index)
      }
      return
    }
    if (quantity <= 0) return

    const variation = row.variation
    append({
      id: `line-${variation.id}`,
      variationId: variation.id,
      productId: variation.productId,
      sku: variation.sku,
      name: variation.fullName,
      imageUrl: variation.imageUrl,
      unit: variation.unit,
      requestedQuantity: quantity,
      // Filled in at dispatch and at receipt, when reality is known.
      sentQuantity: null,
      receivedQuantity: null,
      // Snapshotted now, so the document keeps its value later.
      unitCost: variation.costPrice,
      costCurrency: variation.costCurrency,
      unitPrice: variation.salePrice,
    })
  }

  const lineColumns = buildTransferLineColumns({
    canSeeCost,
    cards,
    fromName: from?.name ?? 'source',
    toName: to?.name ?? 'destination',
    demandName: demandLocation?.name ?? (requesting ? 'here' : 'source'),
    onQuantityChange: setQuantity,
    onRemove: (row) => remove(row.index),
  })

  const movingUnits = lines.reduce((sum, line) => sum + (line.requestedQuantity || 0), 0)

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
        below={
          <Steps
            steps={['Route', 'Products']}
            current={step}
            onSelect={(n) => setStep(n as 1 | 2)}
          />
        }
        action={
          step === 1 ? (
            <div className="flex items-center gap-2">
              <Button type="button" variant="secondary" asChild>
                <Link to={paths.products.transfers}>Cancel</Link>
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
          )
        }
      />

      <div className="mt-4 space-y-3">
        {step === 1 ? (
          <>
            <Card>
              <CardHeader className="flex-col items-stretch gap-2">
                <CardTitle>Route</CardTitle>
                <div className="self-start">
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
                </div>
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
              <CardHeader>
                <CardTitle>Note</CardTitle>
              </CardHeader>
              <CardBody>
                <Field label="Comment" hint="Why this is moving — useful when it is queried later">
                  {(p) => (
                    <Input {...p} placeholder="Weekly top-up" {...form.register('comment')} />
                  )}
                </Field>
              </CardBody>
            </Card>
          </>
        ) : (
          <>
            {/* What was decided on step 1, so the lines are picked with it in view. */}
            <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="text-fg-subtle text-2xs">{requesting ? 'Request' : 'Transfer'}</p>
                <p className="text-fg flex items-center gap-2 text-sm font-medium">
                  {from?.name ?? '—'}
                  <ArrowRight className="text-fg-subtle size-3.5" />
                  {to?.name ?? '—'}
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
            <DataTable
              storageKey={cards ? 'transfer-lines-cards' : 'transfer-lines'}
              columns={lineColumns}
              data={rows}
              total={rows.length}
              getRowId={(row) => row.key}
              toolbar={
                <div className="flex flex-1 flex-wrap items-center gap-2">
                  <SearchInput
                    value={search}
                    onChange={setSearch}
                    placeholder="Search by barcode, SKU, variation or product name…"
                  />
                  <div className="flex-1" />
                  <div className="border-border rounded-control flex items-center border p-0.5">
                    <Button
                      type="button"
                      variant={cards ? 'ghost' : 'secondary'}
                      size="icon"
                      aria-label="Show one column per field"
                      aria-pressed={!cards}
                      onClick={() => setCards(false)}
                    >
                      <List />
                    </Button>
                    <Button
                      type="button"
                      variant={cards ? 'secondary' : 'ghost'}
                      size="icon"
                      aria-label="Show each product as a card"
                      aria-pressed={cards}
                      onClick={() => setCards(true)}
                    >
                      <LayoutGrid />
                    </Button>
                  </div>
                  {requesting ? (
                    <Button type="button" variant="primary" onClick={() => setGenerating(true)}>
                      <Wand2 />
                      Suggest
                    </Button>
                  ) : null}
                </div>
              }
              footer={
                <>
                  <ScrollSentinel
                    ref={sentinel}
                    hasMore={hasMore}
                    shown={shown}
                    total={total}
                    onShowMore={showMore}
                  />
                  <div className="border-border text-fg-muted flex flex-wrap items-center gap-x-8 gap-y-1 border-t px-4 py-3 text-sm">
                    <span>
                      Moving:{' '}
                      <strong className="text-fg font-medium">{formatNumber(movingUnits)}</strong>
                    </span>
                    <span>
                      Products:{' '}
                      <strong className="text-fg font-medium">{formatNumber(lines.length)}</strong>
                    </span>
                    {form.formState.errors.lines?.root?.message ? (
                      <span className="text-danger">
                        {form.formState.errors.lines.root.message}
                      </span>
                    ) : null}
                  </div>
                </>
              }
              emptyState={
                <EmptyState
                  title={`${from?.name ?? 'That location'} holds nothing`}
                  description="A transfer can only move what the sending shelf actually has."
                />
              }
            />
          </>
        )}

        <GenerateTransferModal
          open={generating}
          onOpenChange={setGenerating}
          fromLocationId={fromLocationId}
          toLocationId={toLocationId}
          fromName={from?.name ?? 'the source'}
          toName={to?.name ?? 'the destination'}
          onAdd={addSuggestions}
        />
      </div>
    </form>
  )
}
