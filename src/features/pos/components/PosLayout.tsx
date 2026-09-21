import { useEffect, useMemo } from 'react'
import { Link, NavLink, Outlet } from 'react-router'
import { Clock, LogOut, ShoppingCart, Wallet } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { Logo } from '@/shared/ui/Logo'
import { Select } from '@/shared/ui/Select'
import { toast } from '@/shared/ui/toast'
import { cn } from '@/shared/lib/cn'
import { paths } from '@/shared/config/paths'
import { LanguageMenu, t } from '@/shared/i18n'
import { useSession } from '@/app/providers/SessionProvider'
import { useDataStore } from '@/data/store'
import { useOpenShiftAt } from '@/features/cashShifts/api/shifts'
import { useTillStore } from '../model/tillStore'

const SECTIONS: {
  to: string
  label: string
  icon: typeof ShoppingCart
  end: boolean
  permission: string
  badge?: 'open' | 'parked'
}[] = [
  {
    to: paths.sales.newSale,
    label: 'Sale',
    icon: ShoppingCart,
    end: true,
    permission: 'sales.orders.create',
    badge: 'open',
  },
  // Sales put aside for a customer who will be back (client request).
  {
    to: paths.sales.tillParked,
    label: 'Parked',
    icon: Clock,
    end: false,
    permission: 'sales.orders.create',
    badge: 'parked',
  },
  {
    to: paths.sales.tillCash,
    label: 'Cash desk',
    icon: Wallet,
    end: false,
    permission: 'sales.cashShifts.view',
  },
]

/**
 * The till's own frame: one bar with the till's two sections as tabs —
 * «Продажа», where a sale is rung up, and «Касса», where the cashier sees the
 * drawer and records what was spent from it — then the shop and whether its
 * drawer is open. No back-office sidebar: the till is its own place.
 */
export function PosLayout() {
  const { user, can } = useSession()
  const locations = useDataStore((s) => s.locations)
  const locationId = useTillStore((s) => s.locationId)
  const setLocation = useTillStore((s) => s.setLocation)
  /** Sales open on the till with something in them. */
  const openSales = useTillStore((s) => s.tabs.filter((tab) => tab.cart.length > 0).length)
  const sales = useDataStore((s) => s.sales)
  const parkedHere = useMemo(
    () =>
      sales.filter((sale) => sale.status === 'postponed' && sale.locationId === locationId).length,
    [sales, locationId],
  )
  const openShift = useOpenShiftAt(locationId)

  // The cashier's own shop when their account names one.
  useEffect(() => {
    if (!locationId) setLocation(user?.locationIds[0] ?? locations[0]?.id ?? '')
  }, [locationId, setLocation, user, locations])

  return (
    <div className="bg-canvas flex h-screen flex-col">
      <header className="border-border bg-surface flex h-14 shrink-0 items-center gap-3 border-b px-4">
        <Logo />
        {/*
          The till's two sections as tabs in the bar, not a rail: the left edge
          of «Продажа» belongs to its parts catalogue, and a second sidebar
          beside it would leave the products a sliver.
        */}
        <nav
          aria-label={t('Till')}
          className="bg-surface-inset rounded-control flex items-center gap-1 p-1"
        >
          {SECTIONS.filter((section) => can(section.permission)).map((section) => (
            <NavLink
              key={section.to}
              to={section.to}
              end={section.end}
              className={({ isActive }) =>
                cn(
                  'rounded-control flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors [&_svg]:size-4',
                  isActive ? 'bg-surface text-fg shadow-card' : 'text-fg-muted hover:text-fg',
                )
              }
            >
              <section.icon />
              {t(section.label)}
              {section.badge === 'open' && openSales > 0 ? (
                <span className="bg-primary text-primary-fg min-w-5 rounded-full px-1.5 text-center text-[11px] leading-5 font-semibold">
                  {openSales}
                </span>
              ) : section.badge === 'parked' && parkedHere > 0 ? (
                <span className="bg-warning-soft text-warning min-w-5 rounded-full px-1.5 text-center text-[11px] leading-5 font-semibold">
                  {parkedHere}
                </span>
              ) : null}
            </NavLink>
          ))}
        </nav>
        <Select
          className="w-56"
          aria-label={t('Location')}
          value={locationId ?? undefined}
          onChange={(next) => {
            if (next === locationId) return
            setLocation(next)
            if (openSales) toast.info(t('Cart cleared — stock differs by location'))
          }}
          options={locations.map((l) => ({ value: l.id, label: l.name }))}
        />
        <span
          className={cn(
            'rounded-full px-2.5 py-0.5 text-xs font-medium',
            openShift ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning',
          )}
        >
          {openShift
            ? t('Drawer open · {name}', { name: openShift.registerName })
            : t('No drawer open — cash is off')}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-fg-muted text-sm">{user?.name}</span>
          <LanguageMenu />
          <Button variant="secondary" size="sm" asChild>
            <Link to={paths.sales.orders}>
              <LogOut />
              {t('Back office')}
            </Link>
          </Button>
        </div>
      </header>

      <div className="min-h-0 flex-1">
        <Outlet />
      </div>
    </div>
  )
}
