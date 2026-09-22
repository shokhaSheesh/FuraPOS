import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { PackagePlus, Plus } from 'lucide-react'
import { Modal } from '@/shared/ui/Modal'
import { Button } from '@/shared/ui/Button'
import { ProductThumb } from '@/shared/components/ProductThumb'
import { QuantityStepper } from '@/shared/components/catalogue/VariationsDialog'
import { EmptyState } from '@/shared/components/EmptyState'
import { formatDate, formatMoneyIn, formatNumber } from '@/shared/lib/format'
import { paths } from '@/shared/config/paths'
import { t, tn } from '@/shared/i18n'
import type { VariationRow } from '@/features/products/model/product'
import type { CatalogueEntry } from '../model/catalogue'

/** A line's quantity, and what it costs — the shape both documents apply. */
export interface PurchaseChange {
  row: { variation: VariationRow }
  draft: { quantity: number; unitCost: number; costCurrency: 'USD' | 'UZS' }
}

/** How far back counts as "recently added" to their price list. */
const RECENT_DAYS = 45
/** Shown when they have listed nothing that recently, so the button is never empty-handed. */
const AT_LEAST = 10

/** Their newest lines first, whether or not we carry them yet. */
export function newestFromSupplier(entries: CatalogueEntry[]): CatalogueEntry[] {
  const newest = [...entries].sort((a, b) => b.product.updatedAt.localeCompare(a.product.updatedAt))
  const since = Date.now() - RECENT_DAYS * 86_400_000
  const recent = newest.filter((entry) => new Date(entry.product.updatedAt).getTime() >= since)
  return recent.length >= AT_LEAST ? recent : newest.slice(0, AT_LEAST)
}

/**
 * What this supplier has put on their price list lately (client request).
 *
 * A buyer opening an order wants to know what is new with them before they
 * start picking — including the parts we do not carry yet, which is how the
 * range grows. Those cannot go on the document until they exist in our
 * catalogue, so they offer the product form instead and come back here.
 */
export function SupplierNewProducts({
  open,
  onOpenChange,
  entries,
  supplierName,
  onAdd,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  entries: CatalogueEntry[]
  supplierName: string
  onAdd: (changes: PurchaseChange[]) => void
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const [quantities, setQuantities] = useState<Record<string, number>>({})

  const newest = useMemo(() => (open ? newestFromSupplier(entries) : []), [entries, open])
  const chosen = newest
    .filter((entry) => entry.variation && (quantities[entry.product.id] ?? 0) > 0)
    .map<PurchaseChange>((entry) => ({
      row: { variation: entry.variation! },
      draft: {
        quantity: quantities[entry.product.id]!,
        unitCost: entry.product.price,
        costCurrency: entry.product.currency,
      },
    }))
  const units = chosen.reduce((sum, change) => sum + change.draft.quantity, 0)

  const close = () => {
    setQuantities({})
    onOpenChange(false)
  }

  return (
    <Modal
      open={open}
      onOpenChange={(next) => (next ? undefined : close())}
      title={t('New from {supplierName}', { supplierName })}
      description={t('What they have added to their price list lately.')}
      size="lg"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-fg-muted text-sm">
            {units > 0
              ? `${t('Chosen:')} ${formatNumber(units)} ${tn(units, 'unit', 'units')}`
              : t('Nothing chosen')}
          </span>
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={close}>
              {t('Close')}
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={chosen.length === 0}
              onClick={() => {
                onAdd(chosen)
                close()
              }}
            >
              {t('Add to the document')}
            </Button>
          </div>
        </div>
      }
    >
      {newest.length === 0 ? (
        <EmptyState
          title={t('Their price list is empty')}
          description={t('Nothing to show until they list something.')}
        />
      ) : (
        <ul className="divide-border divide-y">
          {newest.map((entry) => {
            const { product, variation } = entry
            return (
              <li key={product.id} className="flex items-center gap-3 py-2.5">
                <ProductThumb src={variation?.imageUrl ?? null} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-fg truncate text-sm font-medium" title={product.name}>
                    {product.name}
                  </p>
                  <p className="text-fg-subtle text-2xs truncate">
                    <span className="font-mono">{product.supplierSku}</span> ·{' '}
                    {t('listed {date}', { date: formatDate(product.updatedAt) })}
                    {variation ? ` · ${t('Stock')}: ${formatNumber(entry.stock)}` : ''}
                  </p>
                </div>
                <span className="text-fg shrink-0 text-sm font-medium tabular-nums">
                  {formatMoneyIn(product.price, product.currency)}
                </span>
                {variation ? (
                  <QuantityStepper
                    size="lg"
                    value={quantities[product.id] ?? 0}
                    label={product.name}
                    onChange={(quantity) =>
                      setQuantities((current) => ({ ...current, [product.id]: quantity }))
                    }
                  />
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    /* It cannot go on a document until we carry it. */
                    onClick={() =>
                      navigate(paths.products.new, {
                        state: { from: `${location.pathname}${location.search}` },
                      })
                    }
                  >
                    <Plus />
                    {t('New to us — add it')}
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Modal>
  )
}

/** The button that opens it, so both documents carry the same one. */
export function SupplierNewProductsButton({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" variant="secondary" onClick={onClick}>
      <PackagePlus />
      {t('New from the supplier')}
    </Button>
  )
}
