import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { cn } from '@/shared/lib/cn'
import { formatNumber } from '@/shared/lib/format'
import { t, tn } from '@/shared/i18n'
import { useTillStore, type TillTab } from '../model/tillStore'
import { unitsIn } from '../model/cart'

/**
 * The sales open on the till, numbered, with a + for another (client
 * request). A cashier serving a queue flips between them; paying one closes
 * it and leaves the rest as they were.
 *
 * Closing a sale that still has something in it asks first, because that
 * throws the cart away — parking it is how it is kept for later.
 */
export function SaleTabs() {
  const tabs = useTillStore((state) => state.tabs)
  const activeId = useTillStore((state) => state.activeId)
  const openTab = useTillStore((state) => state.openTab)
  const switchTab = useTillStore((state) => state.switchTab)
  const closeTab = useTillStore((state) => state.closeTab)
  const [closing, setClosing] = useState<{ tab: TillTab; number: number } | null>(null)

  const askToClose = (tab: TillTab, number: number) => {
    if (tab.cart.length === 0) closeTab(tab.id)
    else setClosing({ tab, number })
  }

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto">
      {tabs.map((tab, index) => {
        const active = tab.id === activeId
        const units = unitsIn(tab.cart)
        return (
          <div
            key={tab.id}
            className={cn(
              'rounded-control flex shrink-0 items-center border text-sm font-medium transition-colors',
              active
                ? 'border-primary bg-primary text-primary-fg'
                : 'border-border text-fg-muted hover:border-border-strong hover:text-fg',
            )}
          >
            <button
              type="button"
              onClick={() => switchTab(tab.id)}
              aria-pressed={active}
              title={tab.parked ? tab.parked.number : undefined}
              className="flex items-center gap-1.5 py-1.5 pl-3"
            >
              {index + 1}
              {units > 0 ? (
                <span
                  className={cn(
                    'min-w-5 rounded-full px-1.5 text-center text-[11px] leading-5 tabular-nums',
                    active ? 'bg-primary-fg/20' : 'bg-surface-inset',
                  )}
                >
                  {formatNumber(units)}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              onClick={() => askToClose(tab, index + 1)}
              aria-label={t('Close sale {number}', { number: index + 1 })}
              className="flex size-7 items-center justify-center opacity-70 hover:opacity-100"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )
      })}
      <button
        type="button"
        onClick={() => openTab()}
        aria-label={t('Another sale')}
        title={t('Another sale')}
        className="border-border text-fg-muted hover:border-primary hover:text-primary rounded-control flex size-8 shrink-0 items-center justify-center border border-dashed"
      >
        <Plus className="size-4" />
      </button>

      <ConfirmDialog
        open={closing !== null}
        onOpenChange={(open) => (open ? undefined : setClosing(null))}
        title={t('Close sale {number}?', { number: closing?.number ?? '' })}
        body={
          closing
            ? t(
                'Its cart has {count} {products} and they will be dropped. To come back to it later, park it instead.',
                {
                  count: closing.tab.cart.length,
                  products: tn(closing.tab.cart.length, 'product', 'products'),
                },
              )
            : ''
        }
        confirmLabel={t('Close it')}
        destructive
        onConfirm={() => {
          if (closing) closeTab(closing.tab.id)
          setClosing(null)
        }}
      />
    </div>
  )
}
