import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Building2,
  ChevronRight,
  Plus,
  Search,
  Truck as TruckIcon,
  UserRound,
  Users,
  X,
} from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { Popover } from '@/shared/ui/Popover'
import { cn } from '@/shared/lib/cn'
import { formatMoney } from '@/shared/lib/format'
import { t } from '@/shared/i18n'
import { useDataStore } from '@/data/store'
import { describeTruck, type Driver } from '@/features/drivers/model/driver'
import { NewDriverModal } from '@/features/sales/components/NewDriverModal'
import type { Client } from '@/features/sales/api/sales'
import {
  needsTruck,
  resolveBuyer,
  trucksOf,
  type Party,
  type TillBuyer,
  type TruckOption,
} from '../model/buyer'

/** What kind of buyer a driver is, in words: his own man, a fleet's, or both. */
function driverKind(driver: Driver) {
  const own = driver.ownTrucks.length > 0
  const fleet = driver.autoparkName
  if (own && fleet) return t('Owner-driver · drives for «{autopark}»', { autopark: fleet })
  if (fleet) return t('Driver of «{autopark}»', { autopark: fleet })
  return t('Owner-driver')
}

const clientKind = (client: Client) => (client.type === 'business' ? t('Company') : t('Person'))

/**
 * Who is buying, in the two steps of the client's reference.
 *
 * 1. **Find the client** — one search over drivers and clients alike: owner-
 *    drivers, autopark drivers and the companies and people on account.
 * 2. **Pick the truck** — a driver's own trucks and his autopark's, or a
 *    company's fleet. The truck decides whose purchase it is; a single truck
 *    is chosen without asking. See `../model/buyer.ts`.
 *
 * F2 opens the search and F3 the trucks, so a cashier can serve a queue
 * without reaching for the mouse.
 */
export function TillCustomer({
  buyer,
  onChange,
}: {
  buyer: TillBuyer
  onChange: (buyer: TillBuyer) => void
}) {
  const drivers = useDataStore((s) => s.drivers)
  const clients = useDataStore((s) => s.clients)
  const [searching, setSearching] = useState(false)
  const [choosing, setChoosing] = useState(false)
  const [adding, setAdding] = useState(false)

  const options = useMemo(() => trucksOf(buyer.party, drivers), [buyer.party, drivers])

  const pickParty = (party: Party) => {
    setSearching(false)
    setChoosing(false)
    onChange(resolveBuyer(party, null, drivers, clients))
  }

  const pickTruck = (option: TruckOption | null) => {
    setChoosing(false)
    onChange(resolveBuyer(buyer.party, option, drivers, clients))
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'F2') {
        event.preventDefault()
        setSearching(true)
      } else if (event.key === 'F3' && options.length > 0) {
        event.preventDefault()
        setChoosing(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [options.length])

  // The list shows while there is a truck still to choose, or on request.
  const showTrucks = options.length > 1 && (choosing || buyer.truck === null)

  return (
    <div className="space-y-4">
      <Step number={1} title={t('Find the client')} hotkey="F2">
        <PartySearch
          open={searching}
          onOpenChange={setSearching}
          drivers={drivers}
          clients={clients}
          value={buyer.party}
          onPick={pickParty}
          onAddDriver={() => {
            setSearching(false)
            setAdding(true)
          }}
        />
        <PartyCard
          party={buyer.party}
          onOpen={() => setSearching(true)}
          onClear={() => pickParty(null)}
        />
      </Step>

      {options.length > 0 ? (
        <Step number={2} title={t('Choose the truck')} hotkey="F3">
          {showTrucks ? (
            <div className="max-h-56 space-y-1.5 overflow-y-auto">
              {options.map((option) => (
                <TruckCard
                  key={`${option.capacity}-${option.truck.plate}`}
                  option={option}
                  selected={buyer.truck?.truck.plate === option.truck.plate}
                  onClick={() => pickTruck(option)}
                />
              ))}
              {needsTruck(buyer) ? (
                <p className="text-danger text-2xs">
                  {t('Say which truck this is for — it decides whose purchase it is.')}
                </p>
              ) : null}
            </div>
          ) : buyer.truck ? (
            <TruckCard
              option={buyer.truck}
              selected
              onChange={options.length > 1 ? () => setChoosing(true) : undefined}
              onClear={
                // One truck is chosen for him; clearing it would change nothing.
                options.length > 1 ? () => pickTruck(null) : undefined
              }
            />
          ) : null}
        </Step>
      ) : null}

      {buyer.client && buyer.client.debt > 0 ? (
        <p className="text-warning text-2xs">
          {buyer.client.name} {t('already owes')} {formatMoney(buyer.client.debt)}.
        </p>
      ) : null}

      <NewDriverModal
        open={adding}
        onOpenChange={setAdding}
        onCreated={(driver) => pickParty({ kind: 'driver', driver })}
      />
    </div>
  )
}

function Step({
  number,
  title,
  hotkey,
  children,
}: {
  number: number
  title: string
  hotkey: string
  children: ReactNode
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-fg text-sm font-semibold">
          {number}. {title}
        </h2>
        <kbd className="border-border bg-surface-muted text-fg-muted rounded border px-1.5 py-0.5 font-mono text-[10px]">
          {hotkey}
        </kbd>
      </div>
      {children}
    </section>
  )
}

function Tile({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-control bg-surface-inset text-fg flex size-11 shrink-0 items-center justify-center [&_svg]:size-5">
      {children}
    </span>
  )
}

function PartyCard({
  party,
  onOpen,
  onClear,
}: {
  party: Party
  onOpen: () => void
  onClear: () => void
}) {
  const icon =
    party === null ? (
      <Users />
    ) : party.kind === 'driver' ? (
      <UserRound />
    ) : party.client.type === 'business' ? (
      <Building2 />
    ) : (
      <UserRound />
    )
  const name =
    party === null
      ? t('Walk-in customer')
      : party.kind === 'driver'
        ? party.driver.fullName
        : party.client.name
  const kind =
    party === null
      ? t('Retail')
      : party.kind === 'driver'
        ? driverKind(party.driver)
        : clientKind(party.client)
  const phone =
    party === null ? null : party.kind === 'driver' ? party.driver.phone : party.client.phone

  return (
    <div className="border-border rounded-card flex items-center gap-3 border p-2.5">
      <Tile>{icon}</Tile>
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <p className="text-fg truncate text-sm font-semibold">{name}</p>
        <p className="text-fg-muted text-2xs truncate">
          {t('Type')}: {kind}
          {phone ? ` · ${phone}` : ''}
        </p>
      </button>
      {party ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t('Clear the client')}
          onClick={onClear}
        >
          <X />
        </Button>
      ) : (
        <ChevronRight className="text-fg-subtle size-4 shrink-0" />
      )}
    </div>
  )
}

