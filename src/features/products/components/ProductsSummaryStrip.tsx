import { Boxes, Image, PackageX, Wallet } from 'lucide-react'
import { Card } from '@/shared/ui/Card'
import { Skeleton } from '@/shared/ui/Skeleton'
import { formatMoney, formatNumber, formatPercent } from '@/shared/lib/format'
import type { CatalogSummary } from '../api/products'

/**
 * Mirrors OX's strip above the catalogue. Stock is valued twice — at what we
 * will sell it for and at what we paid — because for an importer those are
 * different currencies, and the gap between them is the working capital
 * question the strip exists to answer.
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

  const margin =
    summary.saleValue > 0 ? (summary.saleValue - summary.costValue) / summary.saleValue : 0

  const tiles = [
    {
      icon: Boxes,
      label: 'In stock',
      value: formatNumber(summary.quantity),
      meta: `${formatNumber(summary.total)} variations across ${formatNumber(summary.products)} products`,
    },
    {
      icon: Wallet,
      label: 'Stock value',
      value: formatMoney(summary.saleValue),
      meta: `${formatMoney(summary.costValue)} at cost · ${formatPercent(margin)} margin`,
    },
    {
      icon: PackageX,
      label: 'Out of stock',
      value: formatNumber(summary.zeroStock),
      meta: `of ${formatNumber(summary.total)} products`,
      tone: summary.zeroStock > 0 ? ('danger' as const) : undefined,
    },
    {
      icon: Image,
      label: 'With a photo',
      value: `${formatNumber(summary.withImage)} / ${formatNumber(summary.total)}`,
      meta: 'products with an image',
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
