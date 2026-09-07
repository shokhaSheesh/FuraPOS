import { Archive, CheckCircle2, Layers } from 'lucide-react'
import { Card } from '@/shared/ui/Card'
import { Skeleton } from '@/shared/ui/Skeleton'
import { formatNumber } from '@/shared/lib/format'
import type { CatalogSummary } from '../api/products'

/**
 * What the catalogue holds, in the three states a product can be in.
 *
 * Everything counts variations, because that is what the table lists and what
 * carries a price and a barcode; the first tile's meta line is the only place
 * the product count appears, since "185 things to sell across 137 parts" is a
 * different fact from either number alone.
 *
 * The tiles follow the active filters, the location scope included — so at one
 * warehouse they describe that warehouse, not the business.
 */
export function ProductsSummaryStrip({
  summary,
  loading,
}: {
  summary?: CatalogSummary
  loading?: boolean
}) {
  if (loading || !summary) {
    return (
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
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
      icon: Layers,
      label: 'All products',
      value: formatNumber(summary.total),
      meta: `across ${formatNumber(summary.products)} products`,
    },
    {
      icon: CheckCircle2,
      label: 'Active',
      value: formatNumber(summary.active),
      meta: 'on sale',
    },
    {
      icon: Archive,
      label: 'Archived',
      value: formatNumber(summary.archived),
      meta: 'hidden from sale',
    },
  ]

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {tiles.map((tile) => (
        <Card key={tile.label} className="flex items-start gap-3 p-4">
          <span className="bg-surface-inset text-fg-muted mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full">
            <tile.icon className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-fg-muted text-sm">{tile.label}</p>
            <p className="text-fg mt-0.5 text-lg font-semibold">{tile.value}</p>
            <p className="text-fg-subtle text-2xs">{tile.meta}</p>
          </div>
        </Card>
      ))}
    </div>
  )
}
