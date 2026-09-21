import { NavLink } from 'react-router'
import type { NavTab } from '@/shared/config/navigation'
import { useSession } from '@/app/providers/SessionProvider'
import { cn } from '@/shared/lib/cn'
import { t } from '@/shared/i18n'

/**
 * Tabs that are places rather than panels: each is its own address, so a tab
 * can be linked to, reloaded and gone back to, and keeps its own filters in
 * the URL. Drawn exactly like the panel `Tabs`, so the two read as one thing.
 * A tab the user may not open is not shown.
 */
export function RouteTabs({ tabs }: { tabs: NavTab[] }) {
  const { can } = useSession()
  const visible = tabs.filter((tab) => can(tab.permission))
  if (visible.length < 2) return null

  return (
    <nav aria-label={t('Sections')} className="border-border flex items-center gap-1 border-b">
      {visible.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) =>
            cn(
              '-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium',
              isActive
                ? 'border-primary text-fg'
                : 'text-fg-muted hover:text-fg border-transparent',
            )
          }
        >
          {tab.icon ? <tab.icon className="size-4 shrink-0" /> : null}
          {t(tab.label)}
        </NavLink>
      ))}
    </nav>
  )
}
