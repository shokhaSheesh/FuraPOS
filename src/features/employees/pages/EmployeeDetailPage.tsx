import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft, Ban, Pencil, Play, Archive } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState'
import { WalletPanel } from '@/shared/components/WalletPanel'
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { toast } from '@/shared/ui/toast'
import { useSession } from '@/app/providers/SessionProvider'
import { paths } from '@/shared/config/paths'
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatNumber,
  formatPercent,
} from '@/shared/lib/format'
import { useDataStore } from '@/data/store'
import { useEmployee, useEmployeeActions, useEmployeeSales } from '../api/employees'
import { Avatar } from '../components/Avatar'
import {
  daysSinceActive,
  employeeStatusLabel,
  employeeStatusTone,
  type EmployeeStatus,
} from '../model/employee'

export default function EmployeeDetailPage() {
  const { employeeId } = useParams()
  const navigate = useNavigate()
  const { can } = useSession()
  const { data: employee } = useEmployee(employeeId)
  const recentSales = useEmployeeSales(employeeId)
  const actions = useEmployeeActions()
  const allWalletTransactions = useDataStore((s) => s.walletTransactions)
  // Filtering inside the selector would hand Zustand a new array on every
  // render and loop forever; the store is the subscription, the memo is ours.
  const walletTransactions = useMemo(
    () =>
      allWalletTransactions.filter((t) => t.ownerType === 'employee' && t.ownerId === employeeId),
    [allWalletTransactions, employeeId],
  )
  const [confirming, setConfirming] = useState<EmployeeStatus | null>(null)

  if (!employee) {
    return (
      <EmptyState
        title="No such employee"
        description="They may have been removed."
        action={
          <Button variant="secondary" asChild>
            <Link to={paths.personnel.employees}>Back to employees</Link>
          </Button>
        }
      />
    )
  }

  const { stats } = employee
  const quiet = daysSinceActive(employee)
  const canEdit = can('personnel.employees.edit')

  // Positive = the company owes them (salary earned, not yet paid). Negative =
  // they have taken more than they have earned, which is an advance to recover.
  const balance = walletTransactions.reduce((sum, t) => sum + t.amount, 0)
  const owedByThem = balance < 0 ? -balance : 0

  const changeStatus = (status: EmployeeStatus) => {
    actions.setStatus(employee.id, status)
    setConfirming(null)
    toast.success(
      status === 'active'
        ? `${employee.fullName} can sign in again`
        : status === 'suspended'
          ? `${employee.fullName} can no longer sign in`
          : `${employee.fullName} archived. Their sales history is kept`,
    )
  }

  return (
    <>
      <Button variant="link" size="sm" className="h-auto px-0" asChild>
        <Link to={paths.personnel.employees}>
          <ArrowLeft />
          Employees
        </Link>
      </Button>

      <PageHeader
        title={employee.fullName}
        description={`${employee.roleName} · ${employee.locationName ?? 'All locations'}`}
        action={
          canEdit ? (
            <div className="flex items-center gap-2">
              {employee.status === 'active' ? (
                <Button variant="secondary" onClick={() => setConfirming('suspended')}>
                  <Ban />
                  Suspend
                </Button>
              ) : employee.status === 'suspended' ? (
                <Button variant="secondary" onClick={() => changeStatus('active')}>
                  <Play />
                  Reinstate
                </Button>
              ) : null}
              {employee.status !== 'archived' ? (
                <Button variant="secondary" onClick={() => setConfirming('archived')}>
                  <Archive />
                  Archive
                </Button>
              ) : (
                <Button variant="secondary" onClick={() => changeStatus('active')}>
                  <Play />
                  Bring back
                </Button>
              )}
              <Button variant="primary" asChild>
                <Link to={paths.personnel.editEmployee(employee.id)}>
                  <Pencil />
                  Edit
                </Link>
              </Button>
            </div>
          ) : null
        }
        below={
          <div className="flex flex-wrap items-center gap-2">
            <Avatar name={employee.fullName} src={employee.avatarUrl} size="sm" />
            <Badge tone={employeeStatusTone(employee.status)}>
              {employeeStatusLabel(employee.status)}
            </Badge>
            {employee.phone ? (
              <span className="text-fg-muted text-sm tabular-nums">{employee.phone}</span>
            ) : null}
            {employee.email ? (
              <span className="text-fg-subtle text-sm">· {employee.email}</span>
            ) : null}
            {employee.dormant ? (
              <span className="text-warning text-2xs">
                ·{' '}
                {quiet === null
                  ? 'has never signed in'
                  : `no sign-in for ${formatNumber(quiet)} days`}
              </span>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Figure
          label="Sold this month"
          value={formatMoney(Math.round(stats.revenueThisMonth))}
          meta={`${formatNumber(stats.salesThisMonth)} sales`}
        />
        <Figure
          label="Sold all time"
          value={formatMoney(Math.round(stats.revenue))}
          meta={`${formatNumber(stats.sales)} sales · ${formatNumber(stats.units)} units`}
        />
        <Figure
          label="Average check"
          value={stats.sales ? formatMoney(Math.round(stats.averageCheck)) : '—'}
          meta={stats.sales ? 'across every sale they made' : 'no sales yet'}
        />
        <Figure
          label="Margin brought in"
          value={stats.revenue ? formatPercent(stats.marginRatio) : '—'}
          meta={
            stats.revenue
              ? `${formatMoney(Math.round(stats.margin))} — estimated at today's costs`
              : 'no sales yet'
          }
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent sales</CardTitle>
          </CardHeader>
          <CardBody className="p-0">
            {recentSales.length === 0 ? (
              <p className="text-fg-subtle p-4 text-sm">
                {employee.roleName === 'Seller'
                  ? 'They have not taken a sale yet.'
                  : 'This role does not usually take sales.'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-canvas">
                    <tr className="text-fg-muted text-2xs tracking-wide uppercase">
                      <th className="px-4 py-2 text-left font-semibold">Sale</th>
                      <th className="px-4 py-2 text-left font-semibold">Client</th>
                      <th className="px-4 py-2 text-left font-semibold">Where</th>
                      <th className="px-4 py-2 text-right font-semibold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentSales.map((sale) => (
                      <tr
                        key={sale.id}
                        className="border-border hover:bg-surface-inset cursor-pointer border-t"
                        onClick={() => navigate(paths.sales.orderDetail(sale.id))}
                      >
                        <td className="px-4 py-2">
                          <p className="text-2xs font-mono">{sale.number}</p>
                          <p className="text-fg-subtle text-2xs">{formatDate(sale.createdAt)}</p>
                        </td>
                        <td className="text-fg-muted px-4 py-2">{sale.clientName ?? 'Walk-in'}</td>
                        <td className="text-fg-muted px-4 py-2">{sale.locationName}</td>
                        <td className="text-fg px-4 py-2 text-right font-medium tabular-nums">
                          {formatMoney(Math.round(sale.total))}
                        </td>
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
            <CardTitle>Record</CardTitle>
          </CardHeader>
          <CardBody className="space-y-2 text-sm">
            <Row label="Role" value={employee.roleName} />
            <Row label="Works at" value={employee.locationName ?? 'All locations'} />
            <Row label="Hired" value={formatDate(employee.hiredAt)} />
            <Row
              label="Last signed in"
              value={
                employee.lastActiveAt ? formatDateTime(employee.lastActiveAt) : 'Never signed in'
              }
            />
            {canEdit ? (
              <Row
                label="Base pay"
                value={employee.salary === null ? '—' : `${formatMoney(employee.salary)} /mo`}
              />
            ) : null}
            {employee.comment ? <Row label="Note" value={employee.comment} /> : null}
          </CardBody>
        </Card>
      </div>

      {canEdit ? (
        <WalletPanel
          wallet={{
            ownerId: employee.id,
            ownerType: 'employee',
            balance,
            cashback: 0,
            debt: owedByThem,
            creditLimit: null,
            currency: 'UZS',
            updatedAt: employee.updatedAt,
          }}
          transactions={walletTransactions}
          showCashback={false}
          // Owing someone their salary is not a warning sign.
          balanceIsAlarming={false}
          labels={{
            balance: balance >= 0 ? 'We owe them' : 'They owe us',
            debt: 'Advances outstanding',
            ledgerEmpty: 'No salary or advances have been recorded for this person yet.',
          }}
          insights={
            owedByThem > 0
              ? [
                  {
                    id: 'advance',
                    title: 'An advance is still outstanding',
                    body: `${formatMoney(owedByThem)} was taken against pay that has not been earned yet. It comes off the next payroll run unless someone writes it off.`,
                    tone: 'neutral',
                    generatedAt: new Date().toISOString(),
                  },
                ]
              : []
          }
        />
      ) : null}

      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open) setConfirming(null)
        }}
        title={
          confirming === 'archived'
            ? `Archive ${employee.fullName}?`
            : `Suspend ${employee.fullName}?`
        }
        body={
          confirming === 'archived'
            ? 'They stop appearing in the active list and cannot sign in. Every sale they made stays exactly as it is.'
            : `They cannot sign in until someone reinstates them. Use this for leave or while something is being looked into — nothing about their history changes.`
        }
        confirmLabel={confirming === 'archived' ? 'Archive' : 'Suspend'}
        destructive
        onConfirm={() => confirming && changeStatus(confirming)}
      />
    </>
  )
}

function Figure({ label, value, meta }: { label: string; value: string; meta: string }) {
  return (
    <Card className="p-4">
      <p className="text-fg-muted text-sm">{label}</p>
      <p className="text-fg mt-0.5 text-lg font-semibold">{value}</p>
      <p className="text-fg-subtle text-2xs">{meta}</p>
    </Card>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-fg-muted">{label}</span>
      <span className="text-fg text-right font-medium">{value}</span>
    </div>
  )
}
