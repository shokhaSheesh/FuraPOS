import { Link } from 'react-router'
import { Bell, Moon, PanelLeft, Plus, Search, Sun, Wallet } from 'lucide-react'
import { DropdownMenu } from 'radix-ui'
import { Button } from '@/shared/ui/Button'
import { Badge } from '@/shared/ui/Badge'
import { useUiStore } from '@/shared/hooks/useUiStore'
import { useSession } from '@/app/providers/SessionProvider'
import { useTheme } from '@/app/providers/ThemeProvider'
import { quickCreateActions } from '@/shared/config/navigation'
import { paths } from '@/shared/config/paths'
import { formatMoney } from '@/shared/lib/format'

const menuContentClass =
  'z-50 min-w-52 rounded-control border border-border bg-surface p-1 shadow-popover'
const menuItemClass =
  'flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-fg outline-none data-[highlighted]:bg-surface-muted'

export function Topbar() {
  const toggleSidebar = useUiStore((state) => state.toggleSidebar)
  const { user, can } = useSession()
  const { resolved, setTheme } = useTheme()

  return (
    <header className="border-border bg-surface flex h-14 shrink-0 items-center gap-2 border-b px-3">
      <Button variant="ghost" size="icon" aria-label="Toggle sidebar" onClick={toggleSidebar}>
        <PanelLeft />
      </Button>

      <QuickCreateMenu />

      <div className="relative mx-2 hidden max-w-md flex-1 md:block">
        <Search className="text-fg-subtle pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        <input
          placeholder="Search products, sales, clients…"
          className="rounded-control border-border bg-surface-inset text-fg placeholder:text-fg-subtle h-9 w-full border pr-3 pl-8 text-sm"
        />
      </div>

      <div className="ml-auto flex items-center gap-1">
        {can('settings.billing.view') ? (
          <Button variant="ghost" size="sm" asChild>
            <Link to={paths.settings.billing}>
              <Wallet />
              {formatMoney(1_250_000)}
            </Link>
          </Button>
        ) : null}

        <Button
          variant="ghost"
          size="icon"
          aria-label="Toggle theme"
          onClick={() => setTheme(resolved === 'dark' ? 'light' : 'dark')}
        >
          {resolved === 'dark' ? <Sun /> : <Moon />}
        </Button>

        <NotificationsMenu />
        <UserMenu name={user?.name ?? '—'} plan={user?.company.plan ?? 'free'} />
      </div>
    </header>
  )
}

function QuickCreateMenu() {
  const { can } = useSession()
  const actions = quickCreateActions.filter(
    (action) => !action.permission || can(action.permission),
  )
  if (actions.length === 0) return null

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="secondary" size="icon" aria-label="Create">
          <Plus />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="start" sideOffset={6} className={menuContentClass}>
          {actions.map((action) => (
            <DropdownMenu.Item key={action.label} asChild className={menuItemClass}>
              <Link to={action.to}>{action.label}</Link>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

/** A dropdown, never a page — see CLAUDE.md. */
function NotificationsMenu() {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
          <Bell />
          <span className="bg-danger absolute top-2 right-2 size-1.5 rounded-full" />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={6} className={`${menuContentClass} w-80`}>
          <p className="px-2 py-1.5 text-sm font-semibold">Notifications</p>
          <p className="text-fg-muted px-2 py-6 text-center text-sm">You're all caught up.</p>
          <DropdownMenu.Separator className="bg-border my-1 h-px" />
          <DropdownMenu.Item asChild className={menuItemClass}>
            <Link to={paths.settings.notifications}>Notification preferences</Link>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

function UserMenu({ name, plan }: { name: string; plan: string }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="bg-surface-inset text-fg ml-1 flex size-8 items-center justify-center rounded-full text-sm font-medium"
        >
          {name.charAt(0).toUpperCase()}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={6} className={menuContentClass}>
          <div className="flex items-center justify-between gap-3 px-2 py-1.5">
            <span className="text-sm font-medium">{name}</span>
            <Badge tone="primary">{plan}</Badge>
          </div>
          <DropdownMenu.Separator className="bg-border my-1 h-px" />
          <DropdownMenu.Item asChild className={menuItemClass}>
            <Link to={paths.settings.profile}>Profile</Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild className={menuItemClass}>
            <Link to={paths.settings.root}>Settings</Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild className={menuItemClass}>
            <Link to={paths.activityLog}>Activity log</Link>
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="bg-border my-1 h-px" />
          <DropdownMenu.Item className={menuItemClass}>Sign out</DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
