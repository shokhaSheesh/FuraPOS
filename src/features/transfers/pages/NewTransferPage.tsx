import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useFieldArray, useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, ArrowRight, Pencil, Save, Truck, Wand2 } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { DataTable } from '@/shared/components/DataTable'
import { EmptyState } from '@/shared/components/EmptyState'
import { Steps } from '@/shared/components/Steps'
import { buildTransferLineColumns, type TransferRow } from '../components/transferLineColumns'
import type { TableColumn } from '@/shared/components/table/features'
import { Field } from '@/shared/components/Field'
import { TransferCatalogue } from '../components/TransferCatalogue'
import type { VariationRow } from '@/features/products/model/product'
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
import { TRANSFER_KINDS, transferDraftSchema, type TransferDraft } from '../model/transfer'
import { demandAt, hasStalled } from '@/shared/lib/demand'
import { t, tn } from '@/shared/i18n'

/**
 * Build a transfer.
 *
 * The source location is chosen first and everything downstream depends on it:
 * the picker reports the quantity **on that shelf** rather than the company
 * total, and each line is checked against it. Picking the source last would
 * mean adding lines against a stock figure that then changes meaning.
 *
 * Sending is offered here as well as on the detail page, because most transfers
 * are written and dispatched in one go.
 *
 * **Nothing picked is ever lost** (client request). Save keeps the transfer as
 * unfinished at any point, and leaving the page once the products step has been
 * reached saves it without being asked — by the back link, the sidebar, or
 * anything else that takes you away. An unfinished transfer reopens here, at
 * its products, from the transfers list.
 */
/** A new transfer line for a variation, with its prices snapshotted now. */
function lineFor(variation: VariationRow, quantity: number): TransferDraft['lines'][number] {
  return {
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
  }
}

