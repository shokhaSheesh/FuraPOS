import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ArrowLeft, Check, Clock, Tag, Truck } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { Select } from '@/shared/ui/Select'
import { DatePicker } from '@/shared/ui/DatePicker'
import { toast } from '@/shared/ui/toast'
import { paths } from '@/shared/config/paths'
import { useSession } from '@/app/providers/SessionProvider'
import { useOpenShiftAt } from '@/features/cashShifts/api/shifts'
import { DriverPicker } from '../components/DriverPicker'
import { SegmentedControl } from '@/shared/ui/SegmentedControl'
import {
  DRIVER_SECTIONS,
  capacityOfSection,
  describeCapacity,
  describeTruck,
  inSection,
  soleTruckFor,
  trucksFor,
  type Driver,
  type DriverCapacity,
} from '@/features/drivers/model/driver'
import { cashSaleBlocked } from '@/features/cashShifts/model/shift'
import { formatMoney } from '@/shared/lib/format'
import { cn } from '@/shared/lib/cn'
import { useCreateSale } from '../api/sales'
import type { Client } from '../api/sales'
import { ProductPicker } from '@/shared/components/ProductPicker'
import { SaleLinesTable } from '../components/SaleLinesTable'
import { ClientPicker } from '../components/ClientPicker'
import {
  computeTotals,
  PAYMENT_METHODS,
  SALE_CHANNELS,
  type PaymentMethod,
  type SaleChannel,
  type SaleLine,
  type SaleStatus,
} from '../model/sale'
import type { VariationRow } from '@/features/products/model/product'
import { useDataStore } from '@/data/store'
import { useBestPromotion } from '@/features/promotions/api/promotions'
import { covers, describe as describePromotion } from '@/features/promotions/model/promotion'

const LOCATIONS = [
  { value: 'loc-1', label: 'Central warehouse' },
  { value: 'loc-2', label: 'Shop — Chilonzor' },
  { value: 'loc-3', label: 'Shop — Yunusobod' },
]

/**
 * Manual sale entry. There is no cashier POS in this product — sales are
 * recorded here, at the desk — so this screen has to carry everything a
 * receipt does: lines, prices, discounts, who bought, how they paid.
 *
 * A full page rather than a modal, because it has line items
 * (docs/DESIGN_RULES.md § 7.1).
 */
