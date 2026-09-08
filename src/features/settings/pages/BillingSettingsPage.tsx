import { CreditCard, Wallet } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/components/EmptyState'
import { toast } from '@/shared/ui/toast'
import { formatDate, formatMoney } from '@/shared/lib/format'
import { useDataStore } from '@/data/store'

/**
 * Billing.
 *
 * The one screen here that is about the software rather than the business: what
 * the account owes for using it. Kept because the balance already sits in the
 * top bar and a number with no page behind it is a dead end.
 *
 * There is no payment processing anywhere in this build (CLAUDE.md), so "Top
 * up" is honest about being a hand-off rather than pretending to take a card.
 */
const INVOICES = [
  { number: 'BILL-2026-0007', description: 'Fura Pro — September', amount: 250_000, paid: true },
  { number: 'BILL-2026-0006', description: 'Fura Pro — August', amount: 250_000, paid: true },
  { number: 'BILL-2026-0005', description: 'Fura Pro — July', amount: 250_000, paid: true },
]

export default function BillingSettingsPage() {
  const company = useDataStore((s) => s.company)
  const balance = 1_250_000
  const monthly = 250_000
  const monthsLeft = Math.floor(balance / monthly)

  return (
    <>
      <PageHeader
        title="Billing"
        description="What this account pays to use the software, and what is left on the balance."
      />

      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Balance</CardTitle>
          </CardHeader>
          <CardBody className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-fg text-2xl font-semibold">{formatMoney(balance)}</p>
              {/* More useful than a date: "how long until this stops working". */}
              <p className="text-fg-subtle text-2xs">
                About {monthsLeft} months at {formatMoney(monthly)} a month
              </p>
            </div>
            <Button
              variant="primary"
              onClick={() =>
                toast.success('Top-up request sent — finance will confirm the transfer')
              }
            >
              <Wallet />
              Top up
            </Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Plan</CardTitle>
          </CardHeader>
          <CardBody className="space-y-2 text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-fg-muted">Fura Pro</span>
              <Badge tone="success">Active</Badge>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-fg-muted">Monthly</span>
              <span className="text-fg font-medium">{formatMoney(monthly)}</span>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-fg-muted">Company</span>
              <span className="text-fg font-medium">{company.name}</span>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-fg-muted">Next charge</span>
              <span className="text-fg font-medium">
                {formatDate(new Date(Date.now() + 21 * 86_400_000).toISOString())}
              </span>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {INVOICES.length === 0 ? (
            <EmptyState icon={CreditCard} title="No invoices yet" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-canvas">
                  <tr className="text-fg-muted text-2xs tracking-wide uppercase">
                    <th className="px-4 py-2 text-left font-semibold">Invoice</th>
                    <th className="px-4 py-2 text-left font-semibold">For</th>
                    <th className="px-4 py-2 text-right font-semibold">Amount</th>
                    <th className="px-4 py-2 text-right font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {INVOICES.map((invoice) => (
                    <tr key={invoice.number} className="border-border border-t">
                      <td className="text-2xs px-4 py-2 font-mono">{invoice.number}</td>
                      <td className="text-fg-muted px-4 py-2">{invoice.description}</td>
                      <td className="text-fg px-4 py-2 text-right font-medium tabular-nums">
                        {formatMoney(invoice.amount)}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Badge tone={invoice.paid ? 'success' : 'warning'}>
                          {invoice.paid ? 'Paid' : 'Due'}
                        </Badge>
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
