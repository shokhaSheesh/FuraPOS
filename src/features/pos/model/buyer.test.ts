import { describe, expect, it } from 'vitest'
import type { Client } from '@/features/sales/api/sales'
import type { Driver } from '@/features/drivers/model/driver'
import { fleetOf, needsTruck, resolveBuyer, trucksOfDriver, type Party } from './buyer'

const truck = (plate: string) => ({ plate, make: 'MAN', model: 'TGX' })
const driver = (patch: Partial<Driver>): Driver =>
  ({
    id: 'd1',
    fullName: 'Rustam',
    ownTrucks: [],
    autoparkId: null,
    autoparkName: null,
    autoparkTruck: null,
    ...patch,
  }) as unknown as Driver
const fleet = { id: 'c1', name: 'Автопарк «Восток»' } as unknown as Client
const clients = [fleet]
const asParty = (d: Driver): Party => ({ kind: 'driver', driver: d })

describe('who is buying, settled by the truck', () => {
  it('takes the only truck without asking, and it is his own purchase', () => {
    const owner = driver({ ownTrucks: [truck('01 A 111 AA')] })
    const buyer = resolveBuyer(asParty(owner), null, [owner], clients)
    expect(buyer.truck?.truck.plate).toBe('01 A 111 AA')
    expect(buyer.client).toBeNull()
    expect(needsTruck(buyer)).toBe(false)
  })

  it('puts the sale on the autopark when its truck is the only one', () => {
    const hired = driver({ autoparkId: 'c1', autoparkName: fleet.name, autoparkTruck: truck('X') })
    expect(resolveBuyer(asParty(hired), null, [hired], clients).client).toBe(fleet)
  })

  it('asks which truck when he has his own and the autopark’s', () => {
    const both = driver({
      ownTrucks: [truck('OWN')],
      autoparkId: 'c1',
      autoparkName: fleet.name,
      autoparkTruck: truck('FLEET'),
    })
    const options = trucksOfDriver(both)
    expect(options.map((o) => o.capacity)).toEqual(['own', 'autopark'])

    const undecided = resolveBuyer(asParty(both), null, [both], clients)
    expect(needsTruck(undecided)).toBe(true)
    expect(undecided.client).toBeNull()

    expect(resolveBuyer(asParty(both), options[0]!, [both], clients).client).toBeNull()
    expect(resolveBuyer(asParty(both), options[1]!, [both], clients).client).toBe(fleet)
  })

  it('offers a company its fleet, once per truck, and does not insist on one', () => {
    const a = driver({ id: 'a', autoparkId: 'c1', autoparkTruck: truck('T1') })
    const b = driver({ id: 'b', autoparkId: 'c1', autoparkTruck: truck('T2') })
    const c = driver({ id: 'c', autoparkId: 'c1', autoparkTruck: truck('T1') })
    expect(fleetOf(fleet, [a, b, c]).map((o) => o.truck.plate)).toEqual(['T1', 'T2'])
    const buyer = resolveBuyer({ kind: 'client', client: fleet }, null, [a, b, c], clients)
    expect(buyer.client).toBe(fleet)
    expect(needsTruck(buyer)).toBe(false)
  })
})