export default function NewSalePage() {
  const navigate = useNavigate()
  const { user } = useSession()
  const createSale = useCreateSale()

  const [lines, setLines] = useState<SaleLine[]>([])
  const [client, setClient] = useState<Client | null>(null)
  const allClients = useDataStore((s) => s.clients)
  /*
    Who collected the parts, and in which capacity.

    A driver who owns a truck *and* drives for an autopark is two different
    customers, so the capacity is asked here rather than stored on him. It
    settles three things at once: whose account the sale lands in, which truck
    collects the history, and — because the autopark's contract is an ordinary
    promotion aimed at that client — whether the fleet discount fires.
  */
  const [driver, setDriver] = useState<Driver | null>(null)
  const [truckPlate, setTruckPlate] = useState<string | null>(null)
  /*
    Which kind of driver is buying, asked before the man himself.

    This is the question the old "Buying for" toggle asked after the fact. A
    man who owns a lorry *and* drives for an autopark is two customers, and
    the list he was picked from already says which of them walked in.
  */
  const [section, setSection] = useState<'independent' | 'autopark'>('independent')
  const capacity = capacityOfSection(section)

  /** Whose account the sale lands in, and which truck collects the history. */
  const attribute = (forDriver: Driver | null, forCapacity: DriverCapacity) => {
    // An autopark assigns one truck, so that settles itself. A man who owns
    // three lorries has to say which he came in.
    setTruckPlate(forDriver ? (soleTruckFor(forDriver, forCapacity)?.plate ?? null) : null)
    setClient(
      forDriver && forCapacity === 'autopark'
        ? (allClients.find((entry) => entry.id === forDriver.autoparkId) ?? null)
        : // Buying for himself is not a company purchase: the autopark must
          // come off the sale, or its promotion would still apply.
          null,
    )
  }

  const pickDriver = (next: Driver | null) => {
    setDriver(next)
    attribute(next, capacity)
  }

  const pickSection = (next: 'independent' | 'autopark') => {
    setSection(next)
    // A driver who is both stays selected across the switch — he is in either
    // list. Anybody else is not, and keeping him would leave a name on the
    // sale that the picker below cannot offer.
    const kept = driver && inSection(driver, next) ? driver : null
    setDriver(kept)
    attribute(kept, capacityOfSection(next))
  }

  const truckOptions = driver ? trucksFor(driver, capacity) : []
  /** Several of his own: the purchase would otherwise land on a guess. */
  const needsTruck = truckOptions.length > 1 && truckPlate === null
  const [locationId, setLocationId] = useState('loc-2')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  /*
    Cash needs an open drawer. Without this rule the cash-up on Cash shifts
    compares counted money against sales that were never attributable to
    anybody, and the variance it reports means nothing.
  */
  const openShift = useOpenShiftAt(locationId)
  const noDrawer = cashSaleBlocked(paymentMethod, openShift !== null)
  const [channel, setChannel] = useState<SaleChannel>('desk')
  const [comment, setComment] = useState('')
  const [paidText, setPaidText] = useState('')
  const [expiresAt, setExpiresAt] = useState<Date | null>(null)

  const [deliveryOn, setDeliveryOn] = useState(false)
  const [address, setAddress] = useState('')
  const [deliveryCostText, setDeliveryCostText] = useState('')
  const [scheduledFor, setScheduledFor] = useState<Date | null>(null)
  const [courier, setCourier] = useState('')

  const deliveryCost = deliveryOn ? Number(deliveryCostText) || 0 : 0
  const totals = useMemo(
    () => computeTotals(lines, Number(paidText) || 0, deliveryCost),
    [lines, paidText, deliveryCost],
  )

  /*
    Promotions are matched on category and product, which a sale line carries
    only as *names* — deliberately, so history survives a rename. So the ids
    come from the catalogue at match time.
  */
  const variations = useDataStore((s) => s.variations)
  const promotableLines = useMemo(
    () =>
      lines.map((line) => {
        const variation = variations.find((v) => v.id === line.variationId)
        return {
          variationId: line.variationId,
          productId: line.productId,
          categoryId: variation?.categoryId ?? null,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
        }
      }),
    [lines, variations],
  )
  const offer = useBestPromotion(promotableLines, client?.id ?? null)
  /*
    Which promotion the seller applied, carried onto the sale. Without it the
    discount lands as an anonymous percentage and the promotions report cannot
    tell a campaign's sales from anybody else's.
  */
  const [appliedPromotionId, setAppliedPromotionId] = useState<string | null>(null)
  const alreadyDiscounted = lines.some((line) => line.discountPercent > 0)

  /**
   * Applies the offer as a per-line percentage.
   *
   * A sale only knows how to discount a line by percent, and both promotion
   * kinds reduce to one: the discount is always a share of the value it
   * covers, so `discount ÷ covered × 100` is exact for a fixed amount too.
   */
  const applyOffer = () => {
    if (!offer) return
    setAppliedPromotionId(offer.promotion.id)
    const covered = promotableLines.filter((line) => covers(offer.promotion, line))
    const coveredValue = covered.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0)
    if (coveredValue <= 0) return
    const percent = (offer.discount / coveredValue) * 100
    const coveredIds = new Set(covered.map((line) => line.variationId))
    setLines((previous) =>
      previous.map((line) =>
        coveredIds.has(line.variationId)
          ? { ...line, discountPercent: Math.round(percent * 100) / 100 }
          : line,
      ),
    )
    toast.success(`${offer.promotion.name} applied`)
  }
  const empty = lines.length === 0
  const deliveryIncomplete = deliveryOn && address.trim().length < 3

  const addProduct = (product: VariationRow) => {
    setLines((previous) => {
      // Same product picked twice bumps the quantity rather than adding a
      // duplicate row — that is what the person is actually doing.
      const existing = previous.find((line) => line.variationId === product.id)
      if (existing) {
        return previous.map((line) =>
          line.id === existing.id ? { ...line, quantity: line.quantity + 1 } : line,
        )
      }
      return [
        ...previous,
        {
          id: `${product.id}-${Date.now()}`,
          variationId: product.id,
          productId: product.productId,
          sku: product.sku,
          name: product.fullName,
          brandName: product.brandName,
          categoryName: product.categoryName,
          imageUrl: product.imageUrl,
          unit: product.unit,
          quantity: 1,
          unitPrice: product.salePrice,
          discountPercent: 0,
        },
      ]
    })
  }

  const updateLine = (id: string, patch: Partial<SaleLine>) =>
    setLines((previous) => previous.map((line) => (line.id === id ? { ...line, ...patch } : line)))

  const removeLine = (id: string) =>
    setLines((previous) => previous.filter((line) => line.id !== id))

  /**
   * A sale that still has to be delivered is not finished, so completing it
   * moves to `processed` rather than `completed` — the delivery states then
   * carry it the rest of the way.
   *
   * Saving without completing splits by where the sale came from: something
   * half-rung at the counter is `open` (the seller will come back to it),
   * while an order taken by phone or online is `new` — it is complete as an
   * order and waiting on someone to process it. Without this, `new` was a
   * status the filters offered that nothing could ever produce.
   */
  const submit = (intent: 'save' | 'postponed' | 'complete') => {
    const status: SaleStatus =
      intent === 'complete'
        ? deliveryOn
          ? 'processed'
          : 'completed'
        : intent === 'postponed'
          ? 'postponed'
          : channel === 'desk'
            ? 'open'
            : 'new'
    const settling = intent === 'complete'

    createSale.mutate(
      {
        clientId: client?.id ?? null,
        driverId: driver?.id ?? null,
        truckPlate,
        locationId,
        paymentMethod,
        channel,
        comment,
        paid: settling ? Number(paidText) || totals.total : 0,
        lines,
        promotionId: appliedPromotionId,
        delivery: deliveryOn
          ? {
              address: address.trim(),
              cost: deliveryCost,
              scheduledFor: scheduledFor ? scheduledFor.toISOString().slice(0, 10) : null,
              courier: courier.trim() || null,
            }
          : null,
        expiresAt:
          intent === 'postponed'
            ? (expiresAt ?? new Date(Date.now() + 3 * 86_400_000)).toISOString()
            : null,
        status,
      },
      {
        onSuccess: (sale) => {
          toast.success(
            intent === 'save'
              ? `Sale ${sale.number} saved as ${status}`
              : intent === 'postponed'
                ? `Sale ${sale.number} postponed`
                : deliveryOn
                  ? `Sale ${sale.number} accepted for delivery`
                  : `Sale ${sale.number} completed`,
          )
          navigate(
            intent === 'save'
              ? status === 'open'
                ? paths.sales.ordersByStatus(status)
                : paths.sales.orders
              : intent === 'postponed'
                ? paths.sales.ordersByStatus('postponed')
                : paths.sales.orders,
          )
        },
      },
    )
  }

  return (
    <>
      <Button variant="link" size="sm" className="h-auto px-0" asChild>
        <Link to={paths.sales.orders}>
          <ArrowLeft />
          All sales
        </Link>
      </Button>

      <PageHeader
        title="New sale"
        description="Record a sale taken at the desk, by phone or on delivery."
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              disabled={empty || noDrawer || needsTruck || createSale.isPending}
              loading={
                createSale.isPending &&
                (createSale.variables?.status === 'open' || createSale.variables?.status === 'new')
              }
              onClick={() => submit('save')}
            >
              Save
            </Button>
            <Button
              variant="secondary"
              disabled={empty || noDrawer || needsTruck || createSale.isPending}
              loading={createSale.isPending && createSale.variables?.status === 'postponed'}
              onClick={() => submit('postponed')}
            >
              <Clock />
              Postpone
            </Button>
            <Button
              variant="primary"
              disabled={
                empty || noDrawer || needsTruck || deliveryIncomplete || createSale.isPending
              }
              loading={
                createSale.isPending &&
                (createSale.variables?.status === 'completed' ||
                  createSale.variables?.status === 'processed')
              }
              onClick={() => submit('complete')}
            >
              <Check />
              {deliveryOn ? 'Accept order' : 'Complete sale'}
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <Card>
            <CardBody className="p-4">
              <ProductPicker onPick={addProduct} />
            </CardBody>
            <SaleLinesTable lines={lines} onChange={updateLine} onRemove={removeLine} />
          </Card>
        </div>

        <div className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle>Customer</CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
              <ClientPicker value={client} onChange={setClient} />

              <SegmentedControl
                aria-label="Which kind of driver is buying"
                value={section}
                onChange={pickSection}
                options={DRIVER_SECTIONS}
              />
              <DriverPicker section={section} value={driver} onChange={pickDriver} />

              {driver ? (
                <p className="text-fg-subtle text-2xs">
                  Buying for {describeCapacity(driver, capacity)}
                </p>
              ) : null}

              {truckOptions.length > 1 ? (
                <div className="space-y-1.5">
                  <p className="text-fg-muted text-sm">
                    Which truck<span className="text-danger ml-0.5">*</span>
                  </p>
                  <div className="grid gap-1.5">
                    {truckOptions.map((truck) => (
                      <Button
                        key={truck.plate}
                        type="button"
                        variant={truckPlate === truck.plate ? 'primary' : 'secondary'}
                        className="justify-start font-normal"
                        onClick={() => setTruckPlate(truck.plate)}
                      >
                        <span className="font-mono">{truck.plate}</span>
                        {/* The make answers half of "will this part fit" before
                            anybody asks it. */}
                        <span className="text-fg-subtle truncate">{describeTruck(truck)}</span>
                      </Button>
                    ))}
                  </div>
                  {needsTruck ? (
                    <p className="text-danger text-2xs">
                      He owns {truckOptions.length} trucks — say which this is for.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {client && client.debt > 0 ? (
                <p className="text-warning text-2xs">
                  This client already owes {formatMoney(client.debt)}.
                </p>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
              <Field label="Location">
                <Select
                  value={locationId}
                  onChange={setLocationId}
                  options={LOCATIONS}
                  aria-label="Location"
                  className="w-full"
                />
              </Field>
              <Field label="Source">
                <Select
                  value={channel}
                  onChange={setChannel}
                  options={SALE_CHANNELS}
                  aria-label="Source"
                  className="w-full"
                />
              </Field>
              <Field
                label="Payment method"
                error={
                  noDrawer
                    ? 'No cash drawer is open at this location — open a shift, or take payment another way'
                    : undefined
                }
              >
                <Select
                  value={paymentMethod}
                  onChange={setPaymentMethod}
                  options={PAYMENT_METHODS}
                  aria-label="Payment method"
                  className="w-full"
                />
              </Field>
              <Field label="Seller">
                <Input value={user?.name ?? ''} readOnly disabled />
              </Field>
              <Field label="Comment">
                <Input
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder="Optional"
                />
              </Field>
              <Field label="Hold until">
                <DatePicker
                  value={expiresAt}
                  onChange={setExpiresAt}
                  placeholder="3 days by default"
                  minDate={new Date()}
                />
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Delivery</CardTitle>
              <label className="text-fg-muted flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={deliveryOn}
                  onChange={(event) => setDeliveryOn(event.target.checked)}
                  className="accent-primary size-4"
                />
                Required
              </label>
            </CardHeader>
            {deliveryOn ? (
              <CardBody className="space-y-3">
                <Field label="Address">
                  <Input
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                    placeholder="Street, building, flat"
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Cost">
                    <Input
                      type="number"
                      min={0}
                      value={deliveryCostText}
                      onChange={(event) => setDeliveryCostText(event.target.value)}
                      placeholder="0"
                      className="text-right"
                    />
                  </Field>
                  <Field label="Date">
                    <DatePicker
                      value={scheduledFor}
                      onChange={setScheduledFor}
                      placeholder="Pick a date"
                      minDate={new Date()}
                    />
                  </Field>
                </div>
                <Field label="Courier">
                  <Input
                    value={courier}
                    onChange={(event) => setCourier(event.target.value)}
                    placeholder="Optional"
                  />
                </Field>
              </CardBody>
            ) : (
              <CardBody>
                <p className="text-fg-subtle flex items-center gap-2 text-sm">
                  <Truck className="size-4" />
                  Customer is taking it with them.
                </p>
              </CardBody>
            )}
          </Card>

          {offer && !alreadyDiscounted ? (
            <Card className="border-primary-border/60">
              <CardBody className="flex items-start gap-2.5">
                <Tag className="text-fg-muted mt-0.5 size-4 shrink-0" />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-fg text-sm font-medium">{offer.promotion.name}</p>
                  <p className="text-fg-muted text-2xs">
                    {describePromotion(offer.promotion)} — takes {formatMoney(offer.discount)} off
                    this sale.
                  </p>
                  <Button type="button" variant="secondary" size="sm" onClick={applyOffer}>
                    Apply it
                  </Button>
                </div>
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Total</CardTitle>
            </CardHeader>
            <CardBody className="space-y-2">
              <Row label="Subtotal" value={formatMoney(totals.subtotal)} />
              {totals.discount > 0 ? (
                <Row label="Discount" value={`− ${formatMoney(totals.discount)}`} tone="warning" />
              ) : null}
              {totals.deliveryCost > 0 ? (
                <Row label="Delivery" value={`+ ${formatMoney(totals.deliveryCost)}`} />
              ) : null}
              <div className="border-border flex items-baseline justify-between border-t pt-2">
                <span className="text-fg text-sm font-medium">To pay</span>
                <span className="text-fg text-lg font-semibold">{formatMoney(totals.total)}</span>
              </div>

              <Field label="Paid">
                <Input
                  type="number"
                  min={0}
                  value={paidText}
                  onChange={(event) => setPaidText(event.target.value)}
                  placeholder={String(totals.total)}
                  aria-label="Amount paid"
                  className="text-right"
                />
              </Field>

              {totals.change > 0 ? (
                <Row label="Change" value={formatMoney(totals.change)} tone="success" />
              ) : null}
              {totals.debt > 0 && paidText !== '' ? (
                <Row label="Remaining debt" value={formatMoney(totals.debt)} tone="danger" />
              ) : null}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  )
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <label className="block space-y-1">
      <span className="text-fg-muted text-sm">{label}</span>
      {children}
      {error ? <span className="text-danger text-2xs block">{error}</span> : null}
    </label>
  )
}

function Row({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'warning' | 'success' | 'danger'
}) {
  return (
    <div className="flex items-baseline justify-between text-sm">
      <span className="text-fg-muted">{label}</span>
      <span
        className={cn(
          'font-medium tabular-nums',
          tone === 'warning' && 'text-warning',
          tone === 'success' && 'text-success',
          tone === 'danger' && 'text-danger',
          !tone && 'text-fg',
        )}
      >
        {value}
      </span>
    </div>
  )
}
