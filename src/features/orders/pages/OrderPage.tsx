import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import {
  ArrowLeft,
  Ban,
  Check,
  FileText,
  ArrowRight,
  LayoutGrid,
  List,
  PackageCheck,
  Save,
  Send,
  Wand2,
} from 'lucide-react'
import { DataTable } from '@/shared/components/DataTable'
import { EmptyState } from '@/shared/components/EmptyState'
import { Field } from '@/shared/components/Field'
import { NumberField } from '@/shared/components/NumberField'
import { AddProductsMenu } from '@/shared/components/AddProductsMenu'
import { PurchaseCatalogue } from '@/shared/components/catalogue/PurchaseCatalogue'
import { buildPurchaseRows, type PurchaseOffer } from '@/shared/components/catalogue/purchaseRows'
import type { VariationDraft } from '@/shared/components/catalogue/VariationsDialog'
import { demandAt } from '@/shared/lib/demand'
import { ProductThumb } from '@/shared/components/ProductThumb'
import { ScrollSentinel } from '@/shared/components/ScrollSentinel'
import { SearchInput } from '@/shared/components/SearchInput'
import { useInfiniteRows } from '@/shared/hooks/useInfiniteRows'
import { Steps } from '@/shared/components/Steps'
import { StorageAddress } from '@/shared/components/StorageAddress'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { DatePicker } from '@/shared/ui/DatePicker'
import { Input } from '@/shared/ui/Input'
import { Modal } from '@/shared/ui/Modal'
import { toast } from '@/shared/ui/toast'
import { paths } from '@/shared/config/paths'
import { useSession } from '@/app/providers/SessionProvider'
import { formatDate, formatDateTime, formatMoney, formatNumber } from '@/shared/lib/format'
import { useDataStore } from '@/data/store'
import { USD_RATE } from '@/data/seed'
import type { VariationRow } from '@/features/products/model/product'
import { catalogueFor } from '@/features/suppliers/model/catalogue'
import { GenerateOrderModal } from '../components/GenerateOrderModal'
import { buildOrderLineColumns, type OrderRow } from '../components/orderLineColumns'
import { ownCatalogue } from '../model/ownCatalogue'
import { planCatalogueRows } from '@/features/receipts/model/lineRows'
import {
  canCancel,
  canReceive,
  daysLate,
  lineOutstanding,
  nextStep,
  orderSource,
  orderStatusLabel,
  orderStatusTone,
  orderValue,
  orderedUnits,
  outstandingUnits,
  toUzs,
  type OrderLine,
  type PurchaseOrder,
} from '../model/order'
import { useOrder, useOrderActions, useOrderReceipts, useUpdateOrder } from '../api/orders'
import { t, tn } from '@/shared/i18n'

/*
  Three, not the receipt's four. A receipt's "Extra data" step owns something
  real — the freight and duty that turn a supplier's price into a cost price.
  An order has no such thing: its only extra data is the date and the note,
  both already asked on the way in, so a step for them would be the same two
  questions twice. They live on Review instead, where they can still be
  changed while the order is a draft.
*/
const STEPS = ['Add products', 'Review and send', 'Deliveries']

/**
 * A purchase order, from empty document to delivered.
 *
 * One screen with four steps, the same shape as a goods receipt, because an
 * order has the same life: it is built, it is sent, and then it is delivered
 * against — often weeks apart and by different people. Any step opens at any
 * time for that reason.
 *
 * Sending is the point of no return: the supplier is working from the document
 * after that, so editing it here would leave us checking their delivery
 * against something they were never sent.
 */
