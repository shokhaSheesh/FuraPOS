import { useLocation, useNavigate } from 'react-router'
import { DropdownMenu } from 'radix-ui'
import { ChevronDown, Plus, Upload } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { paths } from '@/shared/config/paths'
import { t } from '@/shared/i18n'

/**
 * The ways a product gets onto a document — a goods receipt, a purchase order —
 * besides picking it from the catalogue the product step already shows.
 *
 * Shared so the two read identically: somebody who has learnt to book a
 * delivery in should not have to learn a second menu to raise an order.
 *
 * Each option says what it is *for* under its name, because "create a new
 * product" and "pick from the catalogue" sound like the same thing to somebody
 * standing in front of an open box for the first time.
 */
export function AddProductsMenu({
  onUploadSpreadsheet,
  label = t('Add products'),
}: {
  onUploadSpreadsheet: () => void
  label?: string
}) {
  const navigate = useNavigate()
  const location = useLocation()

  const options = [
    {
      icon: Upload,
      label: t('Upload a spreadsheet'),
      hint: t('A supplier’s own list, mapped to our fields'),
      onSelect: onUploadSpreadsheet,
    },
    {
      icon: Plus,
      label: t('Create a new product'),
      hint: t('For something we have never carried before'),
      /*
        Back to this document once the product exists (client request): somebody
        halfway through booking a delivery in who has to create a part should
        carry on where they stopped, not land on the product list.
      */
      onSelect: () =>
        navigate(paths.products.new, {
          state: { from: `${location.pathname}${location.search}` },
        }),
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
                <span className="text-fg block text-sm font-medium">{t(option.label)}</span>
                <span className="text-fg-subtle text-2xs block">{t(option.hint)}</span>
              </span>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
