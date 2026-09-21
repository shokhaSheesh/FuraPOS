import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import {
  ChevronRight,
  Search,
  Truck as TruckIcon,
  UserPlus,
  UserRound,
  Users,
  X,
} from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { cn } from '@/shared/lib/cn'
import { formatMoney } from '@/shared/lib/format'
import { t } from '@/shared/i18n'
import { useDataStore } from '@/data/store'
import { describeTruck, type Driver } from '@/features/drivers/model/driver'
import { NewDriverModal } from '@/features/sales/components/NewDriverModal'
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

/**
 * Who is buying, in the two steps of the client's reference.
 *
 * 1. **Find the driver** — owner-drivers and autopark drivers in one search.
 * 2. **Pick the truck** — his own trucks and his autopark's. The truck decides whose purchase it is; a single truck
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
  const searchRef = useRef<HTMLInputElement>(null)
  const [choosing, setChoosing] = useState(false)
  const [adding, setAdding] = useState(false)

  const options = useMemo(() => trucksOf(buyer.party), [buyer.party])

  const pickParty = (party: Party) => {
    setChoosing(false)
    onChange(resolveBuyer(party, null, clients))
  }

  const pickTruck = (option: TruckOption | null) => {
    setChoosing(false)
    onChange(resolveBuyer(buyer.party, option, clients))
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'F2') {
        event.preventDefault()
        searchRef.current?.focus()
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
      <Step number={1} title={t('Find the driver')} hotkey="F2">
        <DriverSearch
          inputRef={searchRef}
          drivers={drivers}
          value={buyer.party}
          onPick={pickParty}
          onAddDriver={() => setAdding(true)}
        />
        <PartyCard
          party={buyer.party}
          onOpen={() => searchRef.current?.focus()}
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
  const icon = party === null ? <Users /> : <UserRound />
  const name = party === null ? t('Walk-in customer') : party.driver.fullName
  const kind = party === null ? t('Retail') : driverKind(party.driver)
  const phone = party === null ? null : party.driver.phone

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

/**
 * Step 1's one search field. Typing lists the drivers beneath it — name,
 * phone, card code or any of his number plates — and choosing one closes the
 * list. There is no second search inside a popup: the field is the search.
 */
function DriverSearch({
  inputRef,
  drivers,
  value,
  onPick,
  onAddDriver,
}: {
  inputRef: RefObject<HTMLInputElement | null>
  drivers: Driver[]
  value: Party
  onPick: (party: Party) => void
  onAddDriver: () => void
}) {
  const [term, setTerm] = useState('')
  const [open, setOpen] = useState(false)

  const found = useMemo(() => {
    const q = term.trim().toLowerCase()
    const digits = q.replace(/\D/g, '')
    return drivers
      .filter((driver) => driver.status === 'active')
      .filter(
        (driver) =>
          !q ||
          [
            driver.fullName,
            driver.code,
            driver.autoparkName,
            driver.autoparkTruck?.plate,
            ...driver.ownTrucks.map((truck) => truck.plate),
          ].some((text) => text?.toLowerCase().includes(q)) ||
          (digits.length > 2 && (driver.phone ?? '').replace(/\D/g, '').includes(digits)),
      )
      .slice(0, 30)
  }, [drivers, term])

  const pick = (party: Party) => {
    setTerm('')
    setOpen(false)
    inputRef.current?.blur()
    onPick(party)
  }

  return (
    <div className="flex items-center gap-2">
      <div className="relative min-w-0 flex-1">
        <Search className="text-fg-subtle pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          ref={inputRef}
          value={term}
          onChange={(event) => {
            setTerm(event.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          // Late enough for a click on a result to land first.
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setOpen(false)
            if (event.key === 'Enter' && found[0]) pick({ kind: 'driver', driver: found[0] })
          }}
          placeholder={t('Search a driver by name, phone or number plate…')}
          aria-label={t('Search drivers')}
          className="pl-9"
        />
        {open ? (
          <ul className="border-border bg-surface shadow-popover rounded-control absolute inset-x-0 top-full z-30 mt-1 max-h-80 overflow-y-auto border p-1">
            {found.map((driver) => (
              <li key={driver.id}>
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => pick({ kind: 'driver', driver })}
                  className={cn(
                    'hover:bg-canvas flex w-full flex-col rounded-md px-2 py-1.5 text-left',
                    value?.driver.id === driver.id && 'bg-primary-soft/40',
                  )}
                >
                  <span className="text-fg truncate text-sm">{driver.fullName}</span>
                  <span className="text-fg-subtle text-2xs truncate">
                    {[
                      driverKind(driver),
                      driver.phone,
                      [...driver.ownTrucks, driver.autoparkTruck]
                        .filter((truck) => truck !== null)
                        .map((truck) => truck.plate)
                        .join(', ') || null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </button>
              </li>
            ))}
            {found.length === 0 ? (
              <li className="text-fg-subtle px-2 py-3 text-center text-sm">
                {t('No driver matches')}
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setOpen(false)
                    onAddDriver()
                  }}
                  className="text-primary mt-1 flex w-full items-center justify-center gap-1 text-sm hover:underline"
                >
                  <UserPlus className="size-4" />
                  {t('Add a new owner-driver')}
                </button>
              </li>
            ) : null}
          </ul>
        ) : null}
      </div>
      <Button
        type="button"
        variant="secondary"
        size="icon"
        className="size-10"
        aria-label={t('Add a new owner-driver')}
        title={t('Add a new owner-driver')}
        onClick={onAddDriver}
      >
        <UserPlus />
      </Button>
    </div>
  )
}