export default function OrderPage() {
  const { orderId = '' } = useParams()
  const { can } = useSession()
  const { data: order } = useOrder(orderId)
  const [step, setStep] = useState(1)

  /*
    Every change is written as it is made, so an unfinished order is never
    lost. Leaving still says so — by the back link, the sidebar or anything
    else — when something changed on this visit, the way a transfer does.
  */
  const openedWith = useRef(snapshot(order))
  const latest = useRef(order)
  useEffect(() => {
    latest.current = order
  }, [order])
  useEffect(
    () => () => {
      const now = latest.current
      if (now?.status === 'draft' && snapshot(now) !== openedWith.current) {
        toast.success(
          t('{number} saved as unfinished — pick it up from Orders', { number: now.number }),
        )
      }
    },
    [],
  )

  if (!order) {
    return (
      <EmptyState
        title={t('That order no longer exists')}
        description={t('It may have been deleted since this link was made.')}
        action={
          <Button variant="secondary" asChild>
            <Link to={paths.procurement.orders}>{t('Back to orders')}</Link>
          </Button>
        }
      />
    )
  }

  const editable = order.status === 'draft' && can('procurement.orders.edit')
  const late = daysLate(order)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="icon" aria-label={t('Back to orders')} asChild>
          <Link to={paths.procurement.orders}>
            <ArrowLeft />
          </Link>
        </Button>
        <h1 className="text-fg text-lg font-semibold">
          {t('Order')} {order.number} — {orderSource(order)}
        </h1>
        <Badge tone={orderStatusTone(order.status)}>{orderStatusLabel(order.status)}</Badge>
        {order.expectedAt ? (
          <span className={late ? 'text-danger text-sm font-medium' : 'text-fg-muted text-sm'}>
            {t('Expected')} {formatDate(order.expectedAt)}
            {late ? t(' — {p0} days late', { p0: formatNumber(late) }) : ''}
          </span>
        ) : null}
        {/* Through the steps in order (client request), not only by the circles. */}
        <div className="ml-auto flex items-center gap-2">
          {step > 1 ? (
            <Button variant="secondary" onClick={() => setStep(step - 1)}>
              <ArrowLeft />
              {t('Back')}
            </Button>
          ) : null}
          {editable ? (
            <Button
              variant="secondary"
              onClick={() => {
                openedWith.current = snapshot(order)
                toast.success(t('{number} saved as unfinished', { number: order.number }))
              }}
            >
              <Save />
              {t('Save')}
            </Button>
          ) : null}
          {step < STEPS.length ? (
            <Button variant="primary" onClick={() => setStep(step + 1)}>
              {t('Continue')}
              <ArrowRight />
            </Button>
          ) : null}
        </div>
      </div>

      <Steps steps={STEPS} current={step} onSelect={setStep} selectable wide />

      {step === 1 ? (
        <ProductsStep order={order} editable={editable} />
      ) : step === 2 ? (
        <ReviewStep order={order} editable={editable} />
      ) : (
        <DeliveriesStep order={order} />
      )}
    </div>
  )
}

/* --- shared ------------------------------------------------------------- */

/** What leaving compares against, to say whether this visit changed anything. */
const snapshot = (order: PurchaseOrder | undefined) =>
  order ? JSON.stringify([order.lines, order.comment, order.expectedAt]) : ''

/**
 * The rows of the product step, laid out over a catalogue exactly as a goods
 * receipt's are.
 *
 * Which catalogue depends on who the order is with: a supplier's own while it
 * is being written, ours for a market run or a factory order, where there is
 * no catalogue of theirs to start from and the buyer walks the bazaar with our
 * list in hand. Either way the table *is* the catalogue — typing a quantity is
 * what puts a line on the order, and clearing it takes the line off.
 *
 * Once the order has been sent the catalogue goes away and only its own lines
 * remain: the document is what the supplier is working from, and showing
 * everything they sell beside it answers no question anybody has.
 */
function useOrderRows(order: PurchaseOrder): OrderRow[] {
  const variations = useDataStore((s) => s.variations)
  const locations = useDataStore((s) => s.locations)
  const supplierProducts = useDataStore((s) => s.supplierProducts)

  return useMemo(() => {
    const shelvesOf = (variationId: string | undefined) => {
      const variation = variations.find((v) => v.id === variationId)
      return (variation?.stockByLocation ?? []).map((row) => ({
        locationName: locations.find((l) => l.id === row.locationId)?.name ?? '—',
        quantity: row.quantity,
      }))
    }

    const fromLine = (line: OrderLine, index: number): OrderRow => ({
      key: line.id,
      line,
      index,
      variation: variations.find((v) => v.id === line.variationId),
      name: line.name,
      quantity: line.orderedQuantity,
      unitCost: line.unitCost,
      costCurrency: line.costCurrency,
      newToUs: false,
      stockHere: shelvesOf(line.variationId),
    })

    /*
      Only a supplier's own catalogue fills the table. A market run or a
      factory order is picked out of *our* catalogue, which is every product we
      carry — hundreds of rows of which two are wanted. That is a search, not a
      list to read down, so those two start empty and use the same Add products
      menu a receipt does.
    */
    const catalogue =
      order.status === 'draft' && order.kind === 'supplier' && order.supplierId
        ? catalogueFor(supplierProducts, variations, order.supplierId)
        : []

    if (catalogue.length === 0) return order.lines.map(fromLine)

    return planCatalogueRows(order.lines, catalogue).map(({ key, lineIndex, entry }): OrderRow => {
      const line = lineIndex > -1 ? order.lines[lineIndex]! : null
      if (!entry) return { ...fromLine(line!, lineIndex), key }
      return {
        key,
        line,
        index: lineIndex,
        variation: entry.variation ?? undefined,
        name: line?.name ?? entry.product.name,
        quantity: line?.orderedQuantity ?? 0,
        // Their asking price is where an agreement starts, not where it ends:
        // once a line is on the order the number is ours to negotiate.
        unitCost: line?.unitCost ?? entry.product.price,
        costCurrency: line?.costCurrency ?? entry.product.currency,
        newToUs: entry.variation === null,
        stockHere: shelvesOf(entry.variation?.id),
      }
    })
  }, [
    order.lines,
    order.status,
    order.kind,
    order.supplierId,
    variations,
    locations,
    supplierProducts,
  ])
}

