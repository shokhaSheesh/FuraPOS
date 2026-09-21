import { useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { Search, Truck as TruckIcon, UserPlus, UserRound, X } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { Select } from '@/shared/ui/Select'
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
  const [adding, setAdding] = useState(false)

  const options = useMemo(() => trucksOf(buyer.party), [buyer.party])
  const keyOf = (option: TruckOption) => `${option.capacity}-${option.truck.plate}`

  const pickParty = (party: Party) => onChange(resolveBuyer(party, null, clients))
  const pickTruck = (option: TruckOption | null) =>
    onChange(resolveBuyer(buyer.party, option, clients))

  return (
    <div className="space-y-4">
      <Step number={1} title={t('Find the driver')}>
        {/* Once he is found the search has done its job; the × brings it back. */}
        {buyer.party ? (
          <PartyCard driver={buyer.party.driver} onClear={() => pickParty(null)} />
        ) : (
          <>
            <DriverSearch
              inputRef={searchRef}
              drivers={drivers}
              value={buyer.party}
              onPick={pickParty}
              onAddDriver={() => setAdding(true)}
            />
            <p className="text-fg-subtle text-2xs">{t('No driver chosen — a walk-in sale.')}</p>
          </>
        )}
      </Step>

      {options.length > 0 ? (
        <Step number={2} title={t('Choose the truck')}>
          {options.length === 1 ? (
            // One truck is chosen for him; there is nothing to pick.
            <TruckCard option={options[0]!} />
          ) : (
            <div className="space-y-1.5">
              <Select
                className="w-full"
                aria-label={t('Truck')}
                placeholder={t('Which truck is it for?')}
                value={buyer.truck ? keyOf(buyer.truck) : undefined}
                onChange={(key) =>
                  pickTruck(options.find((option) => keyOf(option) === key) ?? null)
                }
                options={options.map((option) => ({
                  value: keyOf(option),
                  label: `${option.truck.plate} · ${describeTruck(option.truck) || t('Truck')} · ${
                    option.capacity === 'autopark'
                      ? t('Autopark «{autopark}»', { autopark: option.autoparkName })
                      : t('His own')
                  }`,
                }))}
              />
              {buyer.truck ? (
                <CapacityTag option={buyer.truck} />
              ) : needsTruck(buyer) ? (
                <p className="text-danger text-2xs">
                  {t('Say which truck this is for — it decides whose purchase it is.')}
                </p>
              ) : null}
            </div>
          )}
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

/** Whose purchase the truck makes it: his own, or his autopark's. */
function CapacityTag({ option }: { option: TruckOption }) {
  return (
    <span
      className={cn(
        'inline-block rounded-full px-2 py-0.5 text-[11px] font-medium',
        option.capacity === 'autopark'
          ? 'bg-primary-soft text-primary'
          : 'bg-surface-inset text-fg-muted',
      )}
    >
      {option.capacity === 'autopark'
        ? t('Autopark «{autopark}»', { autopark: option.autoparkName })
        : t('His own')}
    </span>
  )
}

function Step({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-fg text-sm font-medium">
          {number}. {title}
        </h2>
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

function PartyCard({ driver, onClear }: { driver: Driver; onClear: () => void }) {
  return (
    <div className="border-border rounded-card flex items-center gap-3 border p-2.5">
      <Tile>
        <UserRound />
      </Tile>
      <div className="min-w-0 flex-1">
        <p className="text-fg truncate text-sm font-medium">{driver.fullName}</p>
        <p className="text-fg-muted text-2xs truncate">
          {driverKind(driver)}
          {driver.phone ? ` · ${driver.phone}` : ''}
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={t('Clear the client')}
        title={t('Choose another driver')}
        onClick={onClear}
      >
        <X />
      </Button>
    </div>
  )
}

/** The one truck a driver has: shown, not chosen. */
function TruckCard({ option }: { option: TruckOption }) {
  return (
    <div className="border-border rounded-card flex items-center gap-3 border p-2.5">
      <Tile>
        <TruckIcon />
      </Tile>
      <div className="min-w-0 flex-1">
        <p className="text-fg truncate text-sm font-medium">
          {describeTruck(option.truck) || t('Truck')}
        </p>
        <p className="text-fg-muted text-2xs">
          {t('Number plate')}: <span className="text-fg font-mono">{option.truck.plate}</span>
        </p>
        <div className="mt-1">
          <CapacityTag option={option} />
        </div>
      </div>
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
