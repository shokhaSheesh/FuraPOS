import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft, Ban, PackageCheck } from 'lucide-react'
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
import { formatDateTime, formatMoney, formatNumber, formatPercent } from '@/shared/lib/format'
import { USD_RATE } from '@/data/seed'
import { useReceipt, useSetReceiptStatus } from '../api/receipts'
import { ReceiveGoodsDialog } from '../components/ReceiveGoodsDialog'
import {
  canCancel,
  extraCostsTotal,
  landedTotal,
  landedUnitCost,
  landedUplift,
  nextStep,
  receiptShortfall,
  receiptStatusLabel,
  receiptStatusTone,
  supplierTotal,
  toUzs,
} from '../model/receipt'

export default function GoodsReceiptDetailPage() {
  const navigate = useNavigate()
  const { receiptId } = useParams()
  const { can } = useSession()
  const { data: receipt } = useReceipt(receiptId ?? '')
  const setStatus = useSetReceiptStatus(receiptId ?? '')
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [receiving, setReceiving] = useState(false)

  if (!receipt) {
    return <EmptyState title="Receipt not found" description="It may have been deleted." />
  }

  const canSeeCost = can('products.cost.view')
  const step = nextStep(receipt.status)
  const goods = supplierTotal(receipt, USD_RATE)
  const extras = extraCostsTotal(receipt, USD_RATE)
  const short = receiptShortfall(receipt)

  const post = (quantities: Record<string, number>) =>
    setStatus.mutate(
      { to: 'received', quantities },
      {
        onSuccess: () => {
          setReceiving(false)
          toast.success(`${receipt.number} posted into ${receipt.locationName}`)
        },
        onError: (message) => toast.error(message),
      },
    )

  return (
    <>
      <Button variant="link" size="sm" className="h-auto px-0" asChild>
        <Link to={paths.products.goodsReceipt}>
          <ArrowLeft />
          Goods receipt
        </Link>
      </Button>

      <PageHeader
        title={receipt.number}
        description={`${formatNumber(receipt.lines.length)} items from ${
          receipt.supplierName ?? 'an unnamed supplier'
        }`}
        action={
          <div className="flex items-center gap-2">
            {canCancel(receipt.status) && can('products.goodsReceipt.delete') ? (
              <Button variant="secondary" onClick={() => setConfirmCancel(true)}>
                <Ban />
                Cancel
              </Button>
            ) : null}
            {step && can('products.goodsReceipt.edit') ? (
              <Button variant="primary" onClick={() => setReceiving(true)}>
                <PackageCheck />
                {step.label}
              </Button>
            ) : null}
          </div>
        }
        below={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={receiptStatusTone(receipt.status)}>
              {receiptStatusLabel(receipt.status)}
            </Badge>
            <span className="text-fg-muted text-sm">
              Into <span className="text-fg font-medium">{receipt.locationName}</span>
            </span>
            {receipt.invoiceNumber ? (
              <span className="text-fg-subtle text-2xs font-mono">
                Invoice {receipt.invoiceNumber}
              </span>
            ) : null}
            {receipt.comment ? (
              <span className="text-fg-subtle text-sm">· {receipt.comment}</span>
            ) : null}
          </div>
        }
      />

      {short > 0 ? (
        <Card className="border-warning-border bg-warning-subtle">
          <CardBody className="flex items-start gap-3 p-4">
            <PackageCheck className="text-warning mt-0.5 size-4 shrink-0" />
            <p className="text-fg-muted text-sm">
              {formatNumber(short)} {short === 1 ? 'unit was' : 'units were'} invoiced but never
              arrived. That is a claim against {receipt.supplierName ?? 'the supplier'}, not stock
              that went missing — nothing was added for it, and the landed cost is spread over what
              actually turned up.
            </p>
          </CardBody>
        </Card>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Items</CardTitle>
            {canSeeCost && extras > 0 ? (
              <span className="text-fg-subtle text-2xs">
                Landed cost is the supplier&rsquo;s price plus this line&rsquo;s share of freight
                and duty — what the part really cost, not what the invoice said
              </span>
            ) : null}
          </CardHeader>
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-canvas">
                  <tr className="text-fg-muted text-2xs tracking-wide uppercase">
                    <th className="px-4 py-2 text-left font-semibold">Product</th>
                    <th className="px-4 py-2 text-right font-semibold">Invoiced</th>
                    {receipt.receivedAt ? (
                      <th className="px-4 py-2 text-right font-semibold">Received</th>
                    ) : null}
                    {canSeeCost ? (
                      <>
                        <th className="px-4 py-2 text-right font-semibold">Supplier price</th>
                        <th className="px-4 py-2 text-right font-semibold">Landed cost</th>
                      </>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {receipt.lines.map((line) => {
                    const missing =
                      line.receivedQuantity === null
                        ? 0
                        : Math.max(0, line.orderedQuantity - line.receivedQuantity)
                    const landed = landedUnitCost(line, receipt, USD_RATE)
                    const supplierUnit = toUzs(line.unitCost, line.costCurrency, USD_RATE)
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
                          {formatNumber(line.orderedQuantity)} {line.unit}
                        </td>
                        {receipt.receivedAt ? (
                          <td
                            className={`px-4 py-2 text-right font-medium tabular-nums ${
                              missing > 0 ? 'text-warning' : 'text-fg'
                            }`}
                          >
                            {formatNumber(line.receivedQuantity ?? 0)}
                            {missing > 0 ? (
                              <span className="text-2xs ml-1">(−{formatNumber(missing)})</span>
                            ) : null}
                          </td>
                        ) : null}
                        {canSeeCost ? (
                          <>
                            <td className="text-fg-muted px-4 py-2 text-right tabular-nums">
                              {line.costCurrency === 'USD'
                                ? `${formatNumber(line.unitCost)} USD`
                                : formatMoney(line.unitCost)}
                            </td>
                            <td className="text-fg px-4 py-2 text-right font-medium tabular-nums">
                              {formatMoney(Math.round(landed))}
                              {landed > supplierUnit ? (
                                <span className="text-fg-subtle text-2xs ml-1">
                                  +{formatPercent((landed - supplierUnit) / supplierUnit)}
                                </span>
                              ) : null}
                            </td>
                          </>
                        ) : null}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>

        <div className="space-y-3">
          {canSeeCost ? (
            <Card>
              <CardHeader>
                <CardTitle>What it cost</CardTitle>
              </CardHeader>
              <CardBody className="space-y-2 text-sm">
                <p className="text-fg-subtle text-2xs">What was paid for this delivery, all in.</p>
                <Row label="Supplier total" value={formatMoney(goods)} />
                {receipt.additionalCosts.map((cost) => (
                  <Row
                    key={cost.id}
                    label={cost.label}
                    value={formatMoney(toUzs(cost.amount, cost.currency, USD_RATE))}
                    muted
                  />
                ))}
                {extras > 0 ? (
                  <Row label="Freight & duty" value={formatMoney(extras)} />
                ) : (
                  <p className="text-fg-subtle text-2xs">
                    No freight or duty recorded, so landed cost equals the supplier&rsquo;s price.
                  </p>
                )}
                <div className="border-border mt-2 border-t pt-2">
                  <Row
                    label="Landed total"
                    value={formatMoney(landedTotal(receipt, USD_RATE))}
                    bold
                  />
                  {extras > 0 ? (
                    <p className="text-fg-subtle text-2xs mt-1">
                      {formatPercent(landedUplift(receipt, USD_RATE))} on top of the invoice
                    </p>
                  ) : null}
                </div>
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Record</CardTitle>
            </CardHeader>
            <CardBody className="space-y-2 text-sm">
              <Row label="Supplier" value={receipt.supplierName ?? '—'} />
              <Row label="Landed at" value={receipt.locationName} />
              <Row label="Created by" value={receipt.createdBy} />
              <Row label="Created" value={formatDateTime(receipt.createdAt)} />
              {receipt.receivedAt ? (
                <>
                  <Row label="Received by" value={receipt.receivedBy ?? '—'} />
                  <Row label="Received" value={formatDateTime(receipt.receivedAt)} />
                </>
              ) : null}
            </CardBody>
          </Card>
        </div>
      </div>

      <ReceiveGoodsDialog
        open={receiving}
        onOpenChange={setReceiving}
        receipt={receipt}
        onConfirm={post}
      />

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="Cancel this receipt?"
        confirmLabel="Cancel receipt"
        body={
          receipt.status === 'received'
            ? `${receipt.number} has been posted, so its stock is taken back off ${receipt.locationName}. If any of it has already been sold or moved, cancel will be refused — correct it instead.`
            : `${receipt.number} has not been posted, so no stock changes.`
        }
        onConfirm={() =>
          setStatus.mutate(
            { to: 'cancelled' },
            {
              onSuccess: () => {
                toast.success(`${receipt.number} cancelled`)
                setConfirmCancel(false)
                navigate(paths.products.goodsReceipt)
              },
              onError: (message) => toast.error(message),
            },
          )
        }
      />
    </>
  )
}

function Row({
  label,
  value,
  bold,
  muted,
}: {
  label: string
  value: string
  bold?: boolean
  muted?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className={muted ? 'text-fg-subtle text-2xs pl-3' : 'text-fg-muted'}>{label}</span>
      <span
        className={
          muted
            ? 'text-fg-subtle text-2xs tabular-nums'
            : `text-fg text-right tabular-nums ${bold ? 'font-semibold' : 'font-medium'}`
        }
      >
        {value}
      </span>
    </div>
  )
}
