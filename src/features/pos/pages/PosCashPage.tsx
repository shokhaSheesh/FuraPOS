import { useMemo, useState, type ReactNode } from 'react'
import { Lock, LockOpen, Receipt, Wallet } from 'lucide-react'
import { EmptyState } from '@/shared/components/EmptyState'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card'
import { cn } from '@/shared/lib/cn'
import { formatDateTime, formatMoney } from '@/shared/lib/format'
import { t } from '@/shared/i18n'
import { useDataStore } from '@/data/store'
import { useSession } from '@/app/providers/SessionProvider'
import { useCashShifts, type ShiftRow } from '@/features/cashShifts/api/shifts'
import {
  MOVEMENT_REASONS,
  expenseCategoryLabel,
  movementsIn,
  movementsOut,
  type CashMovement,
} from '@/features/cashShifts/model/shift'
import { OpenShiftModal } from '@/features/cashShifts/components/OpenShiftModal'
import { CloseShiftModal } from '@/features/cashShifts/components/CloseShiftModal'
import { ExpenseModal } from '../components/ExpenseModal'
import { useTillStore } from '../model/tillStore'

/** What was spent from a drawer, as opposed to cash moved in or collected. */
const expensesOf = (shift: Pick<ShiftRow, 'movements'>) =>
  shift.movements
    .filter((movement) => movement.kind === 'out' && movement.reason === 'expense')
    .reduce((sum, movement) => sum + movement.amount, 0)

const movementLabel = (movement: CashMovement) =>
  movement.reason === 'expense'
    ? expenseCategoryLabel(movement.category)
    : t(MOVEMENT_REASONS.find((entry) => entry.value === movement.reason)?.label ?? movement.reason)

/**
 * The till's cash desk (client request): how much cash is in each shop's
 * drawer right now, and — for the shop the till is standing in — how that
 * figure was reached and what the cashier spent from it.
 *
 * Every number is the cash shift's own: float, plus cash sales, plus money put
 * in, less money taken out. Transfers and credit are shown beside it but never
 * counted in it, because they never touch the drawer. Expenses are recorded
 * here as cash-outs on the open shift, so the cash-up at closing already
 * expects them.
 */
