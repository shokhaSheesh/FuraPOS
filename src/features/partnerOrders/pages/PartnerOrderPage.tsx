import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft, Ban, Check, Download, Truck } from 'lucide-react'
import { DataTable } from '@/shared/components/DataTable'
import { EmptyState } from '@/shared/components/EmptyState'
import { Field } from '@/shared/components/Field'
import { NumberField } from '@/shared/components/NumberField'
import { ProductThumb } from '@/shared/components/ProductThumb'
import { Steps } from '@/shared/components/Steps'
import { StorageAddress } from '@/shared/components/StorageAddress'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { Input } from '@/shared/ui/Input'
import { Modal } from '@/shared/ui/Modal'
import { toast } from '@/shared/ui/toast'
import { paths } from '@/shared/config/paths'
import { useSession } from '@/app/providers/SessionProvider'
import { formatDate, formatDateTime, formatMoney, formatNumber } from '@/shared/lib/format'
import { downloadCsv } from '@/shared/lib/csv'
import { USD_RATE } from '@/data/seed'
import { useDataStore } from '@/data/store'
import type { TableColumn } from '@/shared/components/table/features'
import type { VariationRow } from '@/features/products/model/product'
import {
  buildProductFieldColumns,
  PRODUCT_FIELD_COLUMN_IDS,
} from '@/features/products/components/productFieldColumns'
import {
  canCancel,
  canShip,
  lineOutstanding,
  nextStep,
  orderValue,
  orderedUnits,
  outstandingUnits,
  partnerStatusLabel,
  partnerStatusTone,
  shippedValue,
  partnerOrderCsv,
  type PartnerOrder,
  type PartnerOrderLine,
} from '../model/partnerOrder'
import { usePartnerOrder, usePartnerOrderActions } from '../api/partnerOrders'
import { t } from '@/shared/i18n'

/*
  Two, not three. Our side of a partner order ends at the loading bay: what
  they counted off the lorry is recorded at their end, on their own goods
  receipt, exactly as we record a delivery from AKCHAEV on ours.
*/
const STEPS = ['The order', 'Shipments']

/**
 * One order somebody placed with us, from arrival to their confirmation.
 *
 * The same stepped shape as a goods receipt or a purchase order, because it is
 * the same kind of thing: a document with a life rather than an event. The
 * three steps are the three hands it passes through — theirs when they placed
 * it, ours when we send it, theirs again when they count what turned up.
 */
