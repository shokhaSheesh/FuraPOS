import { describe, expect, it } from 'vitest'
import {
  capacitiesOf,
  describeCapacity,
  driverSchema,
  inSection,
  kindOf,
  soleCapacity,
  statusLabel,
  truckFor,
  type Driver,
} from './driver'

const independent: Pick<
  Driver,
  'ownTruckPlate' | 'autoparkId' | 'autoparkTruckPlate' | 'autoparkName'
> = {
  ownTruckPlate: '40 E 678 HH',
  autoparkId: null,
  autoparkName: null,
  autoparkTruckPlate: null,
}

const autoparkOnly = {
  ownTruckPlate: null,
  autoparkId: 'cl-1',
  autoparkName: 'Trans Logistik',
  autoparkTruckPlate: '01 A 123 AA',
}

const both = {
  ownTruckPlate: '01 K 777 AA',
  autoparkId: 'cl-1',
  autoparkName: 'Trans Logistik',
  autoparkTruckPlate: '01 A 456 BB',
}

describe('capacitiesOf', () => {
  it('gives an owner-driver one capacity', () => {
    expect(capacitiesOf(independent)).toEqual(['own'])
  })

  it('gives a company driver one capacity', () => {
    expect(capacitiesOf(autoparkOnly)).toEqual(['autopark'])
  })

  it('gives a driver who is both two', () => {
    expect(capacitiesOf(both)).toEqual(['own', 'autopark'])
  })
})

describe('soleCapacity', () => {
  it('resolves without asking when there is only one', () => {
    expect(soleCapacity(independent)).toBe('own')
    expect(soleCapacity(autoparkOnly)).toBe('autopark')
  })

  it('is null for a driver who is both — the one case the counter must ask', () => {
    expect(soleCapacity(both)).toBeNull()
  })
})

describe('truckFor', () => {
  it('picks his own truck when he buys for himself', () => {
    expect(truckFor(both, 'own')).toBe('01 K 777 AA')
  })

  it("picks the autopark's truck when he buys on their contract", () => {
    expect(truckFor(both, 'autopark')).toBe('01 A 456 BB')
  })

  it('has no autopark truck for an owner-driver', () => {
    expect(truckFor(independent, 'autopark')).toBeNull()
  })
})

describe('kindOf', () => {
  it('labels each of the three shapes', () => {
    expect(kindOf(independent)).toBe('independent')
    expect(kindOf(autoparkOnly)).toBe('autopark')
    expect(kindOf(both)).toBe('both')
  })
})

describe('inSection', () => {
  it('puts a driver who is both in both sections', () => {
    // The counts overlap on purpose: he is a customer twice over, and
    // hiding him from either list would hide half his purchases.
    expect(inSection(both, 'independent')).toBe(true)
    expect(inSection(both, 'autopark')).toBe(true)
  })

  it('keeps an owner-driver out of the autopark section', () => {
    expect(inSection(independent, 'autopark')).toBe(false)
  })

  it('keeps a company driver out of the independent section', () => {
    expect(inSection(autoparkOnly, 'independent')).toBe(false)
  })
})

describe('describeCapacity', () => {
  it('names the truck he buys in for himself', () => {
    expect(describeCapacity(both, 'own')).toBe('Himself · 01 K 777 AA')
  })

  it('names the company and their truck', () => {
    expect(describeCapacity(both, 'autopark')).toBe('Trans Logistik · 01 A 456 BB')
  })
})

describe('driverSchema', () => {
  const valid = {
    fullName: 'Bekzod Normatov',
    phone: '+998 90 123 45 67',
    licenceNumber: null,
    ownTruckPlate: '01 A 123 AA',
    autoparkId: null,
    autoparkTruckPlate: null,
    comment: null,
    status: 'active' as const,
  }

  it('accepts an owner-driver', () => {
    expect(driverSchema.safeParse(valid).success).toBe(true)
  })

  it('accepts a driver who is both', () => {
    const result = driverSchema.safeParse({
      ...valid,
      autoparkId: 'cl-1',
      autoparkTruckPlate: '01 B 456 BB',
    })
    expect(result.success).toBe(true)
  })

  it('refuses a driver with neither a truck nor an autopark — he could buy as nobody', () => {
    const result = driverSchema.safeParse({ ...valid, ownTruckPlate: null })
    expect(result.success).toBe(false)
  })

  it("refuses an autopark driver with no truck — the owner's app would have nothing to show", () => {
    const result = driverSchema.safeParse({
      ...valid,
      ownTruckPlate: null,
      autoparkId: 'cl-1',
      autoparkTruckPlate: null,
    })
    expect(result.success).toBe(false)
  })

  it('refuses one with no name', () => {
    expect(driverSchema.safeParse({ ...valid, fullName: 'B' }).success).toBe(false)
  })
})

describe('statusLabel', () => {
  it('reads in plain words', () => {
    expect(statusLabel('active')).toBe('Driving')
    expect(statusLabel('inactive')).toBe('No longer driving')
  })
})
