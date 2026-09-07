import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft, Undo2 } from 'lucide-react'
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
import { USD_RATE } from '@/data/seed'
import { useCancelCorrection, useCorrection } from '../api/corrections'
import {
  correctionReasonLabel,
  correctionStatusLabel,
  correctionStatusTone,
  lineDelta,
  netCostValue,
  netUnits,
} from '../model/correction'

export default function CorrectionDetailPage() {
  const navigate = useNavigate()
  const { correctionId } = useParams()
  const { can } = useSession()
  const { data: correction } = useCorrection(correctionId ?? '')
  const cancel = useCancelCorrection(correctionId ?? '')
  const [confirmCancel, setConfirmCancel] = useState(false)

  if (!correction) {
    return <EmptyState title="Correction not found" description="It may have been deleted." />
  }

  const net = netUnits(correction)
  const value = netCostValue(correction, USD_RATE)
  const canSeeCost = can('products.cost.view')

  return (
    <>
      <Button variant="link" size="sm" className="h-auto px-0" asChild>
        <Link to={paths.products.corrections}>
          <ArrowLeft />
          Corrections
        </Link>
      </Button>

      <PageHeader
        title={correction.number}
        description={`${formatNumber(correction.lines.length)} items at ${correction.locationName}`}
        action={
          correction.status === 'applied' && can('products.corrections.delete') ? (
            <Button variant="secondary" onClick={() => setConfirmCancel(true)}>
              <Undo2 />
              Reverse
            </Button>
          ) : null
        }
        below={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={correctionStatusTone(correction.status)}>
              {correctionStatusLabel(correction.status)}
            </Badge>
            <span className="text-fg text-sm font-medium">
              {correctionReasonLabel(correction.reason)}
            </span>
            <span className="text-fg-muted text-sm">· {correction.locationName}</span>
            {correction.comment ? (
              <span className="text-fg-subtle text-sm">· {correction.comment}</span>
            ) : null}
          </div>
        }
      />

      {correction.status === 'cancelled' ? (
        <Card>
          <CardBody className="flex items-start gap-3 p-4">
            <Undo2 className="text-fg-muted mt-0.5 size-4 shrink-0" />
            <p className="text-fg-muted text-sm">
              This correction was reversed on {formatDateTime(correction.updatedAt)}. Its effect on
              stock has been undone, and both entries are kept — that it was made and then withdrawn
              is itself part of the record.
            </p>
          </CardBody>
        </Card>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Items</CardTitle>
            <span className={`text-sm font-medium ${net < 0 ? 'text-danger' : 'text-success'}`}>
              {net > 0 ? '+' : '−'}
              {formatNumber(Math.abs(net))} units
              {canSeeCost ? ` · ${value < 0 ? '−' : ''}${formatMoney(Math.abs(value))}` : ''}
            </span>
          </CardHeader>
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-canvas">
                  <tr className="text-fg-muted text-2xs tracking-wide uppercase">
                    <th className="px-4 py-2 text-left font-semibold">Product</th>
                    <th className="px-4 py-2 text-right font-semibold">System said</th>
                    <th className="px-4 py-2 text-right font-semibold">Counted</th>
                    <th className="px-4 py-2 text-right font-semibold">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {correction.lines.map((line) => {
                    const delta = lineDelta(line)
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
                          {formatNumber(line.countedBefore)} {line.unit}
                        </td>
                        <td className="text-fg px-4 py-2 text-right font-medium tabular-nums">
                          {formatNumber(line.countedAfter)}
                        </td>
                        <td
                          className={`px-4 py-2 text-right font-medium tabular-nums ${
                            delta === 0
                              ? 'text-fg-subtle'
                              : delta < 0
                                ? 'text-danger'
                                : 'text-success'
                          }`}
                        >
                          {delta === 0
                            ? '—'
                            : `${delta > 0 ? '+' : '−'}${formatNumber(Math.abs(delta))}`}
                        </td>
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
            <CardTitle>Record</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3 text-sm">
            <Row label="Reason" value={correctionReasonLabel(correction.reason)} />
            <Row label="Location" value={correction.locationName} />
            <Row label="Recorded by" value={correction.createdBy} />
            <Row label="Recorded" value={formatDateTime(correction.createdAt)} />
            {correction.comment ? <Row label="Comment" value={correction.comment} /> : null}
          </CardBody>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="Reverse this correction?"
        confirmLabel="Reverse"
        body={`${correction.number} changed stock at ${correction.locationName} by ${
          net > 0 ? '+' : '−'
        }${formatNumber(Math.abs(net))} units. Reversing puts that back and keeps both entries.`}
        onConfirm={() =>
          cancel.mutate({
            onSuccess: () => {
              toast.success(`${correction.number} reversed`)
              setConfirmCancel(false)
              navigate(paths.products.corrections)
            },
            onError: (message) => toast.error(message),
          })
        }
      />
    </>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-fg-muted">{label}</span>
      <span className="text-fg text-right font-medium">{value}</span>
    </div>
  )
}
