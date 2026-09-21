import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { Clock, Play, Trash2 } from 'lucide-react'
import { EmptyState } from '@/shared/components/EmptyState'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { toast } from '@/shared/ui/toast'
import { formatDateTime, formatMoney, formatNumber } from '@/shared/lib/format'
import { paths } from '@/shared/config/paths'
import { t, tn } from '@/shared/i18n'
import { useDataStore } from '@/data/store'
import type { Sale } from '@/features/sales/model/sale'
import { WALK_IN, resolveBuyer, trucksOf } from '../model/buyer'
import { blankTab, useTillStore } from '../model/tillStore'
import { unitsIn } from '../model/cart'

/**
 * «Отложки» (client request): sales put aside at this shop for a customer who
 * will be back — "I'll fetch the truck papers and come back in ten minutes".
 * Each is a sale in the «Отложено» state, exactly as it was left: cart,
 * driver, truck and payment. «Продолжить» opens it in a sale tab where it
 * stopped, and paying finishes that same sale rather than starting another.
 */
export default function PosParkedPage() {
  const navigate = useNavigate()
  const locationId = useTillStore((state) => state.locationId)
  const tabs = useTillStore((state) => state.tabs)
  const openTab = useTillStore((state) => state.openTab)
  const switchTab = useTillStore((state) => state.switchTab)
  const closeTab = useTillStore((state) => state.closeTab)
  const sales = useDataStore((s) => s.sales)
  const drivers = useDataStore((s) => s.drivers)
  const clients = useDataStore((s) => s.clients)
  const updateSale = useDataStore((s) => s.updateSale)
  const [removing, setRemoving] = useState<Sale | null>(null)

  const parked = useMemo(
    () =>
      sales
        .filter((sale) => sale.status === 'postponed' && sale.locationId === locationId)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [sales, locationId],
  )

  /** Which sale tab already has a parked sale open, if any. */
  const tabOf = (sale: Sale) => {
    const index = tabs.findIndex((tab) => tab.parked?.id === sale.id)
    return index === -1 ? null : { tab: tabs[index]!, number: index + 1 }
  }

  const resume = (sale: Sale) => {
    const open = tabOf(sale)
    if (open) {
      switchTab(open.tab.id)
      navigate(paths.sales.newSale)
      return
    }
    const driver = drivers.find((entry) => entry.id === sale.driverId)
    const party = driver ? ({ kind: 'driver', driver } as const) : null
    const truck = trucksOf(party).find((option) => option.truck.plate === sale.truckPlate) ?? null
    const buyer = party
      ? resolveBuyer(party, truck, clients)
      : { ...WALK_IN, client: clients.find((client) => client.id === sale.clientId) ?? null }
    openTab({
      ...blankTab(),
      cart: sale.lines,
      buyer,
      // The till takes no bank transfers; an old parked one comes back as «Перевод».
      payment: sale.paymentMethod === 'transfer' ? 'card' : sale.paymentMethod,
      channel: sale.channel,
      comment: sale.comment ?? '',
      promotionId: sale.promotionId,
      parked: { id: sale.id, number: sale.number },
    })
    navigate(paths.sales.newSale)
  }

  const remove = (sale: Sale) => {
    updateSale(sale.id, { status: 'deleted' })
    const open = tabOf(sale)
    if (open) closeTab(open.tab.id)
    toast.success(t('{number} deleted', { number: sale.number }))
    setRemoving(null)
  }

  return (
    <div className="h-full space-y-4 overflow-y-auto p-4">
      <div>
        <h1 className="text-fg text-lg font-semibold">{t('Parked')}</h1>
        <p className="text-fg-muted text-sm">
          {t('Sales put aside for a customer who will be back. Pick one up where it stopped.')}
        </p>
      </div>

      {parked.length === 0 ? (
        <Card>
          <EmptyState
            title={t('Nothing is parked here')}
            description={t(
              'On a sale, «Отложить» puts it aside and frees the till for the next customer.',
            )}
          />
        </Card>
      ) : (
        <div className="space-y-2">
          {parked.map((sale) => {
            const open = tabOf(sale)
            const units = unitsIn(sale.lines)
            const who = sale.driverName ?? sale.clientName ?? t('Walk-in customer')
            return (
              <Card key={sale.id} className="flex flex-wrap items-center gap-4 p-3">
                <span className="bg-warning-soft text-warning rounded-control flex size-11 shrink-0 items-center justify-center">
                  <Clock className="size-5" />
                </span>
                <div className="min-w-48 flex-1">
                  <p className="text-fg font-semibold">
                    {who}
                    {sale.truckPlate ? (
                      <span className="text-fg-muted ml-2 font-mono text-xs font-normal">
                        {sale.truckPlate}
                      </span>
                    ) : null}
                  </p>
                  <p className="text-fg-subtle text-2xs">
                    <span className="font-mono">{sale.number}</span> ·{' '}
                    {t('parked {when}', { when: formatDateTime(sale.updatedAt) })} ·{' '}
                    {sale.sellerName}
                  </p>
                  <p
                    className="text-fg-muted mt-1 truncate text-xs"
                    title={sale.lines.map((line) => line.name).join(', ')}
                  >
                    {sale.lines
                      .slice(0, 3)
                      .map((line) => `${line.name} × ${formatNumber(line.quantity)}`)
                      .join(', ')}
                    {sale.lines.length > 3 ? ` +${sale.lines.length - 3}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-fg text-lg font-semibold tabular-nums">
                    {formatMoney(sale.total)}
                  </p>
                  <p className="text-fg-subtle text-2xs">
                    {formatNumber(units)} {tn(units, 'unit', 'units')}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="primary" onClick={() => resume(sale)}>
                    <Play />
                    {open ? t('Go to sale {number}', { number: open.number }) : t('Pick it up')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('Delete {number}', { number: sale.number })}
                    className="hover:text-danger"
                    onClick={() => setRemoving(sale)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => (open ? undefined : setRemoving(null))}
        title={t('Delete {number}?', { number: removing?.number ?? '' })}
        body={t(
          'The customer is not coming back for it. It moves to deleted sales and can be restored from the back office.',
        )}
        confirmLabel={t('Delete')}
        destructive
        onConfirm={() => (removing ? remove(removing) : undefined)}
      />
    </div>
  )
}
