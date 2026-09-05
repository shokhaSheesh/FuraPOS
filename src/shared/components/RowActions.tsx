import type { ReactNode } from 'react'
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { DropdownMenu } from 'radix-ui'
import { Button } from '@/shared/ui/Button'

export interface RowAction {
  label: string
  icon: typeof Pencil
  onSelect: () => void
  /** Renders separated at the bottom of the overflow menu, in danger colour. */
  destructive?: boolean
  hidden?: boolean
}

/**
 * The actions column, identical on every list screen (DESIGN_RULES § 5.3).
 * Up to three actions render as ghost icon buttons; more collapse into a `⋯`
 * menu with the destructive action separated at the bottom. A destructive
 * action never renders as a red button in a row — it opens a confirmation.
 */
export function RowActions({ actions }: { actions: RowAction[] }) {
  const visible = actions.filter((action) => !action.hidden)
  if (visible.length === 0) return null

  if (visible.length <= 3) {
    return (
      <div className="flex items-center justify-end gap-0.5">
        {visible.map((action) => (
          <Button
            key={action.label}
            variant="ghost"
            size="icon"
            aria-label={action.label}
            title={action.label}
            className={action.destructive ? 'hover:text-danger' : undefined}
            onClick={(event) => {
              event.stopPropagation()
              action.onSelect()
            }}
          >
            <action.icon />
          </Button>
        ))}
      </div>
    )
  }

  const regular = visible.filter((action) => !action.destructive)
  const destructive = visible.filter((action) => action.destructive)

  return (
    <div className="flex justify-end">
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="More actions"
            onClick={(event) => event.stopPropagation()}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={4}
            onClick={(event) => event.stopPropagation()}
            className="rounded-control border-border bg-surface shadow-popover z-50 min-w-44 border p-1"
          >
            {regular.map((action) => (
              <MenuItem key={action.label} onSelect={action.onSelect}>
                <action.icon className="size-4" />
                {action.label}
              </MenuItem>
            ))}
            {destructive.length > 0 ? (
              <>
                <DropdownMenu.Separator className="bg-border my-1 h-px" />
                {destructive.map((action) => (
                  <MenuItem key={action.label} onSelect={action.onSelect} destructive>
                    <action.icon className="size-4" />
                    {action.label}
                  </MenuItem>
                ))}
              </>
            ) : null}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  )
}

function MenuItem({
  children,
  onSelect,
  destructive,
}: {
  children: ReactNode
  onSelect: () => void
  destructive?: boolean
}) {
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      className={`data-[highlighted]:bg-surface-muted flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm outline-none ${
        destructive ? 'text-danger' : 'text-fg'
      }`}
    >
      {children}
    </DropdownMenu.Item>
  )
}

export { Pencil, Trash2 }
