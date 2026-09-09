import { describe, expect, it } from 'vitest'
import { describeDriver, driverSchema, statusLabel } from './driver'

describe('describeDriver', () => {
  it('names the company and the plate', () => {
    expect(describeDriver({ clientName: 'Fura Logistics', vehiclePlate: '01 A 123 AA' })).toBe(
      'Fura Logistics · 01 A 123 AA',
    )
  })

  it('calls a driver with no company an owner-driver', () => {
    expect(describeDriver({ clientName: null, vehiclePlate: '01 B 456 BB' })).toBe(
      'Owner-driver · 01 B 456 BB',
    )
  })

  it('leaves out a plate that is not recorded', () => {
    expect(describeDriver({ clientName: 'Fura Logistics', vehiclePlate: null })).toBe(
      'Fura Logistics',
    )
  })
})

describe('driverSchema', () => {
  const valid = {
    fullName: 'Bekzod Normatov',
    phone: '+998 90 123 45 67',
    clientId: 'cl-1',
    vehiclePlate: '01 A 123 AA',
    licenceNumber: null,
    comment: null,
    status: 'active' as const,
  }

  it('accepts a sound driver', () => {
    expect(driverSchema.safeParse(valid).success).toBe(true)
  })

  it('refuses one with no name', () => {
    expect(driverSchema.safeParse({ ...valid, fullName: 'B' }).success).toBe(false)
  })

  it('allows an owner-driver with no company', () => {
    expect(driverSchema.safeParse({ ...valid, clientId: null }).success).toBe(true)
  })
})

describe('statusLabel', () => {
  it('reads in plain words', () => {
    expect(statusLabel('active')).toBe('Driving')
    expect(statusLabel('inactive')).toBe('No longer driving')
  })
})
