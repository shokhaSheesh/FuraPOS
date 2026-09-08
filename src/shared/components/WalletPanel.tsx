import { Sparkles, Wallet as WalletIcon } from 'lucide-react'
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Badge } from '@/shared/ui/Badge'
import { Tabs } from '@/shared/ui/Tabs'
import { EmptyState } from '@/shared/components/EmptyState'
import { formatDateTime, formatMoney } from '@/shared/lib/format'
import { cn } from '@/shared/lib/cn'
import type { Wallet, WalletInsight, WalletTransaction } from '@/shared/types/wallet'

/**
 * The wallet sub-view, built once for all three owners.
 *
 * CLAUDE.md is explicit that clients, employees and suppliers get the *same*
 * wallet rather than three bespoke screens, so everything here is
 * owner-agnostic: the component knows about balances and movements, never
 * about what kind of thing owns them. The only concession is `labels`, because
 * "we owe them" and "they owe us" are opposite sentences about the same number.
 */
export interface WalletLabels {
  /** What a positive balance means here, e.g. "We owe" or "In credit". */
  balance: string
  /** What the debt figure means, e.g. "Outstanding" or "On account". */
  debt: string
  ledgerEmpty: string
}

const KIND_LABELS: Record<WalletTransaction['kind'], string> = {
  topup: 'Top-up',
  withdrawal: 'Withdrawal',
  purchase: 'Purchase',
  refund: 'Refund',
  cashback_earned: 'Cashback earned',
  cashback_spent: 'Cashback spent',
  debt_charged: 'Charged',
  debt_repaid: 'Paid',
  adjustment: 'Adjustment',
}

export function WalletPanel({
  wallet,
  transactions,
  insights = [],
  labels,
  action,
  showCashback = true,
  balanceIsAlarming = true,
}: {
  wallet: Wallet
  transactions: WalletTransaction[]
  insights?: WalletInsight[]
  labels: WalletLabels
  /** The one thing this owner can do — record a payment, add credit. */
  action?: React.ReactNode
  /** Suppliers have no cashback; clients do. */
  showCashback?: boolean
  /**
   * Whether a positive balance is a problem. True for a supplier, where it is
   * money owed and often overdue; false for an employee, where it is this
   * month's salary and entirely routine. The component cannot know which.
   */
  balanceIsAlarming?: boolean
}) {
  return (
    <Card>
      <CardHeader className="flex-col items-stretch gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <span className="bg-surface-inset text-fg-muted flex size-8 shrink-0 items-center justify-center rounded-full">
            <WalletIcon className="size-4" />
          </span>
          <div>
            <CardTitle>Wallet</CardTitle>
            <p className="text-fg-subtle text-2xs">Updated {formatDateTime(wallet.updatedAt)}</p>
          </div>
        </div>
        {action}
      </CardHeader>

      <CardBody className="space-y-4">
        <div
          className={cn(
            'grid gap-3',
            showCashback ? 'sm:grid-cols-3' : 'sm:grid-cols-2',
            wallet.creditLimit !== null && 'lg:grid-cols-4',
          )}
        >
          <Figure
            label={labels.balance}
            value={formatMoney(Math.abs(wallet.balance))}
            tone={balanceIsAlarming && wallet.balance > 0 ? 'danger' : undefined}
          />
          <Figure
            label={labels.debt}
            value={formatMoney(wallet.debt)}
            tone={wallet.debt > 0 ? 'danger' : undefined}
          />
          {showCashback ? <Figure label="Cashback" value={formatMoney(wallet.cashback)} /> : null}
          {wallet.creditLimit !== null ? (
            <Figure label="Credit limit" value={formatMoney(wallet.creditLimit)} />
          ) : null}
        </div>

        <Tabs
          items={[
            {
              value: 'ledger',
              label: 'Movements',
              badge: transactions.length || undefined,
              content:
                transactions.length === 0 ? (
                  <p className="text-fg-subtle py-4 text-center text-sm">{labels.ledgerEmpty}</p>
                ) : (
                  <div className="border-border rounded-card overflow-x-auto border">
                    <table className="w-full text-sm">
                      <thead className="bg-canvas">
                        <tr className="text-fg-muted text-2xs tracking-wide uppercase">
                          <th className="px-3 py-2 text-left font-semibold">When</th>
                          <th className="px-3 py-2 text-left font-semibold">What</th>
                          <th className="px-3 py-2 text-right font-semibold">Amount</th>
                          <th className="px-3 py-2 text-right font-semibold">Balance after</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.map((entry) => (
                          <tr key={entry.id} className="border-border border-t">
                            <td className="text-fg-muted px-3 py-2">
                              {formatDateTime(entry.createdAt)}
                            </td>
                            <td className="px-3 py-2">
                              <span className="text-fg">{KIND_LABELS[entry.kind]}</span>
                              {entry.comment ? (
                                <span className="text-fg-subtle text-2xs ml-2">
                                  {entry.comment}
                                </span>
                              ) : null}
                            </td>
                            <td
                              className={cn(
                                'px-3 py-2 text-right font-medium tabular-nums',
                                // Money going out of the debt is the good
                                // direction, so a payment reads green.
                                entry.amount < 0 ? 'text-success' : 'text-fg',
                              )}
                            >
                              {entry.amount < 0 ? '−' : '+'}
                              {formatMoney(Math.abs(entry.amount))}
                            </td>
                            <td className="text-fg-muted px-3 py-2 text-right tabular-nums">
                              {formatMoney(entry.balanceAfter)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ),
            },
            {
              value: 'insights',
              label: 'Insights',
              badge: insights.length || undefined,
              content:
                insights.length === 0 ? (
                  <EmptyState
                    title="Nothing to say yet"
                    description="Insights appear once there is enough history to notice a pattern."
                  />
                ) : (
                  <div className="space-y-2">
                    {insights.map((insight) => (
                      <div key={insight.id} className="border-border rounded-card border p-3">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-fg flex items-center gap-2 text-sm font-medium">
                            <Sparkles className="text-fg-subtle size-3.5" />
                            {insight.title}
                          </p>
                          <Badge
                            tone={
                              insight.tone === 'risk'
                                ? 'danger'
                                : insight.tone === 'positive'
                                  ? 'success'
                                  : 'neutral'
                            }
                          >
                            {insight.tone === 'risk'
                              ? 'Worth watching'
                              : insight.tone === 'positive'
                                ? 'Good'
                                : 'Note'}
                          </Badge>
                        </div>
                        <p className="text-fg-muted mt-1 text-sm">{insight.body}</p>
                      </div>
                    ))}
                  </div>
                ),
            },
          ]}
        />
      </CardBody>
    </Card>
  )
}

function Figure({ label, value, tone }: { label: string; value: string; tone?: 'danger' }) {
  return (
    <div className="border-border rounded-card border p-3">
      <p className="text-fg-muted text-sm">{label}</p>
      <p
        className={cn(
          'mt-0.5 text-lg font-semibold tabular-nums',
          tone === 'danger' ? 'text-danger' : 'text-fg',
        )}
      >
        {value}
      </p>
    </div>
  )
}
