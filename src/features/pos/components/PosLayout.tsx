import { useEffect } from 'react'
import { Link, NavLink, Outlet } from 'react-router'
import { LogOut, ShoppingCart, Wallet } from 'lucide-react'
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

const SECTIONS = [
  {
    to: paths.sales.newSale,
    label: 'Sale',
    icon: ShoppingCart,
    end: true,
    permission: 'sales.orders.create',
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
  const cartLines = useTillStore((s) => s.cart.length)
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
              {section.to === paths.sales.newSale && cartLines > 0 ? (
                <span className="bg-primary text-primary-fg min-w-5 rounded-full px-1.5 text-center text-[11px] leading-5 font-semibold">
                  {cartLines}
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
            if (cartLines) toast.info(t('Cart cleared — stock differs by location'))
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
