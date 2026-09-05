import { Banknote, HandCoins, Truck, Users } from 'lucide-react'
import { Card } from '@/shared/ui/Card'
import { Skeleton } from '@/shared/ui/Skeleton'
import { formatMoney, formatNumber } from '@/shared/lib/format'
import type { SalesSummary } from '../api/sales'

/**
 * The strip above the table, mirroring OX's summary cards. It answers the same
 * filters as the list, so the figures always describe exactly the rows on
 * screen — a summary that describes a different set than the table below it is
 * worse than no summary.
 *
 * OX also carries Returns and Exchanges cards; we have neither concept yet, so
 * showing two permanently-zero cards would be noise.
 */
export function SalesSummaryStrip({
  summary,
  loading,
}: {
  summary?: SalesSummary
  loading?: boolean
}) {
  if (loading || !summary) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} className="space-y-2 p-4">
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-6 w-28" />
          </Card>
        ))}
      </div>
    )
  }

  const tiles = [
    {
      icon: Banknote,
      label: 'Sales',
      value: formatMoney(summary.total),
      meta: `${formatNumber(summary.count)} sales · ${formatNumber(summary.units)} items`,
      tone: undefined,
    },
    {
      icon: HandCoins,
      label: 'Debt',
      value: formatMoney(summary.debtTotal),
      meta: `${formatNumber(summary.debtCount)} unpaid`,
      tone: summary.debtTotal > 0 ? ('danger' as const) : undefined,
    },
    {
      icon: Truck,
      label: 'Delivery',
      value: formatMoney(summary.deliveryTotal),
      meta: `${formatNumber(summary.deliveryCount)} to deliver`,
      tone: undefined,
    },
    {
      icon: Users,
      label: 'People',
      value: `${formatNumber(summary.clients)} / ${formatNumber(summary.sellers)}`,
      meta: 'clients / sellers',
      tone: undefined,
    },
  ]

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {tiles.map((tile) => (
        <Card key={tile.label} className="flex items-start gap-3 p-4">
          <span className="bg-surface-inset text-fg-muted mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full">
            <tile.icon className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-fg-muted text-sm">{tile.label}</p>
            <p
              className={
                tile.tone === 'danger'
                  ? 'text-danger mt-0.5 text-lg font-semibold'
                  : 'text-fg mt-0.5 text-lg font-semibold'
              }
            >
              {tile.value}
            </p>
            <p className="text-fg-subtle text-2xs">{tile.meta}</p>
          </div>
        </Card>
      ))}
    </div>
  )
}
