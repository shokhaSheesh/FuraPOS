import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft, HandCoins, RotateCcw, Trash2 } from 'lucide-react'
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
import { useDataStore } from '@/data/store'
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
import { t } from '@/shared/i18n'

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
          title={t('Sale not found')}
          description={t('It may have been removed, or the link is wrong.')}
          action={
            <Button variant="secondary" asChild>
              <Link to={paths.sales.orders}>{t('Back to all sales')}</Link>
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
      },
    )
  }

  return (
    <>
      <Button variant="link" size="sm" className="h-auto px-0" asChild>
        <Link to={paths.sales.orders}>
          <ArrowLeft />
          {t('All sales')}
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
                    {
                      onSuccess: () =>
                        toast.success(t('{number} restored', { number: sale.number })),
                    },
                  )
                }
              >
                <RotateCcw />
                {t('Restore')}
              </Button>
            ) : (
              <Button
                variant="ghost"
                aria-label={t('Delete sale')}
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 />
                {t('Delete')}
              </Button>
            )}
            {sale.debt > 0 && sale.status !== 'deleted' ? (
              <Button variant="secondary" onClick={() => setPayOpen(true)}>
                <HandCoins />
                {t('Record payment')}
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
            <Badge tone={status?.tone ?? 'neutral'}>{t(status?.label ?? sale.status)}</Badge>
            <Badge>{t(SALE_CHANNELS.find((c) => c.value === sale.channel)?.label ?? '')}</Badge>
            {sale.expiresAt ? (
              <Badge tone="warning">
                {t('Expires')} {formatDate(sale.expiresAt)}
              </Badge>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label={t('Total')} value={formatMoney(sale.total)} />
        <Metric
          label={t('Paid')}
          value={formatMoney(sale.paid)}
          tone={sale.paid > 0 ? 'success' : undefined}
        />
        <Metric
          label={t('Debt')}
          value={sale.debt > 0 ? formatMoney(sale.debt) : '—'}
          tone={sale.debt > 0 ? 'danger' : undefined}
        />
        <Metric
          label={t('Items')}
          value={t('{units} in {lines} lines', {
            units: formatNumber(units),
            lines: sale.lines.length,
          })}
        />
      </div>

      <Tabs
        items={[
          { value: 'overview', label: t('Overview'), content: <Overview sale={sale} /> },
          {
            value: 'activity',
            label: t('Activity'),
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
        title={t('Delete this sale?')}
        body={
          <>
            <strong className="text-fg font-medium">{sale.number}</strong>{' '}
            {t('moves to Deleted sales. It stays in the ledger for audit and can be restored.')}
          </>
        }
        submitting={update.isPending}
        onConfirm={() =>
          update.mutate(
            { status: 'deleted' },
            {
              onSuccess: () => {
                toast.success(t('{number} deleted', { number: sale.number }))
                setDeleteOpen(false)
              },
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
                toast.success(
                  t('{p0} recorded against {number}', {
                    p0: formatMoney(amount),
                    number: sale.number,
                  }),
                )
                setPayOpen(false)
              },
            },
          )
        }
      />
    </>
  )
}

function Overview({ sale }: { sale: Sale }) {
  const promotions = useDataStore((state) => state.promotions)
  const promotion = promotions.find((entry) => entry.id === sale.promotionId) ?? null

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>{t('Items')}</CardTitle>
        </CardHeader>
        <div className="scroll-x-quiet overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted">
              <tr className="text-fg-muted text-2xs tracking-wide uppercase">
                <th scope="col" className="h-9 px-3 text-left font-semibold">
                  {t('Product')}
                </th>
                <th scope="col" className="h-9 px-3 text-left font-semibold">
                  {t('Brand')}
                </th>
                <th scope="col" className="h-9 px-3 text-left font-semibold">
                  {t('Category')}
                </th>
                <th scope="col" className="h-9 px-3 text-right font-semibold">
                  {t('Qty')}
                </th>
                <th scope="col" className="h-9 px-3 text-right font-semibold">
                  {t('Price')}
                </th>
                <th scope="col" className="h-9 px-3 text-right font-semibold">
                  {t('Disc')}
                </th>
                <th scope="col" className="h-9 px-3 text-right font-semibold">
                  {t('Total')}
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
                    {formatNumber(line.quantity)} {t(line.unit)}
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
          <Row label={t('Subtotal')} value={formatMoney(sale.subtotal)} />
          {sale.discount > 0 ? (
            <Row label={t('Discount')} value={`− ${formatMoney(sale.discount)}`} tone="warning" />
          ) : null}
          <div className="border-border flex items-baseline justify-between border-t pt-2">
            <span className="text-fg text-sm font-medium">{t('Total')}</span>
            <span className="text-fg text-lg font-semibold">{formatMoney(sale.total)}</span>
          </div>
          <Row label={t('Paid')} value={formatMoney(sale.paid)} tone="success" />
          {sale.debt > 0 ? (
            <Row label={t('Debt')} value={formatMoney(sale.debt)} tone="danger" />
          ) : null}
        </CardBody>
      </Card>

      <div className="space-y-3">
        <Card>
          <CardHeader>
            <CardTitle>{t('Customer')}</CardTitle>
          </CardHeader>
          <CardBody>
            {sale.clientId ? (
              <Button variant="link" size="sm" className="h-auto px-0" asChild>
                <Link to={paths.users.autoparkDetail(sale.clientId)}>{sale.clientName}</Link>
              </Button>
            ) : (
              <p className="text-fg-muted text-sm">{t('Walk-in customer')}</p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('Details')}</CardTitle>
          </CardHeader>
          <CardBody className="space-y-2">
            <Row label={t('Location')} value={sale.locationName} />
            <Row label={t('Seller')} value={sale.sellerName} />
            {/* Only shown when there is one: most counter sales have no
                driver, and an empty row would just be noise. */}
            {sale.driverName ? <Row label={t('Collected by')} value={sale.driverName} /> : null}
            {sale.truckPlate ? <Row label={t('Truck')} value={sale.truckPlate} /> : null}
            {promotion ? (
              // Answers "why is this discounted" without anybody having to
              // work backwards from a percentage.
              <Row label={t('Promotion')} value={promotion.name} />
            ) : null}
            <Row
              label={t('Source')}
              value={t(SALE_CHANNELS.find((c) => c.value === sale.channel)?.label ?? '—')}
            />
            <Row
              label={t('Payment')}
              value={t(PAYMENT_METHODS.find((m) => m.value === sale.paymentMethod)?.label ?? '—')}
            />
            <Row label={t('Created')} value={formatDateTime(sale.createdAt)} />
            <Row label={t('Updated')} value={formatDateTime(sale.updatedAt)} />
            <Row
              label={t('Finished')}
              value={sale.finishedAt ? formatDateTime(sale.finishedAt) : '—'}
            />
            {sale.comment ? <Row label={t('Comment')} value={sale.comment} /> : null}
          </CardBody>
        </Card>
      </div>
    </div>
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
