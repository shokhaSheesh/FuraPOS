import { Link, useNavigate } from 'react-router'
import { Bell, LogOut, Moon, PanelLeft, Sun } from 'lucide-react'
import { DropdownMenu } from 'radix-ui'
import { Button } from '@/shared/ui/Button'
import { Badge } from '@/shared/ui/Badge'
import { useUiStore } from '@/shared/hooks/useUiStore'
import { useSession } from '@/app/providers/SessionProvider'
import { useTheme } from '@/app/providers/ThemeProvider'
import { paths } from '@/shared/config/paths'

const menuContentClass =
  'z-50 min-w-52 rounded-control border border-border bg-surface p-1 shadow-popover'
const menuItemClass =
  'flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-fg outline-none data-[highlighted]:bg-surface-muted'

export function Topbar() {
  const toggleSidebar = useUiStore((state) => state.toggleSidebar)
  const { user } = useSession()
  const { resolved, setTheme } = useTheme()

  return (
    <header className="border-border bg-surface flex h-14 shrink-0 items-center gap-2 border-b px-3">
      <Button variant="ghost" size="icon" aria-label="Toggle sidebar" onClick={toggleSidebar}>
        <PanelLeft />
      </Button>

      <div className="ml-auto flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Toggle theme"
          onClick={() => setTheme(resolved === 'dark' ? 'light' : 'dark')}
        >
          {resolved === 'dark' ? <Sun /> : <Moon />}
        </Button>

        <NotificationsMenu />
        <UserMenu name={user?.name ?? '—'} role={user?.role.name ?? ''} email={user?.email ?? ''} />
      </div>
    </header>
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
            <Link to={paths.settings.general}>Notification preferences</Link>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

function UserMenu({ name, role, email }: { name: string; role: string; email: string }) {
  const { signOut } = useSession()
  const navigate = useNavigate()
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
          <div className="px-2 py-1.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium">{name}</span>
              {role ? <Badge tone="info">{role}</Badge> : null}
            </div>
            <p className="text-fg-subtle text-2xs">{email}</p>
          </div>
          <DropdownMenu.Separator className="bg-border my-1 h-px" />
          <DropdownMenu.Item asChild className={menuItemClass}>
            <Link to={paths.settings.personal}>Profile</Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild className={menuItemClass}>
            <Link to={paths.settings.root}>Settings</Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild className={menuItemClass}>
            <Link to={paths.activityLog}>Activity log</Link>
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="bg-border my-1 h-px" />
          <DropdownMenu.Item
            className={menuItemClass}
            onSelect={() => {
              signOut()
              navigate(paths.auth.login, { replace: true })
            }}
          >
            <LogOut className="size-4" />
            Sign out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
