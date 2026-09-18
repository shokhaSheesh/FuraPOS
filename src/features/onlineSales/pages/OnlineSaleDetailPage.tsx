import { Link, useParams } from 'react-router'
import { ArrowLeft, Globe, PackageMinus } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState'
import { ProductThumb } from '@/shared/components/ProductThumb'
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { cn } from '@/shared/lib/cn'
import { paths } from '@/shared/config/paths'
import { formatDateTime, formatMoney, formatNumber } from '@/shared/lib/format'
import { useOnlineSale } from '../api/onlineSales'
import {
  DELIVERY_LABEL,
  PAYMENT_STATUS_META,
  PROVIDER_LABEL,
  amountPaid,
  onlineStatusMeta,
  orderTotal,
  payable,
  productsTotal,
  takesStock,
  unitsOf,
  type PaymentTransaction,
} from '../model/onlineSale'
import { t } from '@/shared/i18n'

const TRANSACTION_TONE: Record<
  PaymentTransaction['status'],
  'success' | 'warning' | 'danger' | 'neutral'
> = { success: 'success', pending: 'warning', failed: 'danger', refunded: 'neutral' }

/**
 * One order from the e-commerce app, read-only.
 *
 * The superadmin's screen with the running-the-app parts taken out: no status
 * control, no employee assignment, no cancel, no "add item", no raw gateway
 * metadata, and no empty "seller" and "scheduled at" fields. What is left is
 * what someone in the back office actually asks about an online order — who,
 * what, how it is getting there, what was paid, and what it took off the shelf.
 */
