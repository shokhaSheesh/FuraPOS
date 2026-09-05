import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft, HandCoins, MapPin, RotateCcw, Trash2, Truck } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState'
import { ProductThumb } from '@/shared/components/ProductThumb'
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Skeleton } from '@/shared/ui/Skeleton'
import { Tabs } from '@/shared/ui/Tabs'
import { toast } from '@/shared/ui/toast'
import { paths } from '@/shared/config/paths'
import { cn } from '@/shared/lib/cn'
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatNumber,
  formatPercent,
} from '@/shared/lib/format'
import { useSale, useUpdateSale } from '../api/sales'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { RecordPaymentModal } from '../components/RecordPaymentModal'
import { SaleTimeline } from '../components/SaleTimeline'
import {
  lineTotal,
  nextStep,
  PAYMENT_METHODS,
  SALE_CHANNELS,
  SALE_STATUSES,
  type Sale,
} from '../model/sale'

/**
 * One sale, in full. Every column the list can show has a home here — the list
 * is a summary of this page, so anything the table exposes must be readable
 * somewhere on it.
 */
export default function SaleDetailPage() {
  const { orderId = '' } = useParams()
  const { data: sale, isLoading, isError } = useSale(orderId)
  const update = useUpdateSale(orderId)
  const [payOpen, setPayOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  if (isLoading) return <DetailSkeleton />

  if (isError || !sale) {
    return (
      <Card>
        <EmptyState
          title="Sale not found"
          description="It may have been removed, or the link is wrong."
          action={
            <Button variant="secondary" asChild>
              <Link to={paths.sales.orders}>Back to all sales</Link>
            </Button>
          }
        />
      </Card>
    )
  }

  const status = SALE_STATUSES.find((s) => s.value === sale.status)
  const step = nextStep(sale.status)
  const units = sale.lines.reduce((sum, line) => sum + line.quantity, 0)

  const advance = () => {
    if (!step) return
    update.mutate(
      { status: step.to },
      {
        onSuccess: () => toast.success(`${sale.number} → ${step.label.toLowerCase()}`),
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
        title={sale.number}
        description={`${formatDate(sale.createdAt)} · ${sale.locationName} · ${sale.sellerName}`}
        action={
          <div className="flex items-center gap-2">
            {sale.status === 'deleted' ? (
              <Button
                variant="secondary"
                loading={update.isPending}
                onClick={() =>
                  update.mutate(
                    { status: 'open' },
                    { onSuccess: () => toast.success(`${sale.number} restored`) },
                  )
                }
              >
                <RotateCcw />
                Restore
              </Button>
            ) : (
              <Button variant="ghost" aria-label="Delete sale" onClick={() => setDeleteOpen(true)}>
                <Trash2 />
                Delete
              </Button>
            )}
            {sale.debt > 0 && sale.status !== 'deleted' ? (
              <Button variant="secondary" onClick={() => setPayOpen(true)}>
                <HandCoins />
                Record payment
              </Button>
            ) : null}
            {step && sale.status !== 'deleted' ? (
              <Button variant="primary" loading={update.isPending} onClick={advance}>
                {step.label}
              </Button>
            ) : null}
          </div>
        }
        below={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={status?.tone ?? 'neutral'}>{status?.label ?? sale.status}</Badge>
            <Badge>{SALE_CHANNELS.find((c) => c.value === sale.channel)?.label}</Badge>
            {sale.delivery ? <Badge tone="info">Delivery</Badge> : null}
            {sale.expiresAt ? (
              <Badge tone="warning">Expires {formatDate(sale.expiresAt)}</Badge>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Total" value={formatMoney(sale.total)} />
        <Metric
          label="Paid"
          value={formatMoney(sale.paid)}
          tone={sale.paid > 0 ? 'success' : undefined}
        />
        <Metric
          label="Debt"
          value={sale.debt > 0 ? formatMoney(sale.debt) : '—'}
          tone={sale.debt > 0 ? 'danger' : undefined}
        />
        <Metric label="Items" value={`${formatNumber(units)} in ${sale.lines.length} lines`} />
      </div>

      <Tabs
        items={[
          { value: 'overview', label: 'Overview', content: <Overview sale={sale} /> },
          ...(sale.delivery
            ? [{ value: 'delivery', label: 'Delivery', content: <Delivery sale={sale} /> }]
            : []),
          {
            value: 'activity',
            label: 'Activity',
            content: (
              <Card>
                <CardBody className="p-4">
                  <SaleTimeline sale={sale} />
                </CardBody>
              </Card>
            ),
          },
        ]}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this sale?"
        body={
          <>
            <strong className="text-fg font-medium">{sale.number}</strong> moves to Deleted sales.
            It stays in the ledger for audit and can be restored.
          </>
        }
        submitting={update.isPending}
        onConfirm={() =>
          update.mutate(
            { status: 'deleted' },
            {
              onSuccess: () => {
                toast.success(`${sale.number} deleted`)
                setDeleteOpen(false)
              },
              onError: (error) => toast.error(error.message),
            },
          )
        }
      />

      <RecordPaymentModal
        open={payOpen}
        onOpenChange={setPayOpen}
        debt={sale.debt}
        submitting={update.isPending}
        onConfirm={(amount) =>
          update.mutate(
            { paid: amount },
            {
              onSuccess: () => {
                toast.success(`${formatMoney(amount)} recorded against ${sale.number}`)
                setPayOpen(false)
              },
              onError: (error) => toast.error(error.message),
            },
          )
        }
      />
    </>
  )
}

function Overview({ sale }: { sale: Sale }) {
  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Items</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted">
              <tr className="text-fg-muted text-2xs tracking-wide uppercase">
                <th scope="col" className="h-9 px-3 text-left font-semibold">
                  Product
                </th>
                <th scope="col" className="h-9 px-3 text-left font-semibold">
                  Brand
                </th>
                <th scope="col" className="h-9 px-3 text-left font-semibold">
                  Category
                </th>
                <th scope="col" className="h-9 px-3 text-right font-semibold">
                  Qty
                </th>
                <th scope="col" className="h-9 px-3 text-right font-semibold">
                  Price
                </th>
                <th scope="col" className="h-9 px-3 text-right font-semibold">
                  Disc
                </th>
                <th scope="col" className="h-9 px-3 text-right font-semibold">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {sale.lines.map((line) => (
                <tr key={line.id}>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2.5">
                      <ProductThumb src={line.imageUrl} size="sm" />
                      <div className="min-w-0">
                        <p className="text-fg font-medium">{line.name}</p>
                        <p className="text-fg-subtle text-2xs font-mono">{line.sku}</p>
                      </div>
                    </div>
                  </td>
                  <td className="text-fg-muted px-3 py-2">
                    {line.brandName ?? <span className="text-fg-subtle">—</span>}
                  </td>
                  <td className="text-fg-muted px-3 py-2">
                    {line.categoryName ?? <span className="text-fg-subtle">—</span>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatNumber(line.quantity)} {line.unit}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatMoney(line.unitPrice)}
                  </td>
                  <td className="text-fg-muted px-3 py-2 text-right tabular-nums">
                    {line.discountPercent > 0 ? formatPercent(line.discountPercent / 100) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums">
                    {formatMoney(lineTotal(line))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <CardBody className="border-border space-y-2 border-t p-4">
          <Row label="Subtotal" value={formatMoney(sale.subtotal)} />
          {sale.discount > 0 ? (
            <Row label="Discount" value={`− ${formatMoney(sale.discount)}`} tone="warning" />
          ) : null}
          {sale.deliveryCost > 0 ? (
            <Row label="Delivery" value={`+ ${formatMoney(sale.deliveryCost)}`} />
          ) : null}
          <div className="border-border flex items-baseline justify-between border-t pt-2">
            <span className="text-fg text-sm font-medium">Total</span>
            <span className="text-fg text-lg font-semibold">{formatMoney(sale.total)}</span>
          </div>
          <Row label="Paid" value={formatMoney(sale.paid)} tone="success" />
          {sale.debt > 0 ? <Row label="Debt" value={formatMoney(sale.debt)} tone="danger" /> : null}
        </CardBody>
      </Card>

      <div className="space-y-3">
        <Card>
          <CardHeader>
            <CardTitle>Customer</CardTitle>
          </CardHeader>
          <CardBody>
            {sale.clientId ? (
              <Button variant="link" size="sm" className="h-auto px-0" asChild>
                <Link to={paths.marketing.clientDetail(sale.clientId)}>{sale.clientName}</Link>
              </Button>
            ) : (
              <p className="text-fg-muted text-sm">Walk-in customer</p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardBody className="space-y-2">
            <Row label="Location" value={sale.locationName} />
            <Row label="Seller" value={sale.sellerName} />
            <Row
              label="Source"
              value={SALE_CHANNELS.find((c) => c.value === sale.channel)?.label ?? '—'}
            />
            <Row
              label="Payment"
              value={PAYMENT_METHODS.find((m) => m.value === sale.paymentMethod)?.label ?? '—'}
            />
            <Row label="Created" value={formatDateTime(sale.createdAt)} />
            <Row label="Updated" value={formatDateTime(sale.updatedAt)} />
            <Row label="Finished" value={sale.finishedAt ? formatDateTime(sale.finishedAt) : '—'} />
            {sale.comment ? <Row label="Comment" value={sale.comment} /> : null}
          </CardBody>
        </Card>
      </div>
    </div>
  )
}

function Delivery({ sale }: { sale: Sale }) {
  if (!sale.delivery) return null
  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Delivery</CardTitle>
      </CardHeader>
      <CardBody className="space-y-3">
        <p className="text-fg flex items-start gap-2 text-sm">
          <MapPin className="text-fg-subtle mt-0.5 size-4 shrink-0" />
          {sale.delivery.address}
        </p>
        <div className="space-y-2">
          <Row label="Cost" value={formatMoney(sale.delivery.cost)} />
          <Row
            label="Scheduled for"
            value={sale.delivery.scheduledFor ? formatDate(sale.delivery.scheduledFor) : 'Not set'}
          />
          <Row label="Courier" value={sale.delivery.courier ?? 'Not assigned'} />
        </div>
        <p className="text-fg-subtle text-2xs flex items-center gap-2">
          <Truck className="size-3.5" />
          The sale completes once it has been delivered and settled.
        </p>
      </CardBody>
    </Card>
  )
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'success' | 'danger'
}) {
  return (
    <Card className="p-4">
      <p className="text-fg-muted text-sm">{label}</p>
      <p
        className={cn(
          'mt-1 text-xl font-semibold tracking-tight',
          tone === 'success' && 'text-success',
          tone === 'danger' && 'text-danger',
        )}
      >
        {value}
      </p>
    </Card>
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
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <span className="text-fg-muted shrink-0">{label}</span>
      <span
        className={cn(
          'text-right font-medium',
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

function DetailSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-40" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
      <Skeleton className="h-96 w-full" />
    </div>
  )
}
