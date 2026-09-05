import { NavLink, useLocation } from 'react-router'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/shared/lib/cn'
import { navigation, type NavSection } from '@/shared/config/navigation'
import { useUiStore } from '@/shared/hooks/useUiStore'
import { useSession } from '@/app/providers/SessionProvider'
import { Logo } from '@/shared/ui/Logo'

/**
 * Navy in both themes — the sidebar is the brand's presence on every screen
 * (docs/DESIGN_RULES.md § 3.2, § 10). Items the user cannot access are not
 * rendered at all; never a disabled row.
 */
export function Sidebar() {
  const collapsed = useUiStore((state) => state.sidebarCollapsed)
  const { can } = useSession()

  const sections = navigation
    .map((section) => ({
      ...section,
      items: section.items?.filter((item) => !item.permission || can(item.permission)),
    }))
    .filter((section) =>
      section.items ? section.items.length > 0 : !section.permission || can(section.permission),
    )

  return (
    <aside
      data-chrome
      className={cn(
        'flex shrink-0 flex-col bg-chrome transition-[width] duration-200',
        collapsed ? 'w-14' : 'w-60',
      )}
    >
      <div className="flex h-14 items-center px-3.5">
        <Logo collapsed={collapsed} />
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-4">
        {sections.map((section) => (
          <SidebarSection key={section.id} section={section} collapsed={collapsed} />
        ))}
      </nav>
    </aside>
  )
}

const rowBase =
  'mt-0.5 flex w-full items-center gap-2.5 rounded-control px-2.5 py-2 text-sm font-medium transition-colors'
const rowIdle = 'text-chrome-fg-muted hover:bg-chrome-muted hover:text-chrome-fg'
const rowActive = 'bg-primary/15 text-primary'

function SidebarSection({ section, collapsed }: { section: NavSection; collapsed: boolean }) {
  const { pathname } = useLocation()
  const openSections = useUiStore((state) => state.openSections)
  const toggleSection = useUiStore((state) => state.toggleSection)

  const Icon = section.icon
  const sectionActive = section.items?.some((item) => pathname.startsWith(item.to)) ?? false
  const open = openSections.includes(section.id) || sectionActive

  if (section.to) {
    return (
      <NavLink
        to={section.to}
        end
        title={collapsed ? section.label : undefined}
        className={({ isActive }) => cn(rowBase, isActive ? rowActive : rowIdle)}
      >
        <Icon className="size-4 shrink-0" />
        {!collapsed ? (
          <>
            <span className="flex-1 truncate text-left">{section.label}</span>
            {section.badge ? <LifecycleBadge>{section.badge}</LifecycleBadge> : null}
          </>
        ) : null}
      </NavLink>
    )
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => toggleSection(section.id)}
        title={collapsed ? section.label : undefined}
        className={cn(rowBase, sectionActive ? 'text-chrome-fg' : rowIdle)}
      >
        <Icon className="size-4 shrink-0" />
        {!collapsed ? (
          <>
            <span className="flex-1 truncate text-left">{section.label}</span>
            <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} />
          </>
        ) : null}
      </button>

      {open && !collapsed ? (
        <div className="ml-4 border-l border-chrome-border pl-2">
          {section.items?.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'mt-0.5 flex items-center gap-2 rounded-control px-2.5 py-1.5 text-sm',
                  isActive ? 'bg-primary/15 font-medium text-primary' : rowIdle,
                )
              }
            >
              <span className="flex-1 truncate">{item.label}</span>
              {item.badge ? <LifecycleBadge>{item.badge}</LifecycleBadge> : null}
            </NavLink>
          ))}
        </div>
      ) : null}
    </div>
  )
}

/** `New` / `Beta` only — the sole yellow badges in the product (§ 8.1). */
function LifecycleBadge({ children }: { children: string }) {
  return (
    <span className="rounded-full bg-primary px-1.5 py-0.5 text-2xs font-medium capitalize leading-none text-primary-fg">
      {children}
    </span>
  )
}
