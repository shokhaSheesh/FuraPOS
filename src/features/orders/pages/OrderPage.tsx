import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import {
  ArrowLeft,
  Ban,
  Check,
  FileText,
  LayoutGrid,
  List,
  PackageCheck,
  Send,
  Wand2,
} from 'lucide-react'
import { DataTable } from '@/shared/components/DataTable'
import { EmptyState } from '@/shared/components/EmptyState'
import { Field } from '@/shared/components/Field'
import { NumberField } from '@/shared/components/NumberField'
import { AddProductsMenu } from '@/shared/components/AddProductsMenu'
import { ProductPicker } from '@/shared/components/ProductPicker'
import { ProductThumb } from '@/shared/components/ProductThumb'
import { ScrollSentinel } from '@/shared/components/ScrollSentinel'
import { SearchInput } from '@/shared/components/SearchInput'
import { useInfiniteRows } from '@/shared/hooks/useInfiniteRows'
import { Steps } from '@/shared/components/Steps'
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

  if (!order) {
    return (
      <EmptyState
        title="That order no longer exists"
        description="It may have been deleted since this link was made."
        action={
          <Button variant="secondary" asChild>
            <Link to={paths.procurement.orders}>Back to orders</Link>
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
        <Button variant="ghost" size="icon" aria-label="Back to orders" asChild>
          <Link to={paths.procurement.orders}>
            <ArrowLeft />
          </Link>
        </Button>
        <h1 className="text-fg text-lg font-semibold">
          Order {order.number} — {orderSource(order)}
        </h1>
        <Badge tone={orderStatusTone(order.status)}>{orderStatusLabel(order.status)}</Badge>
        {order.expectedAt ? (
          <span className={late ? 'text-danger text-sm font-medium' : 'text-fg-muted text-sm'}>
            Expected {formatDate(order.expectedAt)}
            {late ? ` — ${formatNumber(late)} days late` : ''}
          </span>
        ) : null}
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
  const [adding, setAdding] = useState(false)

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

  return (
    <>
      {adding && !fromCatalogue ? (
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <ProductPicker
                onPick={(variation) =>
                  setQuantity(
                    {
                      key: variation.id,
                      line: order.lines.find((l) => l.variationId === variation.id) ?? null,
                      index: order.lines.findIndex((l) => l.variationId === variation.id),
                      variation,
                      name: variation.fullName,
                      quantity: 0,
                      unitCost: variation.costPrice,
                      costCurrency: variation.costCurrency,
                      newToUs: false,
                      stockHere: [],
                    },
                    (order.lines.find((l) => l.variationId === variation.id)?.orderedQuantity ??
                      0) + 1,
                  )
                }
                placeholder="Search or scan a barcode to put it on this order…"
              />
            </div>
            <Button variant="secondary" onClick={() => setAdding(false)}>
              Close scanning
            </Button>
          </div>
        </Card>
      ) : null}

      <DataTable
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
              placeholder="Search by barcode, SKU, variation or product name…"
            />
            <div className="flex-1" />
            <div className="border-border rounded-control flex items-center border p-0.5">
              <Button
                variant={cards ? 'ghost' : 'secondary'}
                size="icon"
                aria-label="Show one column per field"
                aria-pressed={!cards}
                onClick={() => setCards(false)}
              >
                <List />
              </Button>
              <Button
                variant={cards ? 'secondary' : 'ghost'}
                size="icon"
                aria-label="Show each product as a card"
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
                Suggest
              </Button>
            ) : null}
            {editable && !fromCatalogue ? (
              <AddProductsMenu onPickFromCatalogue={() => setAdding(true)} />
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
                Total quantity:{' '}
                <strong className="text-fg font-medium">{formatNumber(units)}</strong>
              </span>
              <span>
                Products: <strong className="text-fg font-medium">{order.lines.length}</strong>
              </span>
              {canSeeCost ? (
                <span>
                  Order value:{' '}
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
            title="Nothing on this order yet"
            description={
              order.status !== 'draft'
                ? 'This order was sent with no products on it.'
                : fromCatalogue
                  ? 'This supplier lists nothing, so there is nothing to order from them.'
                  : 'Use “Add products” to put the first line on, or let Suggest work out what is worth ordering.'
            }
          />
        }
      />

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
        scope={order.kind === 'supplier' ? undefined : 'Everything in our catalogue'}
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
          toast.success(`${suggestions.length} products added from the suggestion`)
          setSuggesting(false)
        }}
      />
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
        <CardTitle>About this order</CardTitle>
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
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() =>
                update.mutate(
                  { expectedAt, comment: comment || null },
                  {
                    onSuccess: () => toast.success('Saved'),
                    onError: (message) => toast.error(message),
                  },
                )
              }
            >
              Save
            </Button>
          </div>
        ) : null}
      </CardHeader>
      <CardBody className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Expected"
          hint="An order cannot be late against a date nobody gave, so leave it empty when nothing was promised"
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
                {expectedAt ? formatDate(expectedAt) : 'Nothing was promised'}
              </p>
            )
          }
        </Field>
        <Field label="Note" hint="Anything worth knowing when this order is queried later">
          {(p) =>
            editable ? (
              <Input
                {...p}
                placeholder="Container 4, Q3 restock"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            ) : (
              <p className="text-fg py-1.5 text-sm">{comment || 'None'}</p>
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
          <CardTitle>What is being ordered</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            {order.kind === 'china' ? (
              <Button variant="secondary" size="sm" asChild>
                <Link to={paths.procurement.orderDocument(order.id)}>
                  <FileText />
                  Download PDF
                </Link>
              </Button>
            ) : null}
            {canCancel(order.status) && can('procurement.orders.delete') ? (
              <Button variant="secondary" size="sm" onClick={() => setConfirmCancel(true)}>
                <Ban />
                Cancel order
              </Button>
            ) : null}
            {send && can('procurement.orders.edit') ? (
              <Button
                variant="primary"
                size="sm"
                disabled={order.lines.length === 0}
                title={order.lines.length === 0 ? 'Put something on it first' : undefined}
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
        title="Cancel this order?"
        confirmLabel="Cancel order"
        body={`${order.number} is closed and its ${formatNumber(
          outstandingUnits(order),
        )} outstanding units stop being expected. Nothing already delivered is affected.`}
        onConfirm={() =>
          actions.setStatus('cancelled', {
            onSuccess: () => {
              toast.success(`${order.number} cancelled`)
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
        title="Nothing on this order"
        description="Put some products on the first step and they will appear here."
      />
    )
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-max text-sm">
        <thead className="bg-canvas">
          <tr className="text-fg-muted text-2xs tracking-wide uppercase">
            <th className="px-4 py-2 text-left font-semibold">Product</th>
            <th className="px-4 py-2 text-right font-semibold">Ordered</th>
            <th className="px-4 py-2 text-right font-semibold">Delivered</th>
            <th className="px-4 py-2 text-right font-semibold">Still coming</th>
            {canSeeCost ? (
              <th className="px-4 py-2 text-right font-semibold">Agreed price</th>
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
                      <p className="text-fg-subtle text-2xs font-mono">{line.sku}</p>
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
                    <span className="text-success">complete</span>
                  ) : (
                    <span className="text-warning font-medium">{formatNumber(outstanding)}</span>
                  )}
                </td>
                {canSeeCost ? (
                  <td className="text-fg-muted px-4 py-2 text-right tabular-nums">
                    {line.costCurrency === 'USD'
                      ? `${line.unitCost.toFixed(2)} USD`
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
          <CardTitle>Deliveries against this order</CardTitle>
          {canReceive(order.status) && can('procurement.orders.edit') ? (
            <Button variant="primary" size="sm" onClick={openReceiving}>
              <PackageCheck />
              Book a delivery
            </Button>
          ) : null}
        </CardHeader>
        <CardBody className="p-0">
          {receipts.length === 0 ? (
            <EmptyState
              title="Nothing has arrived yet"
              description={
                canReceive(order.status)
                  ? 'When the supplier delivers, booking it in creates a goods receipt and adds the stock.'
                  : 'This order has not been sent, so nothing can be delivered against it.'
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-max text-sm">
                <thead className="bg-canvas">
                  <tr className="text-fg-muted text-2xs tracking-wide uppercase">
                    <th className="px-4 py-2 text-left font-semibold">Receipt</th>
                    <th className="px-4 py-2 text-left font-semibold">Invoice</th>
                    <th className="px-4 py-2 text-right font-semibold">Products</th>
                    <th className="px-4 py-2 text-left font-semibold">When</th>
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
          <CardTitle>What is still coming</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          <LineTable order={order} canSeeCost={canSeeCost} />
        </CardBody>
      </Card>

      <Modal
        open={receiving}
        onOpenChange={setReceiving}
        title="Book a delivery"
        size="lg"
        primary={{
          label: 'Book it in',
          disabled: arriving === 0,
          onClick: () =>
            actions.receive(
              { quantities, invoiceNumber },
              {
                onSuccess: (receiptId) => {
                  setReceiving(false)
                  toast.success(`${formatNumber(arriving)} units booked in`)
                  navigate(paths.products.goodsReceiptDetail(receiptId))
                },
                onError: (message) => toast.error(message),
              },
            ),
        }}
      >
        <div className="space-y-3">
          <Field label="Invoice number" hint="The supplier's, for matching their paperwork">
            {(p) => (
              <Input
                {...p}
                placeholder="INV-40218"
                value={invoiceNumber}
                onChange={(event) => setInvoiceNumber(event.target.value)}
              />
            )}
          </Field>

          <div className="border-border rounded-card overflow-x-auto border">
            <table className="w-full text-sm">
              <thead className="bg-canvas">
                <tr className="text-fg-muted text-2xs tracking-wide uppercase">
                  <th className="px-3 py-2 text-left font-semibold">Product</th>
                  <th className="px-3 py-2 text-right font-semibold">Still coming</th>
                  <th className="px-3 py-2 text-right font-semibold">Arrived</th>
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
                            <p className="text-fg-subtle text-2xs font-mono">{line.sku}</p>
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
                          aria-label={`Arrived ${line.name}`}
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
              ? 'Nothing to book in.'
              : `${formatNumber(arriving)} units, worth ${formatMoney(
                  Math.round(
                    order.lines.reduce(
                      (sum, line) =>
                        sum +
                        (quantities[line.id] ?? 0) *
                          toUzs(line.unitCost, line.costCurrency, USD_RATE),
                      0,
                    ),
                  ),
                )} at the agreed prices.`}
          </p>
        </div>
      </Modal>
    </>
  )
}