export default function OnlineSaleDetailPage() {
  const { onlineSaleId } = useParams()
  const { data: sale } = useOnlineSale(onlineSaleId ?? '')

  if (!sale) {
    return (
      <EmptyState
        title={t('Online order not found')}
        description={t('It may have been removed.')}
      />
    )
  }

  const status = onlineStatusMeta(sale.status)
  const payment = PAYMENT_STATUS_META[sale.paymentStatus]
  const units = unitsOf(sale)
  const total = orderTotal(sale)
  const paid = amountPaid(sale)

  return (
    <>
      <Button variant="link" size="sm" className="h-auto px-0" asChild>
        <Link to={paths.sales.online}>
          <ArrowLeft />
          {t('Online sales')}
        </Link>
      </Button>

      <PageHeader
        title={t('Order {number}', { number: sale.number })}
        description={t('Placed in the e-commerce app on {p0} by {customerName}', {
          p0: formatDateTime(sale.createdAt),
          customerName: sale.customerName,
        })}
        below={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={status.tone}>{status.label}</Badge>
            <Badge tone={payment.tone}>{payment.label}</Badge>
            <Badge tone="neutral">{formatNumber(units)} pcs</Badge>
            {sale.express ? <Badge tone="warning">{t('Express')}</Badge> : null}
            <span className="text-fg-subtle text-2xs flex items-center gap-1">
              <Globe className="size-3.5" />
              {t('View only — managed in the e-commerce app')}
            </span>
          </div>
        }
      />

      {/* What it did to stock — the reason this order is in the back office at all. */}
      <Card className="flex items-start gap-3 p-4">
        <span className="bg-surface-inset text-fg-muted mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full">
          <PackageMinus className="size-4" />
        </span>
        <div className="min-w-0 flex-1 text-sm">
          {takesStock(sale) ? (
            <p className="text-fg">
              {t('Took')} <span className="font-semibold">{formatNumber(units)} pcs</span> from{' '}
              <span className="font-semibold">{sale.locationName}</span> {t('when it was placed.')}
            </p>
          ) : (
            <p className="text-fg">
              {sale.status === 'returned' ? t('Returned') : t('Cancelled')} {t('— the')}{' '}
              <span className="font-semibold">{formatNumber(units)} pcs</span> {t('went back to')}{' '}
              {sale.locationName}.
            </p>
          )}
          <p className="text-fg-subtle text-2xs">
            {t(
              'Every line shows up in Product logs as an online sale, next to counter sales and transfers.',
            )}
          </p>
        </div>
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('Order')}</CardTitle>
          </CardHeader>
          <CardBody className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <Info label={t('Created')} value={formatDateTime(sale.createdAt)} />
            <Info label={t('Updated')} value={formatDateTime(sale.updatedAt)} />
            <Info label={t('Picked from')} value={sale.locationName} />
            <Info
              label={t('Prepared by')}
              value={sale.employeeName ?? 'Not assigned yet'}
              muted={!sale.employeeName}
            />
            <Info label={t('Payment method')} value={PROVIDER_LABEL[sale.paymentProvider]} />
            <Info label={t('Payment')} value={payment.label} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('Customer & delivery')}</CardTitle>
          </CardHeader>
          <CardBody className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <Info
              label={t('Customer')}
              value={sale.customerName}
              href={sale.driverId ? paths.users.driverDetail(sale.driverId) : undefined}
            />
            <Info label={t('Phone')} value={sale.customerPhone} />
            <Info
              label={t('Delivery')}
              value={`${DELIVERY_LABEL[sale.deliveryMethod]}${sale.express ? ' · express' : ''}`}
            />
            {sale.deliveryMethod === 'pickup' ? (
              <Info label={t('Collect from')} value={sale.locationName} />
            ) : sale.pickupPoint ? (
              <Info label={t('EMU pickup point')} value={sale.pickupPoint} />
            ) : (
              <Info
                label={t('Address')}
                value={sale.customerAddress ?? '—'}
                muted={!sale.customerAddress}
              />
            )}
            <Info
              label={t('Estimated delivery')}
              value={sale.estimatedDeliveryAt ? formatDateTime(sale.estimatedDeliveryAt) : '—'}
              muted={!sale.estimatedDeliveryAt}
            />
            <Info
              label={sale.deliveryMethod === 'pickup' ? t('Collected') : t('Delivered')}
              value={sale.deliveredAt ? formatDateTime(sale.deliveredAt) : 'Not yet'}
              muted={!sale.deliveredAt}
            />
            {sale.courierOrderId ? (
              <>
                <Info label={t('EMU status')} value={sale.courierStatus ?? '—'} />
                <Info label={t('EMU order ID')} value={sale.courierOrderId} mono />
              </>
            ) : null}
            {sale.customerNote ? (
              <div className="sm:col-span-2">
                <Info label={t('Customer note')} value={sale.customerNote} />
              </div>
            ) : null}
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t('Products')}</CardTitle>
          </CardHeader>
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-canvas">
                  <tr className="text-fg-muted text-2xs tracking-wide uppercase">
                    <th className="px-4 py-2 text-left font-semibold">{t('Product')}</th>
                    <th className="px-4 py-2 text-right font-semibold">{t('Price')}</th>
                    <th className="px-4 py-2 text-right font-semibold">{t('Quantity')}</th>
                    <th className="px-4 py-2 text-right font-semibold">{t('Subtotal')}</th>
                  </tr>
                </thead>
                <tbody>
                  {sale.lines.map((line) => (
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
                        {formatMoney(line.unitPrice)}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {formatNumber(line.quantity)}
                      </td>
                      <td className="text-fg px-4 py-2 text-right font-medium tabular-nums">
                        {formatMoney(line.quantity * line.unitPrice)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('Summary')}</CardTitle>
          </CardHeader>
          <CardBody className="space-y-2">
            <Money label={t('Products')} value={formatMoney(productsTotal(sale))} />
            <Money label={t('Delivery')} value={formatMoney(sale.deliveryFee)} />
            <Money
              label={t('Discount')}
              value={sale.discount ? `−${formatMoney(sale.discount)}` : formatMoney(0)}
              tone={sale.discount ? 'success' : undefined}
            />
            <div className="border-border border-t pt-2">
              <Money label={t('Order total')} value={formatMoney(total)} strong />
            </div>
            <Money
              label={t('Paid with cashback')}
              value={sale.cashbackUsed ? `−${formatMoney(sale.cashbackUsed)}` : formatMoney(0)}
              tone={sale.cashbackUsed ? 'success' : undefined}
            />
            <Money label={t('To pay in money')} value={formatMoney(payable(sale))} />
            <div className="border-border border-t pt-2">
              <Money label={t('Paid')} value={formatMoney(paid)} strong />
              {payable(sale) - paid > 0 && takesStock(sale) ? (
                <p className="text-warning text-2xs mt-1 text-right">
                  {formatMoney(payable(sale) - paid)} {t('still to be collected')}
                </p>
              ) : null}
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('Payment transactions')}</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {sale.transactions.length === 0 ? (
            <p className="text-fg-subtle p-4 text-sm">
              {sale.paymentProvider === 'cash'
                ? t('Cash on delivery — nothing is recorded until the courier collects it.')
                : payable(sale) === 0
                  ? t('Paid entirely with cashback, so no money changed hands.')
                  : t('No payment has come through yet.')}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-canvas">
                  <tr className="text-fg-muted text-2xs tracking-wide uppercase">
                    <th className="px-4 py-2 text-left font-semibold">{t('Payment')}</th>
                    <th className="px-4 py-2 text-left font-semibold">{t('Status')}</th>
                    <th className="px-4 py-2 text-left font-semibold">{t('When')}</th>
                    <th className="px-4 py-2 text-right font-semibold">{t('Amount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {sale.transactions.map((transaction) => (
                    <tr key={transaction.id} className="border-border border-t">
                      <td className="px-4 py-2">
                        <p className="text-fg font-medium">
                          {PROVIDER_LABEL[transaction.provider]}
                        </p>
                        <p className="text-fg-subtle text-2xs font-mono">{transaction.reference}</p>
                      </td>
                      <td className="px-4 py-2">
                        <Badge tone={TRANSACTION_TONE[transaction.status]}>
                          {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
                        </Badge>
                      </td>
                      <td className="text-fg-muted px-4 py-2">
                        {formatDateTime(transaction.createdAt)}
                      </td>
                      <td
                        className={cn(
                          'px-4 py-2 text-right font-medium tabular-nums',
                          transaction.status === 'refunded' ? 'text-fg-muted' : 'text-fg',
                        )}
                      >
                        {transaction.status === 'refunded' ? '−' : ''}
                        {formatMoney(transaction.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </>
  )
}

function Info({
  label,
  value,
  muted,
  mono,
  href,
}: {
  label: string
  value: string
  muted?: boolean
  mono?: boolean
  href?: string
}) {
  const text = (
    <span
      className={cn(
        'text-sm',
        muted ? 'text-fg-subtle' : 'text-fg font-medium',
        mono && 'text-2xs font-mono break-all',
      )}
    >
      {value}
    </span>
  )
  return (
    <div className="min-w-0">
      <p className="text-fg-muted text-2xs">{label}</p>
      {href ? (
        <Link to={href} className="hover:underline">
          {text}
        </Link>
      ) : (
        text
      )}
    </div>
  )
}

function Money({
  label,
  value,
  strong,
  tone,
}: {
  label: string
  value: string
  strong?: boolean
  tone?: 'success'
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <span className={strong ? 'text-fg font-semibold' : 'text-fg-muted'}>{label}</span>
      <span
        className={cn(
          'text-right tabular-nums',
          strong ? 'text-fg font-semibold' : 'text-fg',
          tone === 'success' && 'text-success',
        )}
      >
        {value}
      </span>
    </div>
  )
}