export default function PartnerOrderPage() {
  const { partnerOrderId = '' } = useParams()
  const { data: order } = usePartnerOrder(partnerOrderId)
  const [step, setStep] = useState(1)

  if (!order) {
    return (
      <EmptyState
        title={t('That order no longer exists')}
        description={t('It may have been cancelled since this link was made.')}
        action={
          <Button variant="secondary" asChild>
            <Link to={paths.sales.partnerOrders}>{t('Back to partner orders')}</Link>
          </Button>
        }
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="icon" aria-label={t('Back to partner orders')} asChild>
          <Link to={paths.sales.partnerOrders}>
            <ArrowLeft />
          </Link>
        </Button>
        <h1 className="text-fg text-lg font-semibold">
          {t('Order')} {order.number} — {order.clientName}
        </h1>
        <Badge tone={partnerStatusTone(order.status)}>{partnerStatusLabel(order.status)}</Badge>
        {order.wantedBy ? (
          <span className="text-fg-muted text-sm">
            {t('Wanted by')} {formatDate(order.wantedBy)}
          </span>
        ) : null}
      </div>

      <Steps steps={STEPS} current={step} onSelect={setStep} selectable wide />

      {step === 1 ? <OrderStep order={order} /> : <ShipmentsStep order={order} />}
    </div>
  )
}

/* --- step 1: the order --------------------------------------------------- */

function OrderStep({ order }: { order: PartnerOrder }) {
  const { can } = useSession()
  const actions = usePartnerOrderActions(order.id)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const accept = nextStep(order.status)
  const mayEdit = can('sales.orders.edit')

  return (
    <>
      <Card>
        <CardHeader className="items-start justify-between gap-3">
          <div>
            <CardTitle>{t('What they asked for')}</CardTitle>
            <p className="text-fg-subtle text-2xs mt-0.5">
              {t('Placed')} {formatDateTime(order.placedAt)} {t('· ships from')}{' '}
              {order.locationName}
              {order.comment ? ` · ${order.comment}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* The same sheet the list hands out, from the order itself. */}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                const sheet = partnerOrderCsv(order)
                downloadCsv(sheet.name, sheet.head, sheet.rows)
                toast.success(t('{number} downloaded', { number: order.number }))
              }}
            >
              <Download />
              {t('Download')}
            </Button>
            {canCancel(order.status) && mayEdit ? (
              <Button variant="secondary" size="sm" onClick={() => setConfirmCancel(true)}>
                <Ban />
                {t('Decline')}
              </Button>
            ) : null}
            {accept && mayEdit ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() =>
                  actions.confirm({
                    onSuccess: () =>
                      toast.success(t('{number} accepted', { number: order.number })),
                    onError: (message) => toast.error(message),
                  })
                }
              >
                <Check />
                {accept.label}
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardBody className="p-0">
          <LineTable order={order} />
        </CardBody>
      </Card>

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title={t('Decline this order?')}
        confirmLabel={t('Decline it')}
        body={`${order.number} from ${order.clientName} is closed and its ${formatNumber(
          orderedUnits(order),
        )} units stop being expected. Nothing already sent is affected.`}
        onConfirm={() =>
          actions.cancel({
            onSuccess: () => {
              toast.success(t('{number} declined', { number: order.number }))
              setConfirmCancel(false)
            },
            onError: (message) => toast.error(message),
          })
        }
      />
    </>
  )
}

/** A line of a partner's order, with our catalogue row behind it. */
interface PartnerRow {
  key: string
  line: PartnerOrderLine
  variation: VariationRow | undefined
}

/* --- step 2: shipments --------------------------------------------------- */

function ShipmentsStep({ order }: { order: PartnerOrder }) {
  const { can } = useSession()
  const actions = usePartnerOrderActions(order.id)
  const [shipping, setShipping] = useState(false)
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [note, setNote] = useState('')

  // Opens pre-filled with everything still outstanding, because the usual case
  // is that the rest of the order is going on this lorry.
  const open = () => {
    setQuantities(Object.fromEntries(order.lines.map((line) => [line.id, lineOutstanding(line)])))
    setNote('')
    setShipping(true)
  }

  const going = Object.values(quantities).reduce((sum, value) => sum + value, 0)

  return (
    <>
      <Card>
        <CardHeader className="items-start justify-between gap-3">
          <CardTitle>{t('What we have sent')}</CardTitle>
          {canShip(order.status) && can('sales.orders.edit') ? (
            <Button variant="primary" size="sm" onClick={open}>
              <Truck />
              {t('Record a shipment')}
            </Button>
          ) : null}
        </CardHeader>
        <CardBody className="p-0">
          {order.shipments.length === 0 ? (
            <EmptyState
              title={t('Nothing has gone yet')}
              description={
                order.status === 'new'
                  ? t('Accept the order on the first step before sending any of it.')
                  : t('Recording a shipment takes the stock off the shelf it ships from.')
              }
            />
          ) : (
            <div className="scroll-x-quiet overflow-x-auto">
              <table className="w-full min-w-max text-sm">
                <thead className="bg-canvas">
                  <tr className="text-fg-muted text-2xs tracking-wide uppercase">
                    <th className="px-4 py-2 text-left font-semibold">{t('Shipment')}</th>
                    <th className="px-4 py-2 text-left font-semibold">{t('When')}</th>
                    <th className="px-4 py-2 text-left font-semibold">{t('By')}</th>
                    <th className="px-4 py-2 text-right font-semibold">{t('Units')}</th>
                    <th className="px-4 py-2 text-left font-semibold">{t('Note')}</th>
                  </tr>
                </thead>
                <tbody>
                  {order.shipments.map((shipment) => (
                    <tr key={shipment.id} className="border-border border-t">
                      <td className="text-2xs px-4 py-2 font-mono">{shipment.number}</td>
                      <td className="text-fg-muted px-4 py-2">
                        {formatDateTime(shipment.shippedAt)}
                      </td>
                      <td className="text-fg-muted px-4 py-2">{shipment.shippedBy}</td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {formatNumber(
                          Object.values(shipment.quantities).reduce((sum, q) => sum + q, 0),
                        )}
                      </td>
                      <td className="text-fg-muted px-4 py-2">{shipment.note ?? '—'}</td>
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
          <CardTitle>{t('Still to send')}</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          <LineTable order={order} />
        </CardBody>
      </Card>

      <Modal
        open={shipping}
        onOpenChange={setShipping}
        title={t('Record a shipment')}
        description={t('What is going on this load. The stock leaves the shelf it ships from.')}
        size="lg"
        primary={{
          label: t('Send it'),
          disabled: going === 0,
          onClick: () =>
            actions.ship(
              { quantities, note },
              {
                onSuccess: () => {
                  setShipping(false)
                  toast.success(t('{p0} units sent', { p0: formatNumber(going) }))
                },
                onError: (message) => toast.error(message),
              },
            ),
        }}
      >
        <div className="space-y-3">
          <Field label={t('Note')} hint={t('Anything worth knowing about this load')}>
            {(p) => (
              <Input
                {...p}
                placeholder={t('Rest to follow next week')}
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            )}
          </Field>

          <div className="border-border rounded-card scroll-x-quiet overflow-x-auto border">
            <table className="w-full text-sm">
              <thead className="bg-canvas">
                <tr className="text-fg-muted text-2xs tracking-wide uppercase">
                  <th className="px-3 py-2 text-left font-semibold">{t('Product')}</th>
                  <th className="px-3 py-2 text-right font-semibold">{t('Still to send')}</th>
                  <th className="px-3 py-2 text-right font-semibold">{t('Going')}</th>
                </tr>
              </thead>
              <tbody>
                {order.lines.map((line) => {
                  const left = lineOutstanding(line)
                  return (
                    <tr key={line.id} className="border-border border-t">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2.5">
                          <ProductThumb src={line.imageUrl} size="sm" />
                          <div className="min-w-0">
                            <p className="text-fg font-medium">{line.name}</p>
                            <p className="text-fg-subtle text-2xs font-mono">
                              {line.sku}
                              <StorageAddress variationId={line.variationId} />
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="text-fg-muted px-3 py-2 text-right tabular-nums">
                        {left === 0 ? 'complete' : `${formatNumber(left)} ${line.unit}`}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <NumberField
                          className="w-24"
                          nullable={false}
                          min={0}
                          disabled={left === 0}
                          aria-label={t('Sending {name}', { name: line.name })}
                          value={quantities[line.id] ?? 0}
                          onChange={(next) =>
                            setQuantities((current) => ({
                              ...current,
                              // Never more than is outstanding: sending more
                              // than was asked for is a new order, not this one.
                              [line.id]: Math.min(left, Math.max(0, next ?? 0)),
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
            {going === 0
              ? t('Nothing to send.')
              : t('{p0} units leaving {locationName}.', {
                  p0: formatNumber(going),
                  locationName: order.locationName,
                })}
          </p>
        </div>
      </Modal>
    </>
  )
}

/* --- shared -------------------------------------------------------------- */

function LineTable({ order }: { order: PartnerOrder }) {
  const { can } = useSession()
  const canSeeMoney = can('sales.orders.view')
  const variations = useDataStore((s) => s.variations)
  const [columnsSlot, setColumnsSlot] = useState<HTMLElement | null>(null)

  /*
    The catalogue's own fields, switchable from Columns like every other
    document (client request) — somebody reading an order reads the same
    catalogue as somebody managing it. The order's own numbers go straight
    after the identity block.
  */
  const rows = useMemo<PartnerRow[]>(
    () =>
      order.lines.map((line) => ({
        key: line.id,
        line,
        variation: variations.find((entry) => entry.id === line.variationId),
      })),
    [order.lines, variations],
  )

  const columns = useMemo(() => {
    const fields = buildProductFieldColumns<PartnerRow>({
      variationOf: (row) => row.variation,
      canSeeCost: false,
    })
    const identityIds = PRODUCT_FIELD_COLUMN_IDS.slice(0, PRODUCT_FIELD_COLUMN_IDS.indexOf('stock'))
    const isIdentity = (column: TableColumn<PartnerRow>) => identityIds.includes(column.id ?? '')

    const own: TableColumn<PartnerRow>[] = [
      {
        id: 'ordered',
        header: t('Ordered'),
        enableHiding: false,
        meta: { align: 'right' },
        cell: ({ row }) => (
          <span className="text-fg-muted tabular-nums">
            {formatNumber(row.original.line.orderedQuantity)} {row.original.line.unit}
          </span>
        ),
      },
      {
        id: 'shipped',
        header: t('Sent'),
        enableHiding: false,
        meta: { align: 'right' },
        cell: ({ row }) => (
          <span className="text-fg tabular-nums">
            {formatNumber(row.original.line.shippedQuantity)}
          </span>
        ),
      },
      {
        id: 'outstanding',
        header: t('Still to send'),
        enableHiding: false,
        meta: { align: 'right' },
        cell: ({ row }) => {
          const left = lineOutstanding(row.original.line)
          return left === 0 ? (
            <span className="text-success">{t('complete')}</span>
          ) : (
            <span className="text-warning font-medium tabular-nums">{formatNumber(left)}</span>
          )
        },
      },
      ...(canSeeMoney
        ? [
            {
              id: 'unitPrice',
              header: t('Price'),
              meta: { align: 'right' as const },
              cell: ({ row }: { row: { original: PartnerRow } }) => (
                <span className="text-fg-muted tabular-nums">
                  {formatMoney(row.original.line.unitPrice)}
                </span>
              ),
            } satisfies TableColumn<PartnerRow>,
          ]
        : []),
    ]

    return [...fields.filter(isIdentity), ...own, ...fields.filter((c) => !isIdentity(c))]
  }, [canSeeMoney])

  return (
    <div className="space-y-2">
      <div ref={setColumnsSlot} className="flex justify-end px-4" />
      <DataTable
        reorderableColumns
        storageKey="partner-order-lines"
        columnsMenuContainer={columnsSlot}
        columns={columns}
        initialHidden={PRODUCT_FIELD_COLUMN_IDS.filter(
          (id) => !['productName', 'name', 'sku', 'stock'].includes(id),
        )}
        data={rows}
        total={rows.length}
        getRowId={(row) => row.key}
        footer={
          canSeeMoney ? (
            <div className="text-fg-muted flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
              <span>
                {formatNumber(outstandingUnits(order))} {t('units still to send')}
              </span>
              <span className="text-fg font-medium tabular-nums">
                {formatMoney(Math.round(shippedValue(order, USD_RATE)))} {t('sent of')}{' '}
                {formatMoney(Math.round(orderValue(order, USD_RATE)))}
              </span>
            </div>
          ) : null
        }
      />
    </div>
  )
}