function TruckCard({
  option,
  selected,
  onClick,
  onChange,
  onClear,
}: {
  option: TruckOption
  selected: boolean
  onClick?: () => void
  onChange?: () => void
  onClear?: () => void
}) {
  const body = (
    <>
      <Tile>
        <TruckIcon />
      </Tile>
      <div className="min-w-0 flex-1 text-left">
        <p className="text-fg truncate text-sm font-semibold">
          {describeTruck(option.truck) || t('Truck')}
        </p>
        <p className="text-fg-muted text-2xs">
          {t('Number plate')}: <span className="text-fg font-mono">{option.truck.plate}</span>
        </p>
        <span
          className={cn(
            'mt-1 inline-block rounded px-1.5 py-0.5 text-[11px] font-medium',
            option.capacity === 'autopark'
              ? 'bg-primary-soft text-primary'
              : 'bg-surface-inset text-fg-muted',
          )}
        >
          {option.capacity === 'autopark'
            ? t('Autopark «{autopark}»', { autopark: option.autoparkName })
            : t('His own')}
        </span>
        {onChange ? (
          <div className="mt-1.5">
            <Button type="button" variant="secondary" size="sm" onClick={onChange}>
              {t('Change the truck')}
            </Button>
          </div>
        ) : null}
      </div>
    </>
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'rounded-card flex w-full items-center gap-3 border p-2.5 transition-colors',
          selected
            ? 'border-primary bg-primary-soft/40'
            : 'border-border hover:border-border-strong',
        )}
      >
        {body}
      </button>
    )
  }
  return (
    <div className="border-border rounded-card flex items-start gap-3 border p-2.5">
      {body}
      {onClear ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t('Clear the truck')}
          onClick={onClear}
        >
          <X />
        </Button>
      ) : null}
    </div>
  )
}

