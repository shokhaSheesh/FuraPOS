import { useNavigate } from 'react-router'
import { DropdownMenu } from 'radix-ui'
import { ChevronDown, Plus, Search, Upload } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { paths } from '@/shared/config/paths'

/**
 * The three ways a product gets onto a document — a goods receipt, a purchase
 * order — when there is no catalogue of theirs already on screen to type
 * quantities into.
 *
 * Shared so the two read identically: somebody who has learnt to book a
 * delivery in should not have to learn a second menu to raise an order.
 *
 * Each option says what it is *for* under its name, because "create a new
 * product" and "pick from the catalogue" sound like the same thing to somebody
 * standing in front of an open box for the first time. Picking from the
 * catalogue comes first: it is what happens nearly every time.
 */
export function AddProductsMenu({
  onPickFromCatalogue,
  onUploadSpreadsheet,
  label = 'Add products',
}: {
  onPickFromCatalogue: () => void
  onUploadSpreadsheet: () => void
  label?: string
}) {
  const navigate = useNavigate()

  const options = [
    {
      icon: Search,
      label: 'Pick from the catalogue',
      hint: 'Search or scan what you already stock',
      onSelect: onPickFromCatalogue,
    },
    {
      icon: Upload,
      label: 'Upload a spreadsheet',
      hint: 'A supplier’s own list, mapped to our fields',
      onSelect: onUploadSpreadsheet,
    },
    {
      icon: Plus,
      label: 'Create a new product',
      hint: 'For something we have never carried before',
      onSelect: () => navigate(paths.products.new),
    },
  ]

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="primary">
          <Plus />
          {label}
          <ChevronDown />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className="rounded-control border-border bg-surface shadow-popover z-50 w-72 border p-1"
        >
          {options.map((option) => (
            <DropdownMenu.Item
              key={option.label}
              onSelect={option.onSelect}
              className="rounded-control data-[highlighted]:bg-surface-muted flex cursor-pointer items-start gap-3 px-2 py-2 outline-none"
            >
              <span className="bg-surface-inset text-fg-muted mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full">
                <option.icon className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="text-fg block text-sm font-medium">{option.label}</span>
                <span className="text-fg-subtle text-2xs block">{option.hint}</span>
              </span>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
