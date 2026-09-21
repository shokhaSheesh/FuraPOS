import { useMemo, useState } from 'react'
import { Check, ChevronDown, UserRound } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { Popover } from '@/shared/ui/Popover'
import { cn } from '@/shared/lib/cn'
import { formatMoney } from '@/shared/lib/format'
import { t } from '@/shared/i18n'
import { useDataStore } from '@/data/store'
import type { Client } from '@/features/sales/api/sales'

/**
 * Whose account the sale goes on, found by name or phone. Nobody chosen is a
 * walk-in who pays at the counter. Blocked and archived clients are not
 * offered: a blocked client is blocked precisely from buying on account.
 */
export function ClientPicker({
  value,
  onChange,
}: {
  value: Client | null
  onChange: (client: Client | null) => void
}) {
  const clients = useDataStore((s) => s.clients)
  const [open, setOpen] = useState(false)
  const [term, setTerm] = useState('')

  const matching = useMemo(() => {
    const q = term.trim().toLowerCase()
    const digits = q.replace(/\D/g, '')
    return clients
      .filter((client) => client.status === 'active')
      .filter(
        (client) =>
          !q ||
          client.name.toLowerCase().includes(q) ||
          (digits.length > 2 && (client.phone ?? '').replace(/\D/g, '').includes(digits)),
      )
      .slice(0, 50)
  }, [clients, term])

  const pick = (client: Client | null) => {
    onChange(client)
    setOpen(false)
    setTerm('')
  }

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      className="w-96 p-0"
      trigger={
        <Button variant="secondary" className="w-full justify-start font-normal">
          <UserRound />
          <span className={cn('flex-1 truncate text-left', !value && 'text-fg-muted')}>
            {value ? value.name : t('Walk-in customer')}
          </span>
          <ChevronDown className="text-fg-subtle" />
        </Button>
      }
    >
      <div className="border-border border-b p-2">
        <Input
          autoFocus
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder={t('Search a client by name or phone…')}
          aria-label={t('Search clients')}
          className="h-8"
        />
      </div>
      <ul className="max-h-80 overflow-y-auto p-1">
        <li>
          <button
            type="button"
            onClick={() => pick(null)}
            className="hover:bg-canvas flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm"
          >
            <span className="flex-1">{t('Walk-in customer')}</span>
            {value === null ? <Check className="text-fg-subtle size-4" /> : null}
          </button>
        </li>
        {matching.map((client) => (
          <li key={client.id}>
            <button
              type="button"
              onClick={() => pick(client)}
              className="hover:bg-canvas flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="text-fg truncate">{client.name}</p>
                <p className="text-fg-subtle text-2xs truncate">
                  {[
                    client.type === 'business' ? t('Business') : t('Person'),
                    client.phone,
                    client.debt > 0 ? `${t('Owes us')} ${formatMoney(client.debt)}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              {value?.id === client.id ? <Check className="text-fg-subtle mt-0.5 size-4" /> : null}
            </button>
          </li>
        ))}
        {matching.length === 0 ? (
          <li className="text-fg-subtle px-2 py-4 text-center text-sm">{t('No client matches')}</li>
        ) : null}
      </ul>
    </Popover>
  )
}
