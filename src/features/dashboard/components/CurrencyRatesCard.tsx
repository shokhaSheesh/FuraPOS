import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Skeleton } from '@/shared/ui/Skeleton'
import { formatNumber } from '@/shared/lib/format'
import type { DashboardSummary } from '../api/summary'

/**
 * OX parity. It pages through one currency at a time behind arrows; all three
 * fit at once, so there is nothing to click through.
 */
export function CurrencyRatesCard({
  rates,
  loading,
}: {
  rates: DashboardSummary['currencyRates']
  loading?: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Exchange rates</CardTitle>
      </CardHeader>
      <CardBody>
        {loading ? (
          <Skeleton className="h-16 w-full" />
        ) : (
          <ul className="divide-border divide-y">
            {rates.map((rate) => (
              <li key={rate.code} className="flex items-baseline justify-between py-2 first:pt-0">
                <span className="text-fg-muted text-sm">1 {rate.code}</span>
                <span className="text-sm font-medium tabular-nums">
                  {formatNumber(rate.rate)} {rate.base}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  )
}