/* --- step 1: add products ----------------------------------------------- */

function ProductsStep({ order, editable }: { order: PurchaseOrder; editable: boolean }) {
  const navigate = useNavigate()
  const { can } = useSession()
  const canSeeCost = can('products.cost.view')
  const update = useUpdateOrder(order.id)
  const variations = useDataStore((s) => s.variations)
  const supplierProducts = useDataStore((s) => s.supplierProducts)
  const all = useOrderRows(order)

  /** What Suggest runs its pass over — the same catalogue the table is showing. */
  const catalogue = useMemo(
    () =>
      order.kind === 'supplier'
        ? order.supplierId
          ? catalogueFor(supplierProducts, variations, order.supplierId)
          : []
        : ownCatalogue(variations),
    [order.kind, order.supplierId, supplierProducts, variations],
  )
  const [cards, setCards] = useState(false)
  const [search, setSearch] = useState('')
  const [suggesting, setSuggesting] = useState(false)
  const sales = useDataStore((s) => s.sales)
  const locationName = useDataStore(
    (s) => s.locations.find((l) => l.id === order.locationId)?.name ?? 'this location',
  )

  /*
    What the cards browse while the order is being written: the supplier's own
    catalogue, or ours for a market run or a factory — with the order's lines
    laid over it.
  */
  const offers = useMemo<PurchaseOffer[]>(
    () =>
      catalogue.flatMap((entry) =>
        entry.variation
          ? [
              {
                variation: entry.variation,
                price: entry.product.price,
                currency: entry.product.currency,
                supplierSku: order.kind === 'supplier' ? entry.product.supplierSku : null,
                // Only a supplier keeps a price list with dates on it.
                listedAt: order.kind === 'supplier' ? entry.product.updatedAt : null,
              },
            ]
          : [],
      ),
    [catalogue, order.kind],
  )
  /** They list it and we have never carried it — nothing to order against yet. */
  const newToUs = catalogue.filter((entry) => !entry.variation).length
  const pickRows = useMemo(
    () =>
      editable
        ? buildPurchaseRows({
            offers,
            lines: order.lines.map((line) => ({
              variationId: line.variationId,
              quantity: line.orderedQuantity,
              unitCost: line.unitCost,
              costCurrency: line.costCurrency,
              expected: null,
            })),
            variations,
            locationId: order.locationId,
            // Company-wide, as Suggest counts it: an order refills the business.
            demandOf: (id) => demandAt(sales, id, null),
          })
        : [],
    [editable, offers, order.lines, order.locationId, variations, sales],
  )

  /** Whether their catalogue is already the table, so nothing needs adding. */
  const fromCatalogue = order.kind === 'supplier' && order.status === 'draft'

  const matching = search.trim()
    ? all.filter((row) =>
        [row.variation?.barcode, row.variation?.sku, row.name, row.variation?.productName]
          .filter((field): field is string => Boolean(field))
          .some((field) => field.toLowerCase().includes(search.trim().toLowerCase())),
      )
    : all

  // Our own catalogue runs to hundreds of rows on a market order, so only the
  // first slice is drawn and scrolling grows it. Search still reaches all of
  // them, because the filter above runs first.
  const { visible: rows, hasMore, shown, total, sentinel, showMore } = useInfiniteRows(matching)

  const writeLines = (lines: OrderLine[]) =>
    update.mutate({ lines }, { onError: (message) => toast.error(message) })

  /** Change how many of a row are wanted, whether or not it is on the order yet. */
  const setQuantity = (row: OrderRow, quantity: number) => {
    if (row.line) {
      writeLines(
        quantity > 0
          ? order.lines.map((line, i) =>
              i === row.index ? { ...line, orderedQuantity: quantity } : line,
            )
          : order.lines.filter((_, i) => i !== row.index),
      )
      return
    }
    if (quantity <= 0 || !row.variation) return

    const variation = row.variation
    writeLines([
      ...order.lines,
      {
        id: `pol-${order.id}-${Date.now()}`,
        variationId: variation.id,
        productId: variation.productId,
        sku: variation.sku,
        name: variation.fullName,
        imageUrl: variation.imageUrl,
        unit: variation.unit,
        orderedQuantity: quantity,
        receivedQuantity: 0,
        unitCost: row.unitCost,
        costCurrency: row.costCurrency,
      },
    ])
  }

  const patchLine = (row: OrderRow, patch: Partial<OrderLine>) => {
    if (!row.line) return
    writeLines(order.lines.map((line, i) => (i === row.index ? { ...line, ...patch } : line)))
  }

  const columns = buildOrderLineColumns({
    editable,
    canSeeCost,
    cards,
    usdRate: USD_RATE,
    onQuantityChange: setQuantity,
    onCostChange: (row, unitCost) => patchLine(row, { unitCost }),
    onCurrencyChange: (row, costCurrency) => patchLine(row, { costCurrency }),
    onRemove: (row) => writeLines(order.lines.filter((_, i) => i !== row.index)),
  })

  const units = orderedUnits(order)

  /** A product's dialog, applied: quantities and agreed prices in one write. */
  const applyChanges = (changes: { row: { variation: VariationRow }; draft: VariationDraft }[]) => {
    const next = [...order.lines]
    for (const { row, draft } of changes) {
      const variation = row.variation
      const at = next.findIndex((line) => line.variationId === variation.id)
      if (at > -1) {
        if (draft.quantity > 0) {
          next[at] = {
            ...next[at]!,
            orderedQuantity: draft.quantity,
            unitCost: draft.unitCost,
            costCurrency: draft.costCurrency,
          }
        } else {
          next.splice(at, 1)
        }
      } else if (draft.quantity > 0) {
        next.push({
          id: `pol-${order.id}-${variation.id}`,
          variationId: variation.id,
          productId: variation.productId,
          sku: variation.sku,
          name: variation.fullName,
          imageUrl: variation.imageUrl,
          unit: variation.unit,
          orderedQuantity: draft.quantity,
          receivedQuantity: 0,
          unitCost: draft.unitCost,
          costCurrency: draft.costCurrency,
        })
      }
    }
    writeLines(next)
  }

  const suggestModal = (
    <GenerateOrderModal
      open={suggesting}
      onOpenChange={setSuggesting}
      entries={catalogue}
      supplierName={
        order.kind === 'market'
          ? 'the market'
          : order.kind === 'china'
            ? 'China'
            : (order.supplierName ?? '')
      }
      scope={order.kind === 'supplier' ? undefined : t('Everything in our catalogue')}
      onAdd={(suggestions) => {
        /*
          Suggestions top up what is already on the order rather than
          replacing it: somebody has usually typed a few lines by hand before
          asking, and throwing those away would be the opposite of help.
        */
        const byVariation = new Map(order.lines.map((line) => [line.variationId, line]))
        for (const suggestion of suggestions) {
          const existing = byVariation.get(suggestion.variationId)
          const variation = variations.find((v) => v.id === suggestion.variationId)
          if (!variation) continue
          byVariation.set(suggestion.variationId, {
            id: existing?.id ?? `pol-${order.id}-${suggestion.variationId}`,
            variationId: variation.id,
            productId: variation.productId,
            sku: variation.sku,
            name: variation.fullName,
            imageUrl: variation.imageUrl,
            unit: variation.unit,
            orderedQuantity: suggestion.suggested,
            receivedQuantity: existing?.receivedQuantity ?? 0,
            unitCost: existing?.unitCost ?? suggestion.price,
            costCurrency: existing?.costCurrency ?? suggestion.currency,
          })
        }
        writeLines([...byVariation.values()])
        toast.success(
          t('{length} products added from the suggestion', { length: suggestions.length }),
        )
        setSuggesting(false)
      }}
    />
  )

  if (editable) {
    return (
      <>
        <PurchaseCatalogue
          rows={pickRows}
          storageKey="order"
          noun="order"
          locationName={locationName}
          canSeeCost={canSeeCost}
          onApply={applyChanges}
          actions={
            <>
              <Button type="button" variant="primary" onClick={() => setSuggesting(true)}>
                <Wand2 />
                {t('Suggest')}
              </Button>
              {!fromCatalogue ? (
                <AddProductsMenu
                  onUploadSpreadsheet={() => navigate(paths.procurement.orderImport(order.id))}
                />
              ) : null}
            </>
          }
          summary={
            <>
              {canSeeCost ? (
                <p className="text-fg-muted text-sm">
                  {t('Order value:')}{' '}
                  <strong className="text-fg font-medium">
                    {formatMoney(Math.round(orderValue(order, USD_RATE)))}
                  </strong>
                </p>
              ) : null}
              {newToUs > 0 ? (
                <p className="text-fg-subtle text-2xs">
                  {formatNumber(newToUs)} {t('more they list')} {tn(newToUs, 'is', 'are')}{' '}
                  {t('new to us — add')} {tn(newToUs, 'it', 'them')}{' '}
                  {t('to the catalogue to order')}
                </p>
              ) : null}
            </>
          }
        />
        {suggestModal}
      </>
    )
  }

  return (
    <>
      <DataTable
        reorderableColumns
        storageKey={cards ? 'order-lines-cards' : 'order-lines'}
        columns={columns}
        data={rows}
        total={rows.length}
        getRowId={(row) => row.key}
        toolbar={
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder={t('Search by barcode, SKU, variation or product name…')}
            />
            <div className="flex-1" />
            <div className="border-border rounded-control flex items-center border p-0.5">
              <Button
                variant={cards ? 'ghost' : 'secondary'}
                size="icon"
                aria-label={t('Show one column per field')}
                aria-pressed={!cards}
                onClick={() => setCards(false)}
              >
                <List />
              </Button>
              <Button
                variant={cards ? 'secondary' : 'ghost'}
                size="icon"
                aria-label={t('Show each product as a card')}
                aria-pressed={cards}
                onClick={() => setCards(true)}
              >
                <LayoutGrid />
              </Button>
            </div>
            {editable ? (
              <Button
                variant={fromCatalogue ? 'primary' : 'secondary'}
                onClick={() => setSuggesting(true)}
              >
                <Wand2 />
                {t('Suggest')}
              </Button>
            ) : null}
            {editable && !fromCatalogue ? (
              <AddProductsMenu
                onUploadSpreadsheet={() => navigate(paths.procurement.orderImport(order.id))}
              />
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
                {t('Total quantity:')}{' '}
                <strong className="text-fg font-medium">{formatNumber(units)}</strong>
              </span>
              <span>
                {t('Products:')}{' '}
                <strong className="text-fg font-medium">{order.lines.length}</strong>
              </span>
              {canSeeCost ? (
                <span>
                  {t('Order value:')}{' '}
                  <strong className="text-fg font-medium">
                    {formatMoney(Math.round(orderValue(order, USD_RATE)))}
                  </strong>
                </span>
              ) : null}
            </div>
          </>
        }
        emptyState={
          <EmptyState
            title={t('Nothing on this order yet')}
            description={
              order.status !== 'draft'
                ? t('This order was sent with no products on it.')
                : fromCatalogue
                  ? t('This supplier lists nothing, so there is nothing to order from them.')
                  : t(
                      'Use “Add products” to put the first line on, or let Suggest work out what is worth ordering.',
                    )
            }
          />
        }
      />

      {suggestModal}
    </>
  )
}

/**
 * The date and note, where they can still be changed.
 *
 * Both were asked when the order was created, so this is not a second place to
 * fill them in — it is the only place to correct them once the order exists.
 */
function DetailsCard({ order, editable }: { order: PurchaseOrder; editable: boolean }) {
  const update = useUpdateOrder(order.id)
  const [expectedAt, setExpectedAt] = useState(order.expectedAt)
  const [comment, setComment] = useState(order.comment ?? '')

  const dirty = expectedAt !== order.expectedAt || comment !== (order.comment ?? '')

  return (
    <Card>
      <CardHeader className="items-start justify-between gap-3">
        <CardTitle>{t('About this order')}</CardTitle>
        {editable && dirty ? (
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setExpectedAt(order.expectedAt)
                setComment(order.comment ?? '')
              }}
            >
              {t('Cancel')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() =>
                update.mutate(
                  { expectedAt, comment: comment || null },
                  {
                    onSuccess: () => toast.success(t('Saved')),
                    onError: (message) => toast.error(message),
                  },
                )
              }
            >
              {t('Save')}
            </Button>
          </div>
        ) : null}
      </CardHeader>
      <CardBody className="grid gap-4 sm:grid-cols-2">
        <Field
          label={t('Expected')}
          hint={t(
            'An order cannot be late against a date nobody gave, so leave it empty when nothing was promised',
          )}
        >
          {() =>
            editable ? (
              <DatePicker
                className="w-full"
                // The order carries an ISO string; the picker deals in dates,
                // so the conversion happens at the boundary.
                value={expectedAt ? new Date(expectedAt) : null}
                onChange={(date) => setExpectedAt(date ? date.toISOString() : null)}
              />
            ) : (
              <p className="text-fg py-1.5 text-sm">
                {expectedAt ? formatDate(expectedAt) : t('Nothing was promised')}
              </p>
            )
          }
        </Field>
        <Field
          label={t('Note')}
          hint={t('Anything worth knowing when this order is queried later')}
        >
          {(p) =>
            editable ? (
              <Input
                {...p}
                placeholder={t('Container 4, Q3 restock')}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            ) : (
              <p className="text-fg py-1.5 text-sm">{comment || t('None')}</p>
            )
          }
        </Field>
      </CardBody>
    </Card>
  )
}