/** One search over everybody who can buy: drivers first, then clients on account. */
function PartySearch({
  open,
  onOpenChange,
  drivers,
  clients,
  value,
  onPick,
  onAddDriver,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  drivers: Driver[]
  clients: Client[]
  value: Party
  onPick: (party: Party) => void
  onAddDriver: () => void
}) {
  const [term, setTerm] = useState('')

  const { foundDrivers, foundClients } = useMemo(() => {
    const q = term.trim().toLowerCase()
    const digits = q.replace(/\D/g, '')
    const hit = (texts: (string | null | undefined)[], phone: string | null) =>
      !q ||
      texts.some((text) => text?.toLowerCase().includes(q)) ||
      (digits.length > 2 && (phone ?? '').replace(/\D/g, '').includes(digits))
    return {
      foundDrivers: drivers
        .filter((driver) => driver.status === 'active')
        .filter((driver) =>
          hit(
            [
              driver.fullName,
              driver.code,
              driver.autoparkName,
              driver.autoparkTruck?.plate,
              ...driver.ownTrucks.map((truck) => truck.plate),
            ],
            driver.phone,
          ),
        )
        .slice(0, 30),
      foundClients: clients
        .filter((client) => client.status === 'active')
        .filter((client) => hit([client.name], client.phone))
        .slice(0, 30),
    }
  }, [drivers, clients, term])

  const pick = (party: Party) => {
    setTerm('')
    onPick(party)
  }

  const row = (
    key: string,
    selected: boolean,
    title: string,
    detail: string,
    onClick: () => void,
  ) => (
    <li key={key}>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'hover:bg-canvas flex w-full flex-col rounded-md px-2 py-1.5 text-left',
          selected && 'bg-primary-soft/40',
        )}
      >
        <span className="text-fg truncate text-sm">{title}</span>
        <span className="text-fg-subtle text-2xs truncate">{detail}</span>
      </button>
    </li>
  )

  return (
    <Popover
      open={open}
      onOpenChange={onOpenChange}
      className="w-[26rem] p-0"
      align="start"
      trigger={
        <button
          type="button"
          className="border-border bg-surface text-fg-muted rounded-control hover:border-border-strong flex h-10 w-full items-center gap-2 border px-3 text-left text-sm"
        >
          <Search className="size-4 shrink-0" />
          <span className="truncate">{t('Search by name, phone or number plate…')}</span>
        </button>
      }
    >
      <div className="border-border border-b p-2">
        <Input
          autoFocus
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder={t('Search by name, phone or number plate…')}
          aria-label={t('Search clients')}
          className="h-8"
        />
      </div>
      <ul className="max-h-96 overflow-y-auto p-1">
        {row('walk-in', value === null, t('Walk-in customer'), t('Retail'), () => pick(null))}
        {foundDrivers.length ? (
          <li className="text-fg-subtle text-2xs px-2 pt-2 pb-1 font-semibold tracking-wide uppercase">
            {t('Drivers')}
          </li>
        ) : null}
        {foundDrivers.map((driver) =>
          row(
            driver.id,
            value?.kind === 'driver' && value.driver.id === driver.id,
            driver.fullName,
            [
              driverKind(driver),
              driver.phone,
              [...driver.ownTrucks, driver.autoparkTruck]
                .filter((truck) => truck !== null)
                .map((truck) => truck.plate)
                .join(', ') || null,
            ]
              .filter(Boolean)
              .join(' · '),
            () => pick({ kind: 'driver', driver }),
          ),
        )}
        {foundClients.length ? (
          <li className="text-fg-subtle text-2xs px-2 pt-2 pb-1 font-semibold tracking-wide uppercase">
            {t('Clients')}
          </li>
        ) : null}
        {foundClients.map((client) =>
          row(
            client.id,
            value?.kind === 'client' && value.client.id === client.id,
            client.name,
            [
              clientKind(client),
              client.phone,
              client.debt > 0 ? `${t('Owes us')} ${formatMoney(client.debt)}` : null,
            ]
              .filter(Boolean)
              .join(' · '),
            () => pick({ kind: 'client', client }),
          ),
        )}
        {foundDrivers.length === 0 && foundClients.length === 0 ? (
          <li className="text-fg-subtle px-2 py-4 text-center text-sm">{t('No client matches')}</li>
        ) : null}
        <li className="border-border mt-1 border-t pt-1">
          <button
            type="button"
            onClick={onAddDriver}
            className="hover:bg-canvas text-fg flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm"
          >
            <Plus className="size-4" />
            {t('Add a new owner-driver')}
          </button>
        </li>
      </ul>
    </Popover>
  )
}
