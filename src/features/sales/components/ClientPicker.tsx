import { useEffect, useState } from 'react'
import { Check, ChevronDown, UserRound } from 'lucide-react'
import { Popover } from '@/shared/ui/Popover'
import { Input } from '@/shared/ui/Input'
import { Button } from '@/shared/ui/Button'
import { cn } from '@/shared/lib/cn'
import { formatMoney } from '@/shared/lib/format'
import { useClients, type Client } from '../api/sales'

/** Walk-in is the default: most counter sales have no client attached. */
export function ClientPicker({
  value,
  onChange,
}: {
  value: Client | null
  onChange: (client: Client | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [term, setTerm] = useState('')
  const [debounced, setDebounced] = useState('')
  const { data } = useClients(debounced)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(term.trim()), 250)
    return () => clearTimeout(timer)
  }, [term])

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      className="w-80"
      trigger={
        <Button variant="secondary" className="w-full justify-start font-normal">
          <UserRound />
          <span className={cn('flex-1 truncate text-left', !value && 'text-fg-muted')}>
            {value ? value.name : 'Walk-in customer'}
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
          placeholder="Search by name or phone…"
          aria-label="Search clients"
          className="h-8"
        />
      </div>
      <ul className="max-h-72 overflow-y-auto p-1">
        <li>
          <button
            type="button"
            onClick={() => {
              onChange(null)
              setOpen(false)
            }}
            className="rounded-control hover:bg-surface-muted flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm"
          >
            <span className="text-fg-muted flex-1">Walk-in customer</span>
            {!value ? <Check className="text-primary size-4" /> : null}
          </button>
        </li>
        {(data?.items ?? []).map((client) => (
          <li key={client.id}>
            <button
              type="button"
              onClick={() => {
                onChange(client)
                setOpen(false)
              }}
              className="rounded-control hover:bg-surface-muted flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm"
            >
              <span className="min-w-0 flex-1">
                <span className="text-fg block truncate">{client.name}</span>
                <span className="text-fg-subtle text-2xs">{client.phone}</span>
              </span>
              {client.debt > 0 ? (
                <span className="text-warning text-2xs shrink-0">
                  owes {formatMoney(client.debt)}
                </span>
              ) : null}
              {value?.id === client.id ? <Check className="text-primary size-4" /> : null}
            </button>
          </li>
        ))}
      </ul>
    </Popover>
  )
}
