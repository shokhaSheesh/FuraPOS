import { useState } from 'react'
import { Link } from 'react-router'
import { PageHeader } from '@/shared/components/PageHeader'
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Button } from '@/shared/ui/Button'
import { paths } from '@/shared/config/paths'
import { formatMoney, formatNumber, formatPercent } from '@/shared/lib/format'
import { useDashboardSummary, type DashboardPeriod } from '../api/summary'
import type { DateRange } from '@/shared/ui/DateRangePicker'
import { PeriodFilter } from '../components/PeriodFilter'
import { StatCard } from '../components/StatCard'
import { ChartLegend, RevenueByLocationChart } from '../components/RevenueByLocationChart'
import { CashShiftsCard } from '../components/CashShiftsCard'
import { CurrencyRatesCard } from '../components/CurrencyRatesCard'
import { TopProductsCard } from '../components/TopProductsCard'
import { AttentionCard } from '../components/AttentionCard'

/**
 * Read-only overview. Every number links out to the screen that owns it — the
 * dashboard never becomes a place where you edit things.
 *
 * Mirrors OX's dashboard (see docs/OX-NAVIGATION-MAP.md) with three
 * differences, all deliberate and listed in CLAUDE.md: every widget obeys one
 * period filter, three retail KPIs are added, and OX's welcome banner is
 * replaced by "Needs attention".
 */
export default function DashboardPage() {
  const [period, setPeriod] = useState<DashboardPeriod>('today')
  const [range, setRange] = useState<DateRange>({ from: null, to: null })
  const { data, isLoading } = useDashboardSummary(period, range)
  const loading = isLoading && !data

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
        below={
          <PeriodFilter
            period={period}
            range={range}
            onChange={(nextPeriod, nextRange) => {
              setPeriod(nextPeriod)
              setRange(nextRange)
            }}
          />
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Revenue"
          value={data ? formatMoney(data.revenue.value) : '—'}
          change={data?.revenue.change}
          comparedTo={data?.comparedTo}
          loading={loading}
        />
        <StatCard
          label="Sales"
          value={data ? formatNumber(data.salesCount.value) : '—'}
          change={data?.salesCount.change}
          comparedTo={data?.comparedTo}
          loading={loading}
        />
        <StatCard
          label="Average check"
          value={data ? formatMoney(data.averageCheck.value) : '—'}
          change={data?.averageCheck.change}
          comparedTo={data?.comparedTo}
          loading={loading}
        />
        <StatCard
          label="Gross margin"
          value={data ? formatPercent(data.grossMargin.value) : '—'}
          change={data?.grossMargin.change}
          comparedTo={data?.comparedTo}
          loading={loading}
        />
        <StatCard
          label="Visitors"
          value={data ? formatNumber(data.visitors.value) : '—'}
          change={data?.visitors.change}
          comparedTo={data?.comparedTo}
          loading={loading}
        />
        <StatCard
          label="New clients"
          value={data ? formatNumber(data.newClients.value) : '—'}
          change={data?.newClients.change}
          comparedTo={data?.comparedTo}
          loading={loading}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>
              Revenue by location&ensp;<span className="text-fg-subtle font-normal">UZS</span>
            </CardTitle>
            {data ? <ChartLegend locations={data.locations} data={data.revenueByLocation} /> : null}
          </CardHeader>
          <CardBody>
            <RevenueByLocationChart
              data={data?.revenueByLocation ?? []}
              locations={data?.locations ?? []}
              loading={loading}
            />
          </CardBody>
        </Card>

        <AttentionCard attention={data?.attention ?? EMPTY_ATTENTION} loading={loading} />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TopProductsCard products={data?.topProducts ?? []} loading={loading} />
        </div>
        <div className="space-y-3">
          <CashShiftsCard shifts={data?.cashShifts ?? []} loading={loading} />
          <CurrencyRatesCard rates={data?.currencyRates ?? []} loading={loading} />
        </div>
      </div>
    </>
  )
}

const EMPTY_ATTENTION = { outOfStock: 0, lowStock: 0, overduePayables: 0, draftSales: 0 }
