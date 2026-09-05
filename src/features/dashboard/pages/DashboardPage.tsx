import { Link } from 'react-router'
import { PageHeader } from '@/shared/components/PageHeader'
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Button } from '@/shared/ui/Button'
import { formatMoney, formatNumber, formatPercent } from '@/shared/lib/format'
import { paths } from '@/shared/config/paths'
import { useDashboardSummary } from '../api/summary'
import { StatCard } from '../components/StatCard'

/**
 * Read-only overview. Every number here links out to the screen that owns it —
 * the dashboard never becomes a place where you edit things.
 */
export default function DashboardPage() {
  const { data, isLoading } = useDashboardSummary()

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Today at a glance, across all locations."
        action={
          <Button variant="primary" asChild>
            <Link to={paths.sales.newSale}>Open POS terminal</Link>
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Revenue today"
          value={data ? formatMoney(data.revenueToday) : '—'}
          change={data?.revenueChange}
          loading={isLoading}
        />
        <StatCard
          label="Sales"
          value={data ? formatNumber(data.salesCount) : '—'}
          change={data?.salesCountChange}
          loading={isLoading}
        />
        <StatCard
          label="Average check"
          value={data ? formatMoney(data.averageCheck) : '—'}
          change={data?.averageCheckChange}
          loading={isLoading}
        />
        <StatCard
          label="Gross margin"
          value={data ? formatPercent(data.grossMargin) : '—'}
          change={data?.grossMarginChange}
          loading={isLoading}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Revenue, last 14 days</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="text-fg-muted py-12 text-center text-sm">
              Revenue vs. cost chart — series colours and rules are defined in docs/DESIGN_RULES.md
              § 9. Data is already served by{' '}
              <code className="font-mono">/api/dashboard/summary</code>.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top products</CardTitle>
            <Button variant="link" size="sm" asChild>
              <Link to={paths.analytics.sales}>Full report</Link>
            </Button>
          </CardHeader>
          <CardBody className="space-y-2">
            {data?.topProducts.map((product) => (
              <div key={product.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-fg truncate">{product.name}</span>
                <span className="text-fg-muted shrink-0 tabular-nums">
                  {formatMoney(product.revenue)}
                </span>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>
    </>
  )
}
