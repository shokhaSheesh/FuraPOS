import { describe, expect, it } from 'vitest'
import {
  capacitiesOf,
  capacityOfSection,
  describeCapacity,
  describeTruck,
  driverSchema,
  inSection,
  kindOf,
  soleCapacity,
  soleTruckFor,
  statusLabel,
  trucksFor,
} from './driver'

const scania = { plate: '40 E 678 HH', make: 'Scania', model: 'R450' }
const isuzu = { plate: '25 F 901 II', make: 'Isuzu', model: 'NPR 75' }
const foton = { plate: '25 G 404 KK', make: 'Foton', model: 'Auman' }
const man = { plate: '01 A 456 BB', make: 'MAN', model: 'TGX 18.440' }
const kamaz = { plate: '01 K 777 AA', make: 'Kamaz', model: '5490' }

const independent = {
  ownTrucks: [scania],
  autoparkId: null,
  autoparkName: null,
  autoparkTruck: null,
}

/** An owner-driver who did well and bought a second lorry. */
const fleetOfHisOwn = {
  ownTrucks: [isuzu, foton],
  autoparkId: null,
  autoparkName: null,
  autoparkTruck: null,
}

const autoparkOnly = {
  ownTrucks: [],
  autoparkId: 'cl-1',
  autoparkName: 'Trans Logistik',
  autoparkTruck: man,
}

const both = {
  ownTrucks: [kamaz],
  autoparkId: 'cl-1',
  autoparkName: 'Trans Logistik',
  autoparkTruck: man,
}

describe('describeTruck', () => {
  it('reads as make then model', () => {
    expect(describeTruck(man)).toBe('MAN TGX 18.440')
  })

  it('falls back to whatever is known', () => {
    expect(describeTruck({ make: 'MAN', model: null })).toBe('MAN')
    expect(describeTruck({ make: null, model: null })).toBe('')
  })
})

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

describe('trucksFor', () => {
  it("never mixes his own trucks with the autopark's", () => {
    // The correction that mattered: his own truck must not appear under the
    // autopark, nor theirs under him.
    expect(trucksFor(both, 'own')).toEqual([kamaz])
    expect(trucksFor(both, 'autopark')).toEqual([man])
  })

  it('lists every truck an owner-driver has', () => {
    expect(trucksFor(fleetOfHisOwn, 'own')).toEqual([isuzu, foton])
  })

  it('gives a company driver nothing of his own', () => {
    expect(trucksFor(autoparkOnly, 'own')).toEqual([])
  })

  it('gives an owner-driver no autopark truck', () => {
    expect(trucksFor(independent, 'autopark')).toEqual([])
  })
})

describe('soleTruckFor', () => {
  it('settles the truck when he has only one', () => {
    expect(soleTruckFor(independent, 'own')).toEqual(scania)
  })

  it('is null when he owns several — the counter has to ask which he came in', () => {
    expect(soleTruckFor(fleetOfHisOwn, 'own')).toBeNull()
  })

  it('is always settled for an autopark, which assigns exactly one', () => {
    expect(soleTruckFor(both, 'autopark')).toEqual(man)
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

describe('kindOf', () => {
  it('labels each of the three shapes', () => {
    expect(kindOf(independent)).toBe('independent')
    expect(kindOf(autoparkOnly)).toBe('autopark')
    expect(kindOf(both)).toBe('both')
  })
})

describe('inSection', () => {
  it('puts a driver who is both in both sections', () => {
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

describe('capacityOfSection', () => {
  it('maps each tab to the trucks it should show', () => {
    expect(capacityOfSection('independent')).toBe('own')
    expect(capacityOfSection('autopark')).toBe('autopark')
  })
})

describe('describeCapacity', () => {
  it('names his truck when he has just the one', () => {
    expect(describeCapacity(both, 'own')).toBe('Himself · 01 K 777 AA')
  })

  it('promises no particular truck when he owns several', () => {
    expect(describeCapacity(fleetOfHisOwn, 'own')).toBe('Himself')
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
    ownTrucks: [{ plate: '01 A 123 AA', make: 'MAN', model: 'TGX' }],
    autoparkId: null,
    autoparkTruck: null,
    comment: null,
    status: 'active' as const,
  }

  it('accepts an owner-driver', () => {
    expect(driverSchema.safeParse(valid).success).toBe(true)
  })

  it('accepts one with several trucks of his own', () => {
    const result = driverSchema.safeParse({
      ...valid,
      ownTrucks: [...valid.ownTrucks, { plate: '01 B 456 BB', make: null, model: null }],
    })
    expect(result.success).toBe(true)
  })

  it('accepts a driver who is both', () => {
    const result = driverSchema.safeParse({
      ...valid,
      autoparkId: 'cl-1',
      autoparkTruck: { plate: '01 B 456 BB', make: 'DAF', model: 'XF 105' },
    })
    expect(result.success).toBe(true)
  })

  it('accepts a truck whose make and model nobody recorded', () => {
    const result = driverSchema.safeParse({
      ...valid,
      ownTrucks: [{ plate: '01 A 123 AA', make: null, model: null }],
    })
    expect(result.success).toBe(true)
  })

  it('refuses a driver with neither a truck nor an autopark — he could buy as nobody', () => {
    expect(driverSchema.safeParse({ ...valid, ownTrucks: [] }).success).toBe(false)
  })

  it("refuses an autopark driver with no truck — the owner's app would have nothing to show", () => {
    const result = driverSchema.safeParse({
      ...valid,
      ownTrucks: [],
      autoparkId: 'cl-1',
      autoparkTruck: null,
    })
    expect(result.success).toBe(false)
  })

  it('refuses a truck with no plate — the plate is what identifies it', () => {
    const result = driverSchema.safeParse({
      ...valid,
      ownTrucks: [{ plate: '', make: 'MAN', model: 'TGX' }],
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
