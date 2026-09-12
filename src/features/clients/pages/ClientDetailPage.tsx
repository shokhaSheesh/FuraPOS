import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft, Ban, Building2, Pencil, Play, User } from 'lucide-react'
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
import { formatDate, formatDateTime, formatMoney, formatNumber } from '@/shared/lib/format'
import { useDataStore } from '@/data/store'
import { useClient, useClientActions, useClientSales } from '../api/clients'
import { clientStatusLabel, clientStatusTone, daysSinceLastSale } from '../model/client'

export default function ClientDetailPage() {
  const { clientId } = useParams()
  const navigate = useNavigate()
  const { can } = useSession()
  const { data: client } = useClient(clientId)
  const recentSales = useClientSales(clientId)
  const actions = useClientActions()
  const allWalletTransactions = useDataStore((s) => s.walletTransactions)
  // Filtering inside the selector would hand Zustand a new array every render.
  const walletTransactions = useMemo(
    () => allWalletTransactions.filter((t) => t.ownerType === 'client' && t.ownerId === clientId),
    [allWalletTransactions, clientId],
  )
  const [blocking, setBlocking] = useState(false)

  if (!client) {
    return (
      <EmptyState
        title="No such autopark"
        action={
          <Button variant="secondary" asChild>
            <Link to={paths.marketing.autoparks}>Back to autoparks</Link>
          </Button>
        }
      />
    )
  }

  const { stats } = client
  const quiet = daysSinceLastSale(stats)
  const canEdit = can('marketing.clients.edit')

  return (
    <>
      <Button variant="link" size="sm" className="h-auto px-0" asChild>
        <Link to={paths.marketing.autoparks}>
          <ArrowLeft />
          Autoparks
        </Link>
      </Button>

      <PageHeader
        title={client.name}
        description={client.type === 'business' ? 'Business account' : 'Individual buyer'}
        action={
          canEdit ? (
            <div className="flex items-center gap-2">
              {client.status === 'active' ? (
                <Button variant="secondary" onClick={() => setBlocking(true)}>
                  <Ban />
                  Block
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  onClick={() => {
                    actions.setStatus(client.id, 'active')
                    toast.success(`${client.name} can buy on account again`)
                  }}
                >
                  <Play />
                  Unblock
                </Button>
              )}
              <Button variant="primary" asChild>
                <Link to={paths.marketing.editAutopark(client.id)}>
                  <Pencil />
                  Edit
                </Link>
              </Button>
            </div>
          ) : null
        }
        below={
          <div className="flex flex-wrap items-center gap-2">
            <span className="bg-surface-inset text-fg-muted flex size-7 shrink-0 items-center justify-center rounded-full">
              {client.type === 'business' ? (
                <Building2 className="size-3.5" />
              ) : (
                <User className="size-3.5" />
              )}
            </span>
            <Badge tone={clientStatusTone(client.status)}>{clientStatusLabel(client.status)}</Badge>
            {client.overLimit ? <Badge tone="danger">Over credit limit</Badge> : null}
            {client.phone ? (
              <span className="text-fg-muted text-sm tabular-nums">{client.phone}</span>
            ) : null}
            {client.email ? <span className="text-fg-subtle text-sm">· {client.email}</span> : null}
            {client.dormant ? (
              <span className="text-warning text-2xs">
                · last bought {formatNumber(quiet ?? 0)} days ago
              </span>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Figure
          label="Owes us"
          value={client.debt > 0 ? formatMoney(client.debt) : 'Nothing'}
          meta={
            client.creditLimit === null
              ? 'no account — pays up front'
              : client.overLimit
                ? `${formatMoney(client.debt - client.creditLimit)} over the limit`
                : `${formatMoney(client.headroom ?? 0)} of credit left`
          }
          tone={client.overLimit ? 'danger' : undefined}
        />
        <Figure
          label="Bought all time"
          value={formatMoney(Math.round(stats.revenue))}
          meta={`${formatNumber(stats.sales)} sales · ${formatNumber(stats.units)} units`}
        />
        <Figure
          label="Average check"
          value={stats.sales ? formatMoney(Math.round(stats.averageCheck)) : '—'}
          meta={stats.sales ? 'across every sale' : 'has not bought yet'}
        />
        <Figure
          label="Different products"
          value={formatNumber(stats.products)}
          meta="how broad the relationship is"
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent sales</CardTitle>
          </CardHeader>
          <CardBody className="p-0">
            {recentSales.length === 0 ? (
              <p className="text-fg-subtle p-4 text-sm">They have not bought anything yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-canvas">
                    <tr className="text-fg-muted text-2xs tracking-wide uppercase">
                      <th className="px-4 py-2 text-left font-semibold">Sale</th>
                      <th className="px-4 py-2 text-left font-semibold">Seller</th>
                      <th className="px-4 py-2 text-right font-semibold">Total</th>
                      <th className="px-4 py-2 text-right font-semibold">Still owed</th>
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
                        <td className="text-fg-muted px-4 py-2">{sale.sellerName}</td>
                        <td className="text-fg px-4 py-2 text-right font-medium tabular-nums">
                          {formatMoney(Math.round(sale.total))}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {sale.debt > 0 ? (
                            <span className="text-danger">
                              {formatMoney(Math.round(sale.debt))}
                            </span>
                          ) : (
                            <span className="text-fg-subtle">Paid</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Record</CardTitle>
          </CardHeader>
          <CardBody className="space-y-2 text-sm">
            <Row label="Type" value={client.type === 'business' ? 'Business' : 'Person'} />
            <Row
              label="Credit limit"
              value={
                client.creditLimit === null ? 'Pays up front' : formatMoney(client.creditLimit)
              }
            />
            <Row label="Client since" value={formatDate(client.createdAt)} />
            <Row
              label="Last bought"
              value={stats.lastSaleAt ? formatDateTime(stats.lastSaleAt) : 'Never'}
            />
            {client.address ? <Row label="Address" value={client.address} /> : null}
            {client.comment ? <Row label="Note" value={client.comment} /> : null}
          </CardBody>
        </Card>
      </div>

      <WalletPanel
        wallet={{
          ownerId: client.id,
          ownerType: 'client',
          balance: client.debt,
          cashback: client.cashback,
          debt: client.debt,
          creditLimit: client.creditLimit,
          currency: 'UZS',
          updatedAt: client.updatedAt,
        }}
        transactions={walletTransactions}
        labels={{
          balance: 'They owe us',
          debt: 'On account',
          ledgerEmpty:
            'No credit or payments have been recorded against this client yet. Sales paid up front do not appear here.',
        }}
        insights={
          client.overLimit
            ? [
                {
                  id: 'over-limit',
                  title: 'They are past their credit limit',
                  body: `${formatMoney(client.debt)} outstanding against a limit of ${formatMoney(
                    client.creditLimit ?? 0,
                  )}. Another sale on account takes them further out, and the limit exists because somebody once decided this is as far as they should go.`,
                  tone: 'risk',
                  generatedAt: new Date().toISOString(),
                },
              ]
            : []
        }
      />

      <ConfirmDialog
        open={blocking}
        onOpenChange={setBlocking}
        title={`Block ${client.name}?`}
        body="They stop appearing as a choice on a new sale. Nothing about their history or their debt changes, and you can unblock them at any time."
        confirmLabel="Block"
        destructive
        onConfirm={() => {
          actions.setStatus(client.id, 'blocked')
          setBlocking(false)
          toast.success(`${client.name} blocked`)
        }}
      />
    </>
  )
}

function Figure({
  label,
  value,
  meta,
  tone,
}: {
  label: string
  value: string
  meta: string
  tone?: 'danger'
}) {
  return (
    <Card className="p-4">
      <p className="text-fg-muted text-sm">{label}</p>
      <p
        className={`mt-0.5 text-lg font-semibold ${tone === 'danger' ? 'text-danger' : 'text-fg'}`}
      >
        {value}
      </p>
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