/* --- step 3: review and send --------------------------------------------- */

function ReviewStep({ order, editable }: { order: PurchaseOrder; editable: boolean }) {
  const navigate = useNavigate()
  const { can } = useSession()
  const actions = useOrderActions(order.id)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const canSeeCost = can('products.cost.view')
  const send = nextStep(order.status, order.kind)

  return (
    <>
      <DetailsCard order={order} editable={editable} />

      <Card>
        <CardHeader className="items-start justify-between gap-3">
          <CardTitle>{t('What is being ordered')}</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            {order.kind === 'china' ? (
              <Button variant="secondary" size="sm" asChild>
                <Link to={paths.procurement.orderDocument(order.id)}>
                  <FileText />
                  {t('Download PDF')}
                </Link>
              </Button>
            ) : null}
            {canCancel(order.status) && can('procurement.orders.delete') ? (
              <Button variant="secondary" size="sm" onClick={() => setConfirmCancel(true)}>
                <Ban />
                {t('Cancel order')}
              </Button>
            ) : null}
            {send && can('procurement.orders.edit') ? (
              <Button
                variant="primary"
                size="sm"
                disabled={order.lines.length === 0}
                title={order.lines.length === 0 ? t('Put something on it first') : undefined}
                onClick={() =>
                  actions.setStatus(send.to, {
                    onSuccess: () => toast.success(`${order.number} ${send.label.toLowerCase()}`),
                    onError: (message) => toast.error(message),
                  })
                }
              >
                {send.to === 'sent' ? <Send /> : <Check />}
                {send.label}
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardBody className="p-0">
          <LineTable order={order} canSeeCost={canSeeCost} />
        </CardBody>
      </Card>

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title={t('Cancel this order?')}
        confirmLabel={t('Cancel order')}
        body={`${order.number} is closed and its ${formatNumber(
          outstandingUnits(order),
        )} outstanding units stop being expected. Nothing already delivered is affected.`}
        onConfirm={() =>
          actions.setStatus('cancelled', {
            onSuccess: () => {
              toast.success(t('{number} cancelled', { number: order.number }))
              setConfirmCancel(false)
              navigate(paths.procurement.orders)
            },
            onError: (message) => toast.error(message),
          })
        }
      />
    </>
  )
}

/** Ordered against delivered, per line — the same table on two steps. */
function LineTable({ order, canSeeCost }: { order: PurchaseOrder; canSeeCost: boolean }) {
  if (order.lines.length === 0) {
    return (
      <EmptyState
        title={t('Nothing on this order')}
        description={t('Put some products on the first step and they will appear here.')}
      />
    )
  }
  return (
    <div className="scroll-x-quiet overflow-x-auto">
      <table className="w-full min-w-max text-sm">
        <thead className="bg-canvas">
          <tr className="text-fg-muted text-2xs tracking-wide uppercase">
            <th className="px-4 py-2 text-left font-semibold">{t('Product')}</th>
            <th className="px-4 py-2 text-right font-semibold">{t('Ordered')}</th>
            <th className="px-4 py-2 text-right font-semibold">{t('Delivered')}</th>
            <th className="px-4 py-2 text-right font-semibold">{t('Still coming')}</th>
            {canSeeCost ? (
              <th className="px-4 py-2 text-right font-semibold">{t('Agreed price')}</th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {order.lines.map((line) => {
            const outstanding = lineOutstanding(line)
            return (
              <tr key={line.id} className="border-border border-t">
                <td className="px-4 py-2">
                  <Link
                    to={paths.products.detail(line.productId)}
                    className="flex items-center gap-2.5 hover:underline"
                  >
                    <ProductThumb src={line.imageUrl} size="sm" />
                    <div className="min-w-0">
                      <p className="text-fg font-medium">{line.name}</p>
                      <p className="text-fg-subtle text-2xs font-mono">
                        {line.sku}
                        <StorageAddress variationId={line.variationId} />
                      </p>
                    </div>
                  </Link>
                </td>
                <td className="text-fg-muted px-4 py-2 text-right tabular-nums">
                  {formatNumber(line.orderedQuantity)} {line.unit}
                </td>
                <td className="text-fg px-4 py-2 text-right tabular-nums">
                  {formatNumber(line.receivedQuantity)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {outstanding === 0 ? (
                    <span className="text-success">{t('complete')}</span>
                  ) : (
                    <span className="text-warning font-medium">{formatNumber(outstanding)}</span>
                  )}
                </td>
                {canSeeCost ? (
                  <td className="text-fg-muted px-4 py-2 text-right tabular-nums">
                    {line.costCurrency === t('USD')
                      ? t('{p0} USD', { p0: line.unitCost.toFixed(2) })
                      : formatMoney(line.unitCost)}
                  </td>
                ) : null}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/* --- step 4: deliveries -------------------------------------------------- */

function DeliveriesStep({ order }: { order: PurchaseOrder }) {
  const navigate = useNavigate()
  const { can } = useSession()
  const receipts = useOrderReceipts(order.id)
  const actions = useOrderActions(order.id)
  const canSeeCost = can('products.cost.view')

  const [receiving, setReceiving] = useState(false)
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [invoiceNumber, setInvoiceNumber] = useState('')

  // Opens pre-filled with everything still outstanding, because the usual case
  // is that the rest of the order turned up.
  const openReceiving = () => {
    setQuantities(Object.fromEntries(order.lines.map((line) => [line.id, lineOutstanding(line)])))
    setInvoiceNumber('')
    setReceiving(true)
  }

  const arriving = Object.values(quantities).reduce((sum, value) => sum + value, 0)

  return (
    <>
      <Card>
        <CardHeader className="items-start justify-between gap-3">
          <CardTitle>{t('Deliveries against this order')}</CardTitle>
          {canReceive(order.status) && can('procurement.orders.edit') ? (
            <Button variant="primary" size="sm" onClick={openReceiving}>
              <PackageCheck />
              {t('Book a delivery')}
            </Button>
          ) : null}
        </CardHeader>
        <CardBody className="p-0">
          {receipts.length === 0 ? (
            <EmptyState
              title={t('Nothing has arrived yet')}
              description={
                canReceive(order.status)
                  ? t(
                      'When the supplier delivers, booking it in creates a goods receipt and adds the stock.',
                    )
                  : t('This order has not been sent, so nothing can be delivered against it.')
              }
            />
          ) : (
            <div className="scroll-x-quiet overflow-x-auto">
              <table className="w-full min-w-max text-sm">
                <thead className="bg-canvas">
                  <tr className="text-fg-muted text-2xs tracking-wide uppercase">
                    <th className="px-4 py-2 text-left font-semibold">{t('Receipt')}</th>
                    <th className="px-4 py-2 text-left font-semibold">{t('Invoice')}</th>
                    <th className="px-4 py-2 text-right font-semibold">{t('Products')}</th>
                    <th className="px-4 py-2 text-left font-semibold">{t('When')}</th>
                  </tr>
                </thead>
                <tbody>
                  {receipts.map((receipt) => (
                    <tr key={receipt.id} className="border-border border-t">
                      <td className="px-4 py-2">
                        <Link
                          to={paths.products.goodsReceiptDetail(receipt.id)}
                          className="text-primary text-2xs font-mono hover:underline"
                        >
                          {receipt.number}
                        </Link>
                      </td>
                      <td className="text-fg-muted text-2xs px-4 py-2 font-mono">
                        {receipt.invoiceNumber ?? '—'}
                      </td>
                      <td className="text-fg-muted px-4 py-2 text-right tabular-nums">
                        {formatNumber(receipt.lines.length)}
                      </td>
                      <td className="text-fg-muted px-4 py-2">
                        {receipt.receivedAt ? formatDateTime(receipt.receivedAt) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('What is still coming')}</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          <LineTable order={order} canSeeCost={canSeeCost} />
        </CardBody>
      </Card>

      <Modal
        open={receiving}
        onOpenChange={setReceiving}
        title={t('Book a delivery')}
        size="lg"
        primary={{
          label: t('Book it in'),
          disabled: arriving === 0,
          onClick: () =>
            actions.receive(
              { quantities, invoiceNumber },
              {
                onSuccess: (receiptId) => {
                  setReceiving(false)
                  toast.success(t('{p0} units booked in', { p0: formatNumber(arriving) }))
                  navigate(paths.products.goodsReceiptDetail(receiptId))
                },
                onError: (message) => toast.error(message),
              },
            ),
        }}
      >
        <div className="space-y-3">
          <Field
            label={t('Invoice number')}
            hint={t("The supplier's, for matching their paperwork")}
          >
            {(p) => (
              <Input
                {...p}
                placeholder={t('INV-40218')}
                value={invoiceNumber}
                onChange={(event) => setInvoiceNumber(event.target.value)}
              />
            )}
          </Field>

          <div className="border-border rounded-card scroll-x-quiet overflow-x-auto border">
            <table className="w-full text-sm">
              <thead className="bg-canvas">
                <tr className="text-fg-muted text-2xs tracking-wide uppercase">
                  <th className="px-3 py-2 text-left font-semibold">{t('Product')}</th>
                  <th className="px-3 py-2 text-right font-semibold">{t('Still coming')}</th>
                  <th className="px-3 py-2 text-right font-semibold">{t('Arrived')}</th>
                </tr>
              </thead>
              <tbody>
                {order.lines.map((line) => {
                  const outstanding = lineOutstanding(line)
                  return (
                    <tr key={line.id} className="border-border border-t">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2.5">
                          <ProductThumb src={line.imageUrl} size="sm" />
                          <div className="min-w-0">
                            <p className="text-fg font-medium">{line.name}</p>
                            <p className="text-fg-subtle text-2xs font-mono">
                              {line.sku}
                              <StorageAddress variationId={line.variationId} />
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="text-fg-muted px-3 py-2 text-right tabular-nums">
                        {outstanding === 0
                          ? 'complete'
                          : `${formatNumber(outstanding)} ${line.unit}`}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <NumberField
                          className="w-24"
                          nullable={false}
                          min={0}
                          disabled={outstanding === 0}
                          aria-label={t('Arrived {name}', { name: line.name })}
                          value={quantities[line.id] ?? 0}
                          onChange={(next) =>
                            setQuantities((current) => ({
                              ...current,
                              // Never more than is outstanding: over-shipping is
                              // something that was not ordered, and belongs on
                              // its own receipt rather than inflating this one.
                              [line.id]: Math.min(outstanding, Math.max(0, next ?? 0)),
                            }))
                          }
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <p className="text-fg-muted text-sm">
            {arriving === 0
              ? t('Nothing to book in.')
              : t('{p0} units, worth {p1} at the agreed prices.', {
                  p0: formatNumber(arriving),
                  p1: formatMoney(
                    Math.round(
                      order.lines.reduce(
                        (sum, line) =>
                          sum +
                          (quantities[line.id] ?? 0) *
                            toUzs(line.unitCost, line.costCurrency, USD_RATE),
                        0,
                      ),
                    ),
                  ),
                })}
          </p>
        </div>
      </Modal>
    </>
  )
}
