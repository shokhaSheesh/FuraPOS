import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft, Ban, Check, PackageCheck, Send } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState'
import { ProductThumb } from '@/shared/components/ProductThumb'
import { NumberField } from '@/shared/components/NumberField'
import { Field } from '@/shared/components/Field'
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { Modal } from '@/shared/ui/Modal'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { toast } from '@/shared/ui/toast'
import { useSession } from '@/app/providers/SessionProvider'
import { paths } from '@/shared/config/paths'
import { formatDate, formatDateTime, formatMoney, formatNumber } from '@/shared/lib/format'
import { USD_RATE } from '@/data/seed'
import { useOrder, useOrderActions, useOrderReceipts } from '../api/orders'
import {
  canCancel,
  canReceive,
  daysLate,
  deliveredRatio,
  lineOutstanding,
  nextStep,
  orderStatusLabel,
  orderStatusTone,
  orderValue,
  orderedUnits,
  outstandingUnits,
  outstandingValue,
  receivedUnits,
  toUzs,
} from '../model/order'

export default function OrderDetailPage() {
  const navigate = useNavigate()
  const { orderId } = useParams()
  const { can } = useSession()
  const { data: order } = useOrder(orderId ?? '')
  const receipts = useOrderReceipts(orderId ?? '')
  const actions = useOrderActions(orderId ?? '')

  const [receiving, setReceiving] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [invoiceNumber, setInvoiceNumber] = useState('')

  // Opens pre-filled with everything still outstanding, because the usual case
  // is that the rest of the order turned up.
  useEffect(() => {
    if (!receiving || !order) return
    setQuantities(Object.fromEntries(order.lines.map((line) => [line.id, lineOutstanding(line)])))
    setInvoiceNumber('')
  }, [receiving, order])

  if (!order) {
    return <EmptyState title="Order not found" description="It may have been deleted." />
  }

  const step = nextStep(order.status)
  const late = daysLate(order)
  const canSeeCost = can('products.cost.view')
  const arriving = Object.values(quantities).reduce((sum, value) => sum + value, 0)

  return (
    <>
      <Button variant="link" size="sm" className="h-auto px-0" asChild>
        <Link to={paths.procurement.orders}>
          <ArrowLeft />
          Orders
        </Link>
      </Button>

      <PageHeader
        title={order.number}
        description={`${formatNumber(order.lines.length)} products from ${
          order.supplierName ?? 'an unnamed supplier'
        }`}
        action={
          <div className="flex items-center gap-2">
            {canCancel(order.status) && can('procurement.orders.delete') ? (
              <Button variant="secondary" onClick={() => setConfirmCancel(true)}>
                <Ban />
                Cancel
              </Button>
            ) : null}
            {canReceive(order.status) && can('procurement.orders.edit') ? (
              <Button variant="secondary" onClick={() => setReceiving(true)}>
                <PackageCheck />
                Book a delivery
              </Button>
            ) : null}
            {step && can('procurement.orders.edit') ? (
              <Button
                variant="primary"
                onClick={() =>
                  actions.setStatus(step.to, {
                    onSuccess: () => toast.success(`${order.number} ${step.label.toLowerCase()}`),
                    onError: (message) => toast.error(message),
                  })
                }
              >
                {step.to === 'sent' ? <Send /> : <Check />}
                {step.label}
              </Button>
            ) : null}
          </div>
        }
        below={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={orderStatusTone(order.status)}>{orderStatusLabel(order.status)}</Badge>
            <span className="text-fg-muted text-sm">Into {order.locationName}</span>
            {order.expectedAt ? (
              <span className={late ? 'text-danger text-sm font-medium' : 'text-fg-muted text-sm'}>
                · Expected {formatDate(order.expectedAt)}
                {late ? ` — ${formatNumber(late)} days late` : ''}
              </span>
            ) : null}
            {order.comment ? (
              <span className="text-fg-subtle text-sm">· {order.comment}</span>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Figure
          label="Ordered"
          value={`${formatNumber(orderedUnits(order))} units`}
          meta={canSeeCost ? formatMoney(Math.round(orderValue(order, USD_RATE))) : ''}
        />
        <Figure
          label="Delivered"
          value={`${formatNumber(receivedUnits(order))} units`}
          meta={`${Math.round(deliveredRatio(order) * 100)}% of the order`}
        />
        <Figure
          label="Still coming"
          value={`${formatNumber(outstandingUnits(order))} units`}
          meta={canSeeCost ? formatMoney(Math.round(outstandingValue(order, USD_RATE))) : ''}
          tone={outstandingUnits(order) > 0 && late ? 'danger' : undefined}
        />
        <Figure
          label="Deliveries"
          value={formatNumber(receipts.length)}
          meta={order.sentAt ? `Sent ${formatDate(order.sentAt)}` : 'Not sent yet'}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
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
                      <td
                        className={`px-4 py-2 text-right font-medium tabular-nums ${
                          outstanding === 0 ? 'text-fg-subtle' : 'text-fg'
                        }`}
                      >
                        {outstanding === 0 ? 'complete' : formatNumber(outstanding)}
                      </td>
                      {canSeeCost ? (
                        <td className="text-fg-muted px-4 py-2 text-right tabular-nums">
                          {line.costCurrency === 'USD'
                            ? `${formatNumber(line.unitCost)} USD`
                            : formatMoney(line.unitCost)}
                        </td>
                      ) : null}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Deliveries against this order</CardTitle>
        </CardHeader>
        <CardBody className={receipts.length ? 'p-0' : undefined}>
          {receipts.length === 0 ? (
            <p className="text-fg-subtle text-sm">
              Nothing has been booked against {order.number} yet. When the goods arrive, "Book a
              delivery" records what turned up and puts it on the shelf.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-canvas">
                  <tr className="text-fg-muted text-2xs tracking-wide uppercase">
                    <th className="px-4 py-2 text-left font-semibold">Receipt</th>
                    <th className="px-4 py-2 text-left font-semibold">Invoice</th>
                    <th className="px-4 py-2 text-right font-semibold">Items</th>
                    <th className="px-4 py-2 text-left font-semibold">When</th>
                  </tr>
                </thead>
                <tbody>
                  {receipts.map((receipt) => (
                    <tr key={receipt.id} className="border-border border-t">
                      <td className="px-4 py-2">
                        <Link
                          to={paths.products.goodsReceiptDetail(receipt.id)}
                          className="text-fg text-2xs font-mono hover:underline"
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

      <Modal
        open={receiving}
        onOpenChange={setReceiving}
        title={`Book a delivery against ${order.number}`}
        description="Count what arrived. This creates a goods receipt, puts the stock on the shelf and updates what is still outstanding."
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

function Figure({
  label,
  value,
  meta,
  tone,
}: {
  label: string
  value: string
  meta: string
  tone?: 'danger'
}) {
  return (
    <Card className="p-4">
      <p className="text-fg-muted text-sm">{label}</p>
      <p
        className={`mt-0.5 text-lg font-semibold ${tone === 'danger' ? 'text-danger' : 'text-fg'}`}
      >
        {value}
      </p>
      {meta ? <p className="text-fg-subtle text-2xs">{meta}</p> : null}
    </Card>
  )
}
