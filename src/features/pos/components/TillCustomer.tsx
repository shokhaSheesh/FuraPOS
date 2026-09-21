import { useState } from 'react'
import { Button } from '@/shared/ui/Button'
import { Select } from '@/shared/ui/Select'
import { SegmentedControl } from '@/shared/ui/SegmentedControl'
import { formatMoney } from '@/shared/lib/format'
import { t } from '@/shared/i18n'
import { useDataStore } from '@/data/store'
import { useAutoparksWithDrivers } from '@/features/drivers/api/drivers'
import {
  DRIVER_SECTIONS,
  capacityOfSection,
  describeCapacity,
  describeTruck,
  soleTruckFor,
  trucksFor,
  type Driver,
} from '@/features/drivers/model/driver'
import { DriverPicker } from '@/features/sales/components/DriverPicker'
import { NewDriverModal } from '@/features/sales/components/NewDriverModal'
import type { Client } from '@/features/sales/api/sales'
import { ClientPicker } from './ClientPicker'

/** Who is buying: whose account the sale lands on, who collected it, and for which truck. */
export interface TillBuyer {
  client: Client | null
  driver: Driver | null
  truckPlate: string | null
  /** How many trucks he could mean; more than one needs a choice before paying. */
  truckChoices: number
}

export const NOBODY: TillBuyer = { client: null, driver: null, truckPlate: null, truckChoices: 0 }

/** Several trucks and none chosen: the purchase would otherwise land on a guess. */
export const needsTruck = (buyer: TillBuyer) => buyer.truckChoices > 1 && !buyer.truckPlate

/**
 * Who is at the counter — the same questions the sale has always asked, in
 * the same order: which kind of driver, which company if it is a fleet, which
 * man, and which truck when he has more than one.
 *
 * A man who owns a lorry *and* drives for an autopark is two customers, and
 * the kind asked first is what says which of them walked in. The company is
 * the customer whether or not a driver is named, so picking it sets the
 * account on its own.
 */
export function TillCustomer({
  buyer,
  onChange,
}: {
  buyer: TillBuyer
  onChange: (buyer: TillBuyer) => void
}) {
  const allClients = useDataStore((s) => s.clients)
  const autoparks = useAutoparksWithDrivers()
  const [section, setSection] = useState<'independent' | 'autopark'>('independent')
  const [autoparkId, setAutoparkId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const capacity = capacityOfSection(section)

  const pickDriver = (driver: Driver | null) =>
    onChange({
      driver,
      truckChoices: driver ? trucksFor(driver, capacity).length : 0,
      // An autopark assigns one truck, so that settles itself. A man with three
      // lorries has to say which he came in.
      truckPlate: driver ? (soleTruckFor(driver, capacity)?.plate ?? null) : null,
      client:
        driver && capacity === 'autopark'
          ? (allClients.find((entry) => entry.id === driver.autoparkId) ?? null)
          : // Buying for himself is not a company purchase, so the company's
            // promotion must not apply.
            section === 'autopark'
            ? buyer.client
            : null,
    })

  const trucks = buyer.driver ? trucksFor(buyer.driver, capacity) : []

  return (
    <div className="space-y-2">
      {/* Whose account it goes on. Picking an autopark driver below sets it too. */}
      <ClientPicker value={buyer.client} onChange={(client) => onChange({ ...buyer, client })} />
      <SegmentedControl
        aria-label={t('Which kind of driver is buying')}
        value={section}
        onChange={(next) => {
          setSection(next)
          setAutoparkId(null)
          onChange(NOBODY)
        }}
        options={DRIVER_SECTIONS}
      />
      {section === 'autopark' ? (
        <Select
          className="w-full"
          aria-label={t('Autopark')}
          placeholder={t('Choose an autopark')}
          value={autoparkId ?? undefined}
          onChange={(id) => {
            setAutoparkId(id)
            onChange({
              client: allClients.find((entry) => entry.id === id) ?? null,
              driver: null,
              truckPlate: null,
              truckChoices: 0,
            })
          }}
          options={autoparks}
        />
      ) : null}
      <DriverPicker
        section={section}
        autoparkId={autoparkId ?? undefined}
        disabled={section === 'autopark' && autoparkId === null}
        value={buyer.driver}
        onChange={pickDriver}
        onAddNew={() => setAdding(true)}
      />
      {buyer.driver ? (
        <p className="text-fg-subtle text-2xs">
          {t('Buying for')} {describeCapacity(buyer.driver, capacity)}
        </p>
      ) : null}
      {trucks.length > 1 ? (
        <div className="grid gap-1.5">
          {trucks.map((truck) => (
            <Button
              key={truck.plate}
              type="button"
              size="sm"
              variant={buyer.truckPlate === truck.plate ? 'primary' : 'secondary'}
              className="justify-start font-normal"
              onClick={() => onChange({ ...buyer, truckPlate: truck.plate })}
            >
              <span className="font-mono">{truck.plate}</span>
              <span className="truncate opacity-70">{describeTruck(truck)}</span>
            </Button>
          ))}
          {buyer.truckPlate === null ? (
            <p className="text-danger text-2xs">
              {t('He owns')} {trucks.length} {t('trucks — say which this is for.')}
            </p>
          ) : null}
        </div>
      ) : null}
      {buyer.client && buyer.client.debt > 0 ? (
        <p className="text-warning text-2xs">
          {buyer.client.name} {t('already owes')} {formatMoney(buyer.client.debt)}.
        </p>
      ) : null}
      <NewDriverModal open={adding} onOpenChange={setAdding} onCreated={pickDriver} />
    </div>
  )
}