export default function NewTransferPage() {
  const navigate = useNavigate()
  const { transferId } = useParams()
  const locations = useDataStore((s) => s.locations)
  const variations = useDataStore((s) => s.variations)
  const saved = useDataStore((s) => s.transfers.find((t) => t.id === transferId))
  const createTransfer = useDataStore((s) => s.createTransfer)
  const updateDraft = useDataStore((s) => s.updateTransferDraft)
  const setTransferStatus = useDataStore((s) => s.setTransferStatus)

  /** Only an unfinished transfer can be picked up again; the rest are records. */
  const resuming = saved?.status === 'draft' ? saved : undefined

  const form = useForm<TransferDraft>({
    resolver: zodResolver(transferDraftSchema),
    defaultValues: resuming
      ? {
          kind: resuming.kind,
          fromLocationId: resuming.fromLocationId,
          toLocationId: resuming.toLocationId,
          comment: resuming.comment ?? '',
          lines: resuming.lines,
        }
      : {
          kind: 'send',
          fromLocationId: locations[0]?.id ?? '',
          toLocationId: '',
          comment: '',
          lines: [],
        },
  })

  /** The unfinished transfer this page writes to, once there is one. */
  const draftId = useRef<string | null>(resuming?.id ?? null)
  /** What was last written, so leaving without a change does not save again. */
  const lastSaved = useRef<string | null>(resuming ? JSON.stringify(form.getValues()) : null)
  /** Set once the transfer has been sent or saved for good, so leaving does not save over it. */
  const finished = useRef(false)
  /** Leaving saves only once the products step has been reached. */
  const reachedProducts = useRef(Boolean(resuming))

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
  /** Route and note first, products second — the reference product's two-page create. */
  const [step, setStep] = useState<1 | 2 | 3>(resuming ? 2 : 1)
  useEffect(() => {
    if (step >= 2) reachedProducts.current = true
  }, [step])

  /**
   * Writes the form to its unfinished transfer, creating it the first time.
   * Returns null when there is no route yet — a transfer needs both ends before
   * it is anything at all.
   */
  const saveDraft = () => {
    const values = form.getValues()
    if (!values.fromLocationId || !values.toLocationId) return null
    if (values.fromLocationId === values.toLocationId) return null
    const input = {
      kind: values.kind,
      fromLocationId: values.fromLocationId,
      toLocationId: values.toLocationId,
      comment: values.comment,
      lines: values.lines,
    }
    if (draftId.current) {
      const result = updateDraft(draftId.current, input)
      if (!result.ok) return null
    } else {
      draftId.current = createTransfer({ ...input, status: 'draft' }).id
    }
    lastSaved.current = JSON.stringify(values)
    return useDataStore.getState().transfers.find((t) => t.id === draftId.current) ?? null
  }

  const saveNow = async () => {
    if (!(await form.trigger(['kind', 'fromLocationId', 'toLocationId']))) {
      toast.error(t('Pick both locations first'))
      setStep(1)
      return
    }
    const transfer = saveDraft()
    if (transfer) toast.success(t('{number} saved as unfinished', { number: transfer.number }))
  }

  /*
    Leaving saves. An unmount is every way out at once — the back link, the
    sidebar, the browser's back button — so it is the one place to catch them.
    The ref holds the latest closure; the effect itself runs only on the way out.
  */
  const saveOnLeave = useRef(() => {})
  saveOnLeave.current = () => {
    if (finished.current || !reachedProducts.current) return
    if (lastSaved.current === JSON.stringify(form.getValues())) return
    const transfer = saveDraft()
    if (transfer)
      toast.success(
        t('{number} saved as unfinished — pick it up from Transfers', { number: transfer.number }),
      )
  }
  useEffect(() => () => saveOnLeave.current(), [])

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
      toast.info(t('Everything suggested is already on this transfer'))
      return
    }
    form.setValue('lines', [...current, ...added], { shouldDirty: true })
    toast.success(
      t('{p0} {p1} added', {
        p0: formatNumber(added.length),
        p1: tn(added.length, 'product', 'products'),
      }),
    )
  }

  /**
   * Moving between steps, checking only what the next one actually needs.
   *
   * Going back is always allowed; going forward past something unfilled lands
   * on the step that is unfilled, with its error showing, rather than on a
   * screen that cannot work yet.
   */
  const goTo = async (next: 1 | 2 | 3) => {
    if (next <= step) {
      setStep(next)
      return
    }
    // The products step is the source's shelf, so it cannot exist without one.
    if (!(await form.trigger(['kind', 'fromLocationId', 'toLocationId']))) {
      toast.error(t('Pick both locations first'))
      setStep(1)
      return
    }
    if (next === 3 && lines.length === 0) {
      toast.error(t('Put something on the transfer first'))
      setStep(2)
      return
    }
    setStep(next)
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

        // Written to the unfinished transfer when there is one, so saving along
        // the way and sending at the end are one document, not two.
        const transfer = saveDraft()
        if (!transfer) return
        if (status === 'in_transit' && values.kind === 'send') {
          const result = setTransferStatus(transfer.id, 'in_transit')
          if (!result.ok) {
            toast.error(result.error)
            return
          }
        }
        finished.current = true
        toast.success(
          status === 'draft'
            ? `${transfer.number} saved as unfinished`
            : `${transfer.number} sent to ${transfer.toLocationName}`,
        )
        navigate(paths.products.transferDetail(transfer.id))
      },
      () => toast.error(t('Check the highlighted fields')),
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

  /** Change how many of a row are moving, whether or not it is on the transfer. */
  const setQuantity = (row: TransferRow, quantity: number) => {
    if (row.index > -1) {
      if (quantity > 0) {
        // A new list rather than a nested set: the rows are worked out from
        // the list, and a quantity changed inside it is a change nothing sees.
        form.setValue(
          'lines',
          form
            .getValues('lines')
            .map((line, index) =>
              index === row.index ? { ...line, requestedQuantity: quantity } : line,
            ),
          { shouldDirty: true },
        )
      } else {
        remove(row.index)
      }
      return
    }
    if (quantity <= 0) return

    append(lineFor(row.variation, quantity))
  }

  /**
   * Several quantities at once, from a product's dialog. Written as one new
   * list rather than a run of `setQuantity` calls, because removing one line
   * shifts the index of every line after it.
   */
  const applyQuantities = (changes: { row: TransferRow; quantity: number }[]) => {
    const next = [...form.getValues('lines')]
    for (const { row, quantity } of changes) {
      const at = next.findIndex((line) => line.variationId === row.variation.id)
      if (at > -1) {
        if (quantity > 0) next[at] = { ...next[at]!, requestedQuantity: quantity }
        else next.splice(at, 1)
      } else if (quantity > 0) {
        next.push(lineFor(row.variation, quantity))
      }
    }
    form.setValue('lines', next, { shouldDirty: true })
  }

  const movingUnits = lines.reduce((sum, line) => sum + (line.requestedQuantity || 0), 0)

  /*
    Just the rows actually going, for the review step. Out of a shelf holding a
    thousand parts somebody picks a handful, and the whole point of the last
    step is seeing that handful on its own — scrolling the shelf again looking
    for the ones with a number in them is the thing it exists to avoid.
  */
  const chosenRows = allRows.filter((row) => row.index > -1 && row.quantity > 0)

  const reviewColumns = buildTransferLineColumns({
    canSeeCost,
    cards: false,
    readOnly: true,
    fromName: from?.name ?? 'source',
    toName: to?.name ?? 'destination',
    demandName: demandLocation?.name ?? (requesting ? 'here' : 'source'),
    onQuantityChange: setQuantity,
    onRemove: (row) => remove(row.index),
  })

  return (
    <form>
      <Button variant="link" size="sm" className="h-auto px-0" asChild>
        <Link to={paths.products.transfers}>
          <ArrowLeft />
          {t('Transfers')}
        </Link>
      </Button>

      <PageHeader
        title={
          resuming
            ? t('{number} — unfinished', { number: resuming.number })
            : requesting
              ? t('New request')
              : t('New transfer')
        }
        description={
          requesting
            ? t('Ask another location to supply this one.')
            : t('Take stock off one shelf and put it on another.')
        }
        below={
          <Steps
            steps={['Route', 'Products', 'Review']}
            current={step}
            onSelect={(n) => goTo(n as 1 | 2 | 3)}
            // `goTo` decides what a forward jump is allowed to do, so the
            // steps stay clickable and land you on whatever is unfilled.
            selectable
            wide
          />
        }
        action={
          step < 3 ? (
            <div className="flex items-center gap-2">
              <Button type="button" variant="secondary" onClick={saveNow}>
                <Save />
                {t('Save')}
              </Button>
              <Button type="button" variant="primary" onClick={() => goTo((step + 1) as 2 | 3)}>
                {t('Continue')}
                <ArrowRight />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button type="button" variant="secondary" onClick={() => setStep(2)}>
                <ArrowLeft />
                {t('Back')}
              </Button>
              <Button type="button" variant="secondary" onClick={saveNow}>
                <Save />
                {t('Save')}
              </Button>
              {/* A request cannot dispatch: the goods are on somebody else's
                  shelf and they have not agreed to part with them yet. */}
              <Button
                type="button"
                variant="primary"
                onClick={submit(requesting ? 'draft' : 'in_transit')}
              >
                <Truck />
                {requesting ? t('Send the request') : t('Send now')}
              </Button>
            </div>
          )
        }
      />

      <div className="mt-4 space-y-3">
        {step === 3 ? (
          <ReviewStep
            rows={chosenRows}
            columns={reviewColumns}
            movingUnits={movingUnits}
            fromName={from?.name ?? '—'}
            toName={to?.name ?? '—'}
            requesting={requesting}
            comment={form.watch('comment')}
          />
        ) : step === 1 ? (
          <>
            <Card>
              <CardHeader className="flex-col items-stretch gap-2">
                <CardTitle>{t('Route')}</CardTitle>
                <div className="self-start">
                  <Controller
                    control={form.control}
                    name="kind"
                    render={({ field }) => (
                      <SegmentedControl
                        aria-label={t('Sending or requesting')}
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
                  {t(TRANSFER_KINDS.find((entry) => entry.value === kind)?.hint ?? '')}
                </p>
              </CardHeader>
              <CardBody className="grid items-start gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
                <Field
                  label={requesting ? t('Ask') : t('From')}
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
                              toast.info(t('Lines cleared — stock differs by location'))
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
                  label={requesting ? t('Deliver to') : t('To')}
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
                          placeholder={t('Pick a destination')}
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
                {/* Its own row under the route, spanning both ends. */}
                <Field
                  label={t('Comment')}
                  hint={t('Why this is moving — useful when it is queried later')}
                  className="sm:col-span-3"
                >
                  {(p) => (
                    <Input {...p} placeholder={t('Weekly top-up')} {...form.register('comment')} />
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
                <p className="text-fg-subtle text-2xs">
                  {requesting ? t('Request') : t('Transfer')}
                </p>
                <RouteLine
                  fromName={from?.name ?? '—'}
                  toName={to?.name ?? '—'}
                  comment={form.watch('comment')}
                />
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={() => setStep(1)}>
                <Pencil />
                {t('Edit details')}
              </Button>
            </Card>
            <TransferCatalogue
              rows={allRows}
              names={{
                from: from?.name ?? 'source',
                to: to?.name ?? 'destination',
                demand: demandLocation?.name ?? (requesting ? 'here' : 'source'),
                requesting,
              }}
              canSeeCost={canSeeCost}
              onApply={applyQuantities}
              actions={
                requesting ? (
                  <Button type="button" variant="primary" onClick={() => setGenerating(true)}>
                    <Wand2 />
                    {t('Suggest')}
                  </Button>
                ) : null
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

/**
 * The last look before it goes: only the lines actually moving.
 *
 * The products step is the whole sending shelf, hundreds of rows deep, and
 * picking a dozen out of it leaves nowhere to see the dozen together. That is
 * what this is for — the document as it will exist, rather than the shelf it
 * was chosen from.
 */
function ReviewStep({
  rows,
  columns,
  movingUnits,
  fromName,
  toName,
  requesting,
  comment,
}: {
  rows: TransferRow[]
  columns: TableColumn<TransferRow>[]
  movingUnits: number
  fromName: string
  toName: string
  requesting: boolean
  comment: string
}) {
  return (
    <>
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-fg-subtle text-2xs">{requesting ? t('Request') : t('Transfer')}</p>
          <RouteLine fromName={fromName} toName={toName} comment={comment} />
        </div>
        <p className="text-fg-muted text-sm">
          {requesting ? t('Asking for') : t('Moving')}{' '}
          <strong className="text-fg font-medium">{formatNumber(movingUnits)}</strong>{' '}
          {t('units across')}{' '}
          <strong className="text-fg font-medium">{formatNumber(rows.length)}</strong>{' '}
          {tn(rows.length, 'product', 'products')}
        </p>
      </Card>

      <DataTable
        reorderableColumns
        storageKey="transfer-review"
        columns={columns}
        data={rows}
        total={rows.length}
        getRowId={(row) => row.key}
        emptyState={
          <EmptyState
            title={t('Nothing on this transfer yet')}
            description={t('Go back to Products and put a quantity against what should move.')}
          />
        }
      />
    </>
  )
}

/** The route, with the comment on the same line — it says why this route. */
function RouteLine({
  fromName,
  toName,
  comment,
}: {
  fromName: string
  toName: string
  comment: string
}) {
  return (
    <p className="text-fg flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-medium">
      {fromName}
      <ArrowRight className="text-fg-subtle size-3.5" />
      {toName}
      {comment ? (
        <span className="text-fg-muted min-w-0 truncate font-normal" title={comment}>
          · {comment}
        </span>
      ) : null}
    </p>
  )
}
