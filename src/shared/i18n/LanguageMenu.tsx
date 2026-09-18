import { Check, Languages } from 'lucide-react'
import { DropdownMenu } from 'radix-ui'
import { Button } from '@/shared/ui/Button'
import { LANGUAGES, useLanguageStore } from './language'
import { t } from './t'

/** The language picker in the top bar, beside the theme toggle. */
export function LanguageMenu() {
  const language = useLanguageStore((state) => state.language)
  const setLanguage = useLanguageStore((state) => state.setLanguage)
  const current = LANGUAGES.find((entry) => entry.value === language)

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="ghost" size="sm" aria-label={t('Language')}>
          <Languages />
          {current?.label}
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="rounded-control border-border bg-surface shadow-popover z-50 min-w-40 border p-1"
        >
          {LANGUAGES.map((entry) => (
            <DropdownMenu.Item
              key={entry.value}
              onSelect={() => setLanguage(entry.value)}
              className="text-fg data-[highlighted]:bg-surface-muted flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm outline-none"
            >
              <Check
                className={`size-4 ${entry.value === language ? 'opacity-100' : 'opacity-0'}`}
              />
              {entry.name}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