export default function PosCashPage() {
  const locations = useDataStore((s) => s.locations)
  const locationId = useTillStore((s) => s.locationId)
  const { data } = useCashShifts({ status: 'open' })
  const { can } = useSession()
  const canAct = can('sales.cashShifts.edit')
  const [opening, setOpening] = useState(false)
  const [closing, setClosing] = useState(false)
  const [spending, setSpending] = useState(false)

  /** One open drawer per shop, as the sale screen reads it. */
  const byLocation = useMemo(
    () =>
      locations.map((location) => ({
        location,
        shift: data.items.find((shift) => shift.locationId === location.id) ?? null,
      })),
    [locations, data.items],
  )
  const open = data.items
  const here = byLocation.find((entry) => entry.location.id === locationId)
  const shift = here?.shift ?? null

  const sum = (pick: (shift: ShiftRow) => number) => open.reduce((total, s) => total + pick(s), 0)

  return (
    <div className="h-full space-y-4 overflow-y-auto p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-fg text-lg font-semibold">{t('Cash desk')}</h1>
          <p className="text-fg-muted text-sm">
            {t('How much cash is in each drawer now, and what was spent from it.')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!canAct ? null : shift ? (
            <>
              <Button variant="secondary" onClick={() => setClosing(true)}>
                <Lock />
                {t('Close the shift')}
              </Button>
              <Button variant="primary" onClick={() => setSpending(true)}>
                <Receipt />
                {t('Add an expense')}
              </Button>
            </>
          ) : (
            <Button variant="primary" onClick={() => setOpening(true)}>
              <LockOpen />
              {t('Open a shift')}
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          icon={<Wallet />}
          label={t('Cash in drawers now')}
          value={formatMoney(sum((s) => s.expected))}
          detail={t('{count} of {total} drawers open', {
            count: open.length,
            total: locations.length,
          })}
          strong
        />
        <Kpi label={t('Cash sales')} value={formatMoney(sum((s) => s.totals.cash))} />
        <Kpi
          label={t('Transfer payments')}
          value={formatMoney(sum((s) => s.totals.card))}
          detail={t('Not in the drawer')}
        />
        <Kpi
          label={t('Expenses')}
          value={formatMoney(sum(expensesOf))}
          tone={sum(expensesOf) > 0 ? 'text-warning' : undefined}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('By location')}</CardTitle>
        </CardHeader>
        <CardBody className="overflow-x-auto p-0">
          <table className="w-full min-w-max text-sm">
            <thead className="bg-canvas">
              <tr className="text-fg-muted text-2xs tracking-wide uppercase">
                <th className="px-4 py-2 text-left font-semibold">{t('Location')}</th>
                <th className="px-4 py-2 text-left font-semibold">{t('Status')}</th>
                <th className="px-4 py-2 text-right font-semibold">{t('Opening float')}</th>
                <th className="px-4 py-2 text-right font-semibold">{t('Cash sales')}</th>
                <th className="px-4 py-2 text-right font-semibold">{t('Expenses')}</th>
                <th className="px-4 py-2 text-right font-semibold">{t('In the drawer now')}</th>
              </tr>
            </thead>
            <tbody>
              {byLocation.map(({ location, shift: row }) => (
                <tr
                  key={location.id}
                  className={cn(
                    'border-border border-t',
                    location.id === locationId && 'bg-primary-soft/40',
                  )}
                >
                  <td className="text-fg px-4 py-2.5 font-medium">
                    {location.name}
                    {location.id === locationId ? (
                      <span className="text-primary text-2xs ml-2">{t('this till')}</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2.5">
                    {row ? (
                      <span className="flex items-center gap-2">
                        <Badge tone="success">{t('Open')}</Badge>
                        <span className="text-fg-muted text-2xs">
                          {row.registerName} · {row.employeeName}
                        </span>
                      </span>
                    ) : (
                      <Badge tone="neutral">{t('Closed')}</Badge>
                    )}
                  </td>
                  <Money value={row?.openingFloat} />
                  <Money value={row?.totals.cash} />
                  <Money value={row ? expensesOf(row) : undefined} negative />
                  <td className="text-fg px-4 py-2.5 text-right font-semibold tabular-nums">
                    {row ? formatMoney(row.expected) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>

      {shift ? (
        <div className="grid gap-3 lg:grid-cols-[22rem_minmax(0,1fr)]">
          <Card>
            <CardHeader className="flex-col items-stretch gap-0.5">
              <CardTitle>
                {t('The drawer at {location}', { location: shift.locationName })}
              </CardTitle>
              <p className="text-fg-subtle text-2xs">
                {shift.registerName} ·{' '}
                {t('opened {when} by {who}', {
                  when: formatDateTime(shift.openedAt),
                  who: shift.employeeName,
                })}
              </p>
            </CardHeader>
            <CardBody className="space-y-2 text-sm">
              <Line label={t('Opening float')} value={formatMoney(shift.openingFloat)} />
              <Line label={t('Cash sales')} value={`+ ${formatMoney(shift.totals.cash)}`} />
              {movementsIn(shift) > 0 ? (
                <Line label={t('Paid in by hand')} value={`+ ${formatMoney(movementsIn(shift))}`} />
              ) : null}
              <Line
                label={t('Taken out')}
                value={`− ${formatMoney(movementsOut(shift))}`}
                tone="text-warning"
              />
              <div className="border-border flex items-baseline justify-between border-t pt-2">
                <span className="text-fg font-medium">{t('Should be in the drawer')}</span>
                <span className="text-fg text-xl font-semibold tabular-nums">
                  {formatMoney(shift.expected)}
                </span>
              </div>
              <div className="border-border text-fg-subtle space-y-1 border-t pt-2 text-xs">
                <Line
                  label={t('Transfers — not in the drawer')}
                  value={formatMoney(shift.totals.card)}
                  muted
                />
                <Line
                  label={t('On credit — not in the drawer')}
                  value={formatMoney(shift.totals.credit)}
                  muted
                />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('Money in and out')}</CardTitle>
            </CardHeader>
            <CardBody className="p-0">
              {shift.movements.length === 0 ? (
                <EmptyState
                  title={t('Nothing spent yet')}
                  description={t('Expenses paid from this drawer appear here.')}
                  action={
                    canAct ? (
                      <Button variant="secondary" onClick={() => setSpending(true)}>
                        <Receipt />
                        {t('Add an expense')}
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                <ul className="divide-border divide-y">
                  {[...shift.movements].reverse().map((movement) => (
                    <li key={movement.id} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-fg text-sm font-medium">{movementLabel(movement)}</p>
                        <p className="text-fg-subtle text-2xs truncate">
                          {[formatDateTime(movement.at), movement.by, movement.comment]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      </div>
                      <span
                        className={cn(
                          'font-semibold tabular-nums',
                          movement.kind === 'out' ? 'text-warning' : 'text-success',
                        )}
                      >
                        {movement.kind === 'out' ? '−' : '+'} {formatMoney(movement.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      ) : (
        <Card>
          <EmptyState
            title={t('No drawer is open at {location}', { location: here?.location.name ?? '' })}
            description={t('Open a shift to take cash and record expenses here.')}
            action={
              canAct ? (
                <Button variant="primary" onClick={() => setOpening(true)}>
                  <LockOpen />
                  {t('Open a shift')}
                </Button>
              ) : undefined
            }
          />
        </Card>
      )}

      <OpenShiftModal open={opening} onOpenChange={setOpening} />
      <CloseShiftModal shift={shift} open={closing} onOpenChange={setClosing} />
      {shift ? <ExpenseModal shift={shift} open={spending} onOpenChange={setSpending} /> : null}
    </div>
  )
}

function Kpi({
  icon,
  label,
  value,
  detail,
  tone,
  strong = false,
}: {
  icon?: ReactNode
  label: string
  value: string
  detail?: string
  tone?: string
  strong?: boolean
}) {
  return (
    <Card className={cn('p-4', strong && 'border-primary-border')}>
      <p className="text-fg-muted flex items-center gap-1.5 text-sm [&_svg]:size-4">
        {icon}
        {label}
      </p>
      <p className={cn('mt-1 text-xl font-semibold tabular-nums', tone ?? 'text-fg')}>{value}</p>
      {detail ? <p className="text-fg-subtle text-2xs mt-0.5">{detail}</p> : null}
    </Card>
  )
}

function Money({ value, negative = false }: { value: number | undefined; negative?: boolean }) {
  return (
    <td className="text-fg-muted px-4 py-2.5 text-right tabular-nums">
      {value === undefined
        ? '—'
        : value === 0
          ? formatMoney(0)
          : `${negative ? '− ' : ''}${formatMoney(value)}`}
    </td>
  )
}

function Line({
  label,
  value,
  tone,
  muted = false,
}: {
  label: string
  value: string
  tone?: string
  muted?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={muted ? '' : 'text-fg-muted'}>{label}</span>
      <span
        className={cn('tabular-nums', muted ? '' : 'font-medium', tone ?? (muted ? '' : 'text-fg'))}
      >
        {value}
      </span>
    </div>
  )
}
