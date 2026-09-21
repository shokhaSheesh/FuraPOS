import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft, ArrowDownLeft, ArrowUpRight, Lock, Plus } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState'
import { Field } from '@/shared/components/Field'
import { NumberField } from '@/shared/components/NumberField'
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { Modal } from '@/shared/ui/Modal'
import { Select } from '@/shared/ui/Select'
import { toast } from '@/shared/ui/toast'
import { useSession } from '@/app/providers/SessionProvider'
import { paths } from '@/shared/config/paths'
import { formatDateTime, formatMoney, formatNumber } from '@/shared/lib/format'
import { useDataStore } from '@/data/store'
import { useCashShift, useShiftActions } from '../api/shifts'
import {
  MOVEMENT_REASONS,
  expenseCategoryLabel,
  movementsIn,
  movementsOut,
  reasonLabel,
  shiftHours,
} from '../model/shift'
import { VarianceBadge } from '../components/VarianceBadge'
import { CloseShiftModal } from '../components/CloseShiftModal'
import { t } from '@/shared/i18n'

/**
 * One shift, end to end: what it took, what moved through it by hand, which
 * sales it contains, and how it finished.
 */
export default function CashShiftDetailPage() {
  const { shiftId } = useParams()
  const { can } = useSession()
  const { data: shift } = useCashShift(shiftId)
  const actions = useShiftActions()
  const sales = useDataStore((s) => s.sales)

  const [closing, setClosing] = useState(false)
  const [moving, setMoving] = useState(false)
  const [movement, setMovement] = useState({
    reason: 'expense',
    amount: null as number | null,
    comment: '',
  })

  const shiftSales = useMemo(
    () => sales.filter((sale) => sale.shiftId === shiftId),
    [sales, shiftId],
  )

  if (!shift) {
    return (
      <EmptyState
        icon={Lock}
        title={t('No such shift')}
        description={t('It may have been removed.')}
      />
    )
  }

  const isOpen = shift.status === 'open'
  const reason = MOVEMENT_REASONS.find((entry) => entry.value === movement.reason)

  const saveMovement = () => {
    if (!movement.amount || movement.amount <= 0) {
      toast.error(t('An amount is required'))
      return
    }
    const result = actions.move(shift.id, {
      kind: reason?.kind ?? 'out',
      reason: movement.reason,
      amount: movement.amount,
      comment: movement.comment.trim() || null,
    })
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(t('Recorded'))
    setMovement({ reason: 'expense', amount: null, comment: '' })
    setMoving(false)
  }

  const summary: [string, string][] = [
    ['Opening float', formatMoney(shift.openingFloat)],
    ['Cash sales', formatMoney(shift.totals.cash)],
    ['Paid in by hand', formatMoney(movementsIn(shift))],
    ['Paid out by hand', `−${formatMoney(movementsOut(shift))}`],
  ]

  return (
    <>
      <Button variant="link" size="sm" className="h-auto px-0" asChild>
        <Link to={paths.sales.shifts}>
          <ArrowLeft />
          {t('Cash shifts')}
        </Link>
      </Button>

      <PageHeader
        title={shift.number}
        description={`${shift.registerName} · ${shift.locationName} · ${shift.employeeName}`}
        action={
          isOpen && can('sales.cashShifts.edit') ? (
            <Button variant="primary" onClick={() => setClosing(true)}>
              <Lock />
              {t('Close the drawer')}
            </Button>
          ) : null
        }
        below={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={isOpen ? 'info' : 'neutral'}>{isOpen ? t('Open') : t('Closed')}</Badge>
            <span className="text-fg-subtle text-2xs">
              {t('Opened')} {formatDateTime(shift.openedAt)}
              {shift.closedAt
                ? t(' · closed {p0}', { p0: formatDateTime(shift.closedAt) })
                : ''} · {formatNumber(Math.round(shiftHours(shift)))} h
            </span>
          </div>
        }
      />

      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t('The drawer')}</CardTitle>
          </CardHeader>
          <CardBody className="p-0">
            <div className="divide-border divide-y">
              {summary.map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-3 px-4 py-2">
                  <span className="text-fg-muted text-sm">{label}</span>
                  <span className="text-fg text-sm tabular-nums">{value}</span>
                </div>
              ))}
              <div className="bg-canvas flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="text-fg text-sm font-medium">
                  {isOpen ? t('Should be in the drawer now') : t('Should have been in the drawer')}
                </span>
                <span className="text-fg font-semibold tabular-nums">
                  {formatMoney(shift.expected)}
                </span>
              </div>
              {shift.countedCash !== null ? (
                <>
                  <div className="flex items-center justify-between gap-3 px-4 py-2">
                    <span className="text-fg-muted text-sm">{t('Counted')}</span>
                    <span className="text-fg text-sm tabular-nums">
                      {formatMoney(shift.countedCash)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <span className="text-fg text-sm font-medium">{t('Difference')}</span>
                    <VarianceBadge difference={shift.difference} />
                  </div>
                </>
              ) : null}
            </div>
            {shift.closingComment ? (
              <p className="border-border text-fg-muted border-t px-4 py-2 text-sm">
                “{shift.closingComment}”
              </p>
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('Taken this shift')}</CardTitle>
          </CardHeader>
          <CardBody className="space-y-2 text-sm">
            {/* Card and transfer are shown but never counted into the drawer —
                stating both is what stops somebody adding them to the cash-up. */}
            {(
              [
                [t('Cash'), shift.totals.cash, true],
                [t('Card'), shift.totals.card, false],
                [t('Transfer'), shift.totals.transfer, false],
                [t('On account'), shift.totals.credit, false],
              ] as [string, number, boolean][]
            ).map(([label, value, inDrawer]) => (
              <div key={label} className="flex items-baseline justify-between gap-3">
                <span className="text-fg-muted">
                  {label}
                  {inDrawer ? (
                    ''
                  ) : (
                    <span className="text-fg-subtle text-2xs"> {t('· not in the drawer')}</span>
                  )}
                </span>
                <span className="text-fg tabular-nums">{formatMoney(value)}</span>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex items-center justify-between gap-3">
          <CardTitle>{t('Cash in and out')}</CardTitle>
          {isOpen && can(t('sales.cashShifts.edit')) ? (
            <Button variant="secondary" size="sm" onClick={() => setMoving(true)}>
              <Plus />
              {t('Record money')}
            </Button>
          ) : null}
        </CardHeader>
        <CardBody className="p-0">
          {shift.movements.length === 0 ? (
            <p className="text-fg-subtle px-4 py-6 text-center text-sm">
              {t('Nothing beyond sales has moved through this drawer.')}
            </p>
          ) : (
            <div className="divide-border divide-y">
              {shift.movements.map((entry) => (
                <div key={entry.id} className="flex items-center gap-3 px-4 py-2">
                  {entry.kind === 'in' ? (
                    <ArrowDownLeft className="text-success size-4 shrink-0" />
                  ) : (
                    <ArrowUpRight className="text-warning size-4 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-fg text-sm">
                      {reasonLabel(entry.reason)}
                      {entry.category ? (
                        <span className="text-fg-muted">
                          {' '}
                          · {expenseCategoryLabel(entry.category)}
                        </span>
                      ) : null}
                    </p>
                    <p className="text-fg-subtle text-2xs truncate">
                      {entry.by}
                      {entry.comment ? ` · ${entry.comment}` : ''}
                    </p>
                  </div>
                  <span className="text-fg text-sm tabular-nums">
                    {entry.kind === 'in' ? '+' : '−'}
                    {formatMoney(entry.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('Cash sales in this shift')}</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {shiftSales.length === 0 ? (
            <p className="text-fg-subtle px-4 py-6 text-center text-sm">
              {t('No cash sales yet.')}
            </p>
          ) : (
            <div className="divide-border divide-y">
              {shiftSales.map((sale) => (
                <div key={sale.id} className="flex items-center gap-3 px-4 py-2">
                  <Link
                    to={paths.sales.orderDetail(sale.id)}
                    className="text-fg text-sm font-medium hover:underline"
                  >
                    {sale.number}
                  </Link>
                  <span className="text-fg-subtle text-2xs truncate">
                    {sale.clientName ?? t('Walk-in')} · {formatDateTime(sale.createdAt)}
                  </span>
                  <span className="text-fg ml-auto text-sm tabular-nums">
                    {formatMoney(sale.paid)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <CloseShiftModal shift={shift} open={closing} onOpenChange={setClosing} />

      <Modal
        open={moving}
        onOpenChange={setMoving}
        title={t('Record money in or out')}
        description={t(
          'Anything that moves cash without being a sale — a refund, petty cash, a collection to the safe.',
        )}
        primary={{ label: t('Record it'), onClick: saveMovement }}
      >
        <div className="space-y-3">
          <Field label={t('Why')} required>
            {(p) => (
              <Select
                {...p}
                className="w-full"
                value={movement.reason}
                onChange={(value) => setMovement((c) => ({ ...c, reason: value }))}
                options={MOVEMENT_REASONS.map((entry) => ({
                  value: entry.value,
                  label: entry.label,
                  hint: entry.kind === 'in' ? 'Into the drawer' : 'Out of the drawer',
                }))}
              />
            )}
          </Field>
          <Field label={t('Amount')} required>
            {(p) => (
              <NumberField
                {...p}
                className="w-full"
                value={movement.amount}
                onChange={(amount) => setMovement((c) => ({ ...c, amount }))}
              />
            )}
          </Field>
          <Field
            label={t('Note')}
            hint={t('Optional, but it is what makes the log readable later')}
          >
            {(p) => (
              <Input
                {...p}
                value={movement.comment}
                onChange={(event) => setMovement((c) => ({ ...c, comment: event.target.value }))}
              />
            )}
          </Field>
        </div>
      </Modal>
    </>
  )
}
