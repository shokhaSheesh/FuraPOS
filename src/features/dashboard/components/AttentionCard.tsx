import { Link } from 'react-router'
import { AlertTriangle, ChevronRight, PackageX, ReceiptText, TrendingDown } from 'lucide-react'
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Skeleton } from '@/shared/ui/Skeleton'
import { EmptyState } from '@/shared/components/EmptyState'
import { paths } from '@/shared/config/paths'
import { cn } from '@/shared/lib/cn'
import type { DashboardSummary } from '../api/summary'

/**
 * Replaces OX's welcome banner, which spends the best space on the page on a
 * gradient, the viewer's own name and a clock. This is the same real estate
 * answering "what needs me today?" — every row is a count and a link to the
 * screen that clears it.
 */
export function AttentionCard({
  attention,
  loading,
}: {
  attention: DashboardSummary['attention']
  loading?: boolean
}) {
  const rows = [
    {
      key: 'outOfStock',
      icon: PackageX,
      tone: 'danger' as const,
      count: attention?.outOfStock ?? 0,
      label: 'products out of stock',
      to: paths.products.list,
    },
    {
      key: 'lowStock',
      icon: TrendingDown,
      tone: 'warning' as const,
      count: attention?.lowStock ?? 0,
      label: 'products below their reorder point',
      to: paths.procurement.selection,
    },
    {
      key: 'payables',
      icon: AlertTriangle,
      tone: 'danger' as const,
      count: attention?.overduePayables ?? 0,
      label: 'overdue supplier payments',
      to: paths.finance.payables,
    },
    {
      key: 'drafts',
      icon: ReceiptText,
      tone: 'warning' as const,
      count: attention?.draftSales ?? 0,
      label: 'sales left open',
      to: paths.sales.ordersByStatus('open'),
    },
  ].filter((row) => row.count > 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Needs attention</CardTitle>
      </CardHeader>
      <CardBody>
        {loading ? (
          <div className="space-y-2.5">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState title="Nothing needs you" description="No alerts across your locations." />
        ) : (
          <ul className="divide-border divide-y">
            {rows.map((row) => (
              <li key={row.key}>
                <Link
                  to={row.to}
                  className="hover:bg-surface-muted -mx-2 flex items-center gap-2.5 rounded px-2 py-2.5"
                >
                  <row.icon
                    className={cn(
                      'size-4 shrink-0',
                      row.tone === 'danger' ? 'text-danger' : 'text-warning',
                    )}
                  />
                  <span className="text-fg text-sm font-semibold tabular-nums">{row.count}</span>
                  <span className="text-fg-muted flex-1 text-sm">{row.label}</span>
                  <ChevronRight className="text-fg-subtle size-4 shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  )
}
