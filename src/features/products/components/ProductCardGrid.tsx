import { Package } from 'lucide-react'
import { Badge } from '@/shared/ui/Badge'
import { cn } from '@/shared/lib/cn'
import { formatMoney, formatNumber } from '@/shared/lib/format'
import type { VariationRow } from '../model/product'
import { t } from '@/shared/i18n'

/**
 * The product list as boxes: the same page of variations the table shows,
 * with the photo leading. For browsing by eye — the table stays the place for
 * comparing numbers across many rows.
 */
export function ProductCardGrid({
  rows,
  onOpen,
}: {
  rows: VariationRow[]
  onOpen: (variation: VariationRow) => void
}) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-3 p-3">
      {rows.map((v) => {
        const low = v.lowStockThreshold !== null && v.stock <= v.lowStockThreshold
        const places = v.stockByLocation.filter((s) => s.quantity > 0).map((s) => s.locationName)
        return (
          <button
            // A variation can appear once per location in the by-location view.
            key={`${v.id}@${v.stockByLocation.map((s) => s.locationId).join(',')}`}
            type="button"
            onClick={() => onOpen(v)}
            className="rounded-card border-border bg-surface shadow-card hover:border-primary flex flex-col overflow-hidden border text-left transition-colors"
          >
            <span className="bg-surface-inset text-fg-subtle flex aspect-[3/2] items-center justify-center overflow-hidden">
              {v.imageUrl ? (
                <img src={v.imageUrl} alt="" loading="lazy" className="size-full object-cover" />
              ) : (
                <Package className="size-8" aria-hidden />
              )}
            </span>
            <span className="flex flex-1 flex-col gap-1.5 p-3">
              <span className="flex items-start justify-between gap-2">
                <span className="min-w-0">
                  <span className="text-fg line-clamp-2 block text-sm font-medium">
                    {v.productName}
                  </span>
                  {v.name && v.name !== t('Standard') ? (
                    <span className="text-fg-muted text-2xs block">{v.name}</span>
                  ) : null}
                </span>
                {v.status === 'archived' ? <Badge tone="neutral">{t('Archived')}</Badge> : null}
              </span>
              <span className="text-fg-subtle text-2xs font-mono">
                {v.sku}
                {v.barcode ? ` · ${v.barcode}` : ''}
              </span>
              <span className="mt-auto flex items-end justify-between gap-2 pt-1">
                <span className="min-w-0">
                  <span
                    className={cn(
                      'block text-sm font-semibold tabular-nums',
                      v.stock === 0 ? 'text-danger' : low ? 'text-warning' : 'text-fg',
                    )}
                  >
                    {formatNumber(v.stock)} {v.unit}
                  </span>
                  <span
                    className="text-fg-subtle text-2xs block truncate"
                    title={places.join(', ')}
                  >
                    {places.length ? places.join(', ') : t('Not in stock anywhere')}
                  </span>
                </span>
                <span className="text-fg shrink-0 text-sm font-medium tabular-nums">
                  {v.saleCurrency === t('USD')
                    ? t('{p0} USD', { p0: formatNumber(v.salePrice) })
                    : formatMoney(v.salePrice)}
                </span>
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
