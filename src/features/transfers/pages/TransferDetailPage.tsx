import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft, ArrowRight, Check, Truck } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState'
import { ProductThumb } from '@/shared/components/ProductThumb'
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { toast } from '@/shared/ui/toast'
import { useSession } from '@/app/providers/SessionProvider'
import { paths } from '@/shared/config/paths'
import { formatDateTime, formatMoney, formatNumber } from '@/shared/lib/format'
import { useDataStore } from '@/data/store'
import { USD_RATE } from '@/data/seed'
import { useSetTransferStatus, useTransfer } from '../api/transfers'
import { TransferQuantityDialog } from '../components/TransferQuantityDialog'
import {
  canCancel,
  lineInTransit,
  lineShortfall,
  lineUnfulfilled,
  nextStep,
  transferCostValue,
  transferInTransit,
  transferQuantity,
  transferSaleValue,
  transferShortfall,
  transferStatusLabel,
  transferStatusTone,
} from '../model/transfer'

export default function TransferDetailPage() {
  const navigate = useNavigate()
  const { transferId } = useParams()
  const { can } = useSession()
  const { data: transfer } = useTransfer(transferId ?? '')
  const setStatus = useSetTransferStatus(transferId ?? '')
  const variations = useDataStore((s) => s.variations)
  const [confirmCancel, setConfirmCancel] = useState(false)
  // Both hand-offs ask what actually moved rather than assuming the paperwork.
  const [quantityStep, setQuantityStep] = useState<'send' | 'receive' | null>(null)

  if (!transfer) {
    return <EmptyState title="Transfer not found" description="It may have been deleted." />
  }

  const step = nextStep(transfer.status)
  const advance = (quantities: Record<string, number>) => {
    if (!step) return
    setStatus.mutate(
      { to: step.to, quantities },
      {
        onSuccess: () => {
          setQuantityStep(null)
          toast.success(
            step.to === 'in_transit'
              ? `${transfer.number} sent — stock has left ${transfer.fromLocationName}`
              : `${transfer.number} received into ${transfer.toLocationName}`,
          )
        },
        // The stock check happens at dispatch, so this is where a shortfall
        // surfaces. It has to say which product, or it is not actionable.
        onError: (message) => toast.error(message),
      },
    )
  }

  /** What the source shelf holds right now, for the shortfall warning. */
  const availableAtSource = (variationId: string) =>
    variations
      .find((v) => v.id === variationId)
      ?.stockByLocation.find((row) => row.locationId === transfer.fromLocationId)?.quantity ?? 0

  const timeline = [
    { label: 'Created', at: transfer.createdAt, by: transfer.createdBy },
    { label: `Sent from ${transfer.fromLocationName}`, at: transfer.sentAt, by: transfer.sentBy },
    {
      label: `Received at ${transfer.toLocationName}`,
      at: transfer.receivedAt,
      by: transfer.receivedBy,
    },
  ]

  return (
    <>
      <Button variant="link" size="sm" className="h-auto px-0" asChild>
        <Link to={paths.products.transfers}>
          <ArrowLeft />
          Transfers
        </Link>
      </Button>

      <PageHeader
        title={transfer.number}
        description={`${formatNumber(transfer.lines.length)} items · ${formatNumber(
          transferQuantity(transfer),
        )} units`}
        action={
          <div className="flex items-center gap-2">
            {canCancel(transfer.status) && can('products.transfers.delete') ? (
              <Button variant="secondary" onClick={() => setConfirmCancel(true)}>
                Cancel transfer
              </Button>
            ) : null}
            {step && can('products.transfers.edit') ? (
              <Button
                variant="primary"
                onClick={() => setQuantityStep(step.to === 'in_transit' ? 'send' : 'receive')}
              >
                {step.to === 'in_transit' ? <Truck /> : <Check />}
                {step.label}
              </Button>
            ) : null}
          </div>
        }
        below={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={transferStatusTone(transfer.status)}>
              {transferStatusLabel(transfer.status)}
            </Badge>
            <span className="text-fg-muted flex items-center gap-1.5 text-sm">
              {transfer.fromLocationName}
              <ArrowRight className="text-fg-subtle size-3.5" />
              <span className="text-fg font-medium">{transfer.toLocationName}</span>
            </span>
            {transfer.comment ? (
              <span className="text-fg-subtle text-sm">· {transfer.comment}</span>
            ) : null}
          </div>
        }
      />

      {transfer.status === 'in_transit' ? (
        <Card className="border-warning-border bg-warning-subtle">
          <CardBody className="flex items-start gap-3 p-4">
            <Truck className="text-warning mt-0.5 size-4 shrink-0" />
            <p className="text-fg-muted text-sm">
              {transferInTransit(transfer) === 1
                ? 'This unit has'
                : `These ${formatNumber(transferInTransit(transfer))} units have`}{' '}
              left {transfer.fromLocationName} and{' '}
              {transferInTransit(transfer) === 1 ? 'is' : 'are'} not yet counted at{' '}
              {transfer.toLocationName}. It will not appear in either location's stock until receipt
              is confirmed.
            </p>
          </CardBody>
        </Card>
      ) : null}

      {transferShortfall(transfer) > 0 ? (
        <Card className="border-danger-border bg-danger-subtle">
          <CardBody className="flex items-start gap-3 p-4">
            <Check className="text-danger mt-0.5 size-4 shrink-0" />
            <p className="text-fg-muted text-sm">
              {formatNumber(transferShortfall(transfer))} units left {transfer.fromLocationName} and
              never arrived at {transfer.toLocationName}. They are on neither shelf and have been
              written off against this transfer.
            </p>
          </CardBody>
        </Card>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Items</CardTitle>
            {/* What is riding on the truck, in money. Cost is permission-gated
                exactly as it is in the catalogue. */}
            <div className="text-2xs flex items-center gap-3">
              {can('products.cost.view') ? (
                <span className="text-fg-muted">
                  At cost{' '}
                  <span className="text-fg font-medium">
                    {formatMoney(transferCostValue(transfer, USD_RATE))}
                  </span>
                </span>
              ) : null}
              <span className="text-fg-muted">
                At sale{' '}
                <span className="text-fg font-medium">
                  {formatMoney(transferSaleValue(transfer))}
                </span>
              </span>
            </div>
          </CardHeader>
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-canvas">
                  <tr className="text-fg-muted text-2xs tracking-wide uppercase">
                    <th className="px-4 py-2 text-left font-semibold">Product</th>
                    <th className="px-4 py-2 text-right font-semibold">Ordered</th>
                    {transfer.status === 'draft' ? (
                      <th className="px-4 py-2 text-right font-semibold">At source</th>
                    ) : (
                      <th className="px-4 py-2 text-right font-semibold">Sent</th>
                    )}
                    {transfer.receivedAt ? (
                      <th className="px-4 py-2 text-right font-semibold">Received</th>
                    ) : null}
                    {transfer.status === 'in_transit' ? (
                      <th className="px-4 py-2 text-right font-semibold">In transit</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {transfer.lines.map((line) => {
                    const available = availableAtSource(line.variationId)
                    const cannotFill =
                      transfer.status === 'draft' && available < line.requestedQuantity
                    const unfulfilled = lineUnfulfilled(line)
                    const missing = lineShortfall(line)
                    return (
                      <tr key={line.id} className="border-border border-t">
                        <td className="px-4 py-2">
                          <Link
                            to={paths.products.detail(line.productId)}
                            className="flex items-center gap-2.5 hover:underline"
                          >
                            <ProductThumb src={line.imageUrl} size="sm" />
                            <div className="min-w-0">
                              <p className="font-medium">{line.name}</p>
                              <p className="text-fg-subtle text-2xs font-mono">{line.sku}</p>
                            </div>
                          </Link>
                        </td>
                        <td className="text-fg-muted px-4 py-2 text-right tabular-nums">
                          {formatNumber(line.requestedQuantity)} {line.unit}
                        </td>
                        {transfer.status === 'draft' ? (
                          <td
                            className={`px-4 py-2 text-right tabular-nums ${
                              cannotFill ? 'text-danger font-medium' : 'text-fg-muted'
                            }`}
                          >
                            {formatNumber(available)}
                            {cannotFill ? ' — not enough' : ''}
                          </td>
                        ) : (
                          <td className="text-fg px-4 py-2 text-right font-medium tabular-nums">
                            {formatNumber(line.sentQuantity ?? 0)}
                            {/* What the warehouse could not find stayed put. */}
                            {unfulfilled > 0 ? (
                              <span className="text-fg-subtle text-2xs ml-1">
                                (−{formatNumber(unfulfilled)} not found)
                              </span>
                            ) : null}
                          </td>
                        )}
                        {transfer.receivedAt ? (
                          <td
                            className={`px-4 py-2 text-right font-medium tabular-nums ${
                              missing > 0 ? 'text-danger' : 'text-fg'
                            }`}
                          >
                            {formatNumber(line.receivedQuantity ?? 0)}
                            {missing > 0 ? (
                              <span className="text-2xs ml-1">(−{formatNumber(missing)} lost)</span>
                            ) : null}
                          </td>
                        ) : null}
                        {transfer.status === 'in_transit' ? (
                          <td className="text-warning px-4 py-2 text-right font-medium tabular-nums">
                            {formatNumber(lineInTransit(line))}
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
            <CardTitle>History</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            {timeline.map((entry) => (
              <div key={entry.label} className="flex items-start gap-3">
                <span
                  className={`mt-1.5 size-2 shrink-0 rounded-full ${
                    entry.at ? 'bg-success' : 'bg-border-strong'
                  }`}
                />
                <div className="min-w-0">
                  <p className={entry.at ? 'text-fg text-sm' : 'text-fg-subtle text-sm'}>
                    {entry.label}
                  </p>
                  <p className="text-fg-subtle text-2xs">
                    {entry.at ? formatDateTime(entry.at) : 'Not yet'}
                    {entry.by ? ` · ${entry.by}` : ''}
                  </p>
                </div>
              </div>
            ))}
            {transfer.status === 'cancelled' ? (
              <div className="flex items-start gap-3">
                <span className="bg-danger mt-1.5 size-2 shrink-0 rounded-full" />
                <div>
                  <p className="text-fg text-sm">Cancelled</p>
                  <p className="text-fg-subtle text-2xs">{formatDateTime(transfer.updatedAt)}</p>
                </div>
              </div>
            ) : null}
          </CardBody>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="Cancel this transfer?"
        confirmLabel="Cancel transfer"
        body={
          transfer.status === 'in_transit'
            ? `${transfer.number} has already been sent, so its ${formatNumber(
                transferQuantity(transfer),
              )} units go back to ${transfer.fromLocationName}.`
            : `${transfer.number} has not been sent, so no stock changes.`
        }
        onConfirm={() =>
          setStatus.mutate(
            { to: 'cancelled' },
            {
              onSuccess: () => {
                toast.success(`${transfer.number} cancelled`)
                setConfirmCancel(false)
                navigate(paths.products.transfers)
              },
              onError: (message) => toast.error(message),
            },
          )
        }
      />

      {step ? (
        <TransferQuantityDialog
          open={quantityStep !== null}
          onOpenChange={(open) => setQuantityStep(open ? quantityStep : null)}
          transfer={transfer}
          mode={quantityStep ?? 'send'}
          availableAtSource={availableAtSource}
          onConfirm={advance}
        />
      ) : null}
    </>
  )
}
