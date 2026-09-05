import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ArrowLeft, Check, Clock, Truck } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { Select } from '@/shared/ui/Select'
import { DatePicker } from '@/shared/ui/DatePicker'
import { toast } from '@/shared/ui/toast'
import { paths } from '@/shared/config/paths'
import { useSession } from '@/app/providers/SessionProvider'
import { formatMoney } from '@/shared/lib/format'
import { cn } from '@/shared/lib/cn'
import { useCreateSale } from '../api/sales'
import type { Client } from '../api/sales'
import { ProductPicker } from '../components/ProductPicker'
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
import type { Product } from '@/features/products/model/product'

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
  const [locationId, setLocationId] = useState('loc-2')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
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
  const empty = lines.length === 0
  const deliveryIncomplete = deliveryOn && address.trim().length < 3

  const addProduct = (product: Product) => {
    setLines((previous) => {
      // Same product picked twice bumps the quantity rather than adding a
      // duplicate row — that is what the person is actually doing.
      const existing = previous.find((line) => line.productId === product.id)
      if (existing) {
        return previous.map((line) =>
          line.id === existing.id ? { ...line, quantity: line.quantity + 1 } : line,
        )
      }
      return [
        ...previous,
        {
          id: `${product.id}-${Date.now()}`,
          productId: product.id,
          sku: product.sku,
          name: product.name,
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
        locationId,
        paymentMethod,
        channel,
        comment,
        paid: settling ? Number(paidText) || totals.total : 0,
        lines,
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
        onError: (error) => toast.error(error.message),
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
              disabled={empty || createSale.isPending}
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
              disabled={empty || createSale.isPending}
              loading={createSale.isPending && createSale.variables?.status === 'postponed'}
              onClick={() => submit('postponed')}
            >
              <Clock />
              Postpone
            </Button>
            <Button
              variant="primary"
              disabled={empty || deliveryIncomplete || createSale.isPending}
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
              <Field label="Payment method">
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-fg-muted text-sm">{label}</span>
      {children}
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
