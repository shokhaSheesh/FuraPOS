import { describe, expect, it } from 'vitest'
import type { Sale } from '@/features/sales/model/sale'
import type { VariationRow } from '@/features/products/model/product'
import { buildEmployeeStats } from '../api/employees'
import { daysSinceActive, initials, isDormant, type Employee } from './employee'

const variation = (id: string, costPrice: number): VariationRow =>
  ({ id, costPrice, costCurrency: 'UZS' }) as VariationRow

const sale = (over: Partial<Sale> = {}): Sale =>
  ({
    id: 's1',
    status: 'completed',
    sellerId: 'emp-1',
    createdAt: new Date().toISOString(),
    total: 100_000,
    lines: [{ variationId: 'v1', quantity: 2 }],
    ...over,
  }) as Sale

const employee = (over: Partial<Employee> = {}): Employee =>
  ({
    id: 'emp-1',
    fullName: 'Nodira Rasulova',
    status: 'active',
    lastActiveAt: new Date().toISOString(),
    ...over,
  }) as Employee

describe('what the sales ledger says about someone', () => {
  const stock = [variation('v1', 30_000)]

  it('adds up revenue, sales and units', () => {
    const stats = buildEmployeeStats([sale(), sale({ id: 's2' })], stock).get('emp-1')!
    expect(stats.revenue).toBe(200_000)
    expect(stats.sales).toBe(2)
    expect(stats.units).toBe(4)
    expect(stats.averageCheck).toBe(100_000)
  })

  it('ignores deleted sales', () => {
    // Otherwise anyone could inflate their own figures by typing and voiding.
    const stats = buildEmployeeStats([sale(), sale({ id: 's2', status: 'deleted' })], stock).get(
      'emp-1',
    )!
    expect(stats.revenue).toBe(100_000)
    expect(stats.sales).toBe(1)
  })

  it('ignores a sale with nobody attached to it', () => {
    expect(buildEmployeeStats([sale({ sellerId: null })], stock).size).toBe(0)
  })

  it('counts margin against what the goods cost', () => {
    // 100 000 sold, 2 units at 30 000 cost = 40 000 margin, 40%.
    const stats = buildEmployeeStats([sale()], stock).get('emp-1')!
    expect(stats.margin).toBe(40_000)
    expect(stats.marginRatio).toBeCloseTo(0.4)
  })

  it('separates this month from all time', () => {
    const lastYear = new Date(Date.now() - 400 * 86_400_000).toISOString()
    const stats = buildEmployeeStats([sale(), sale({ id: 's2', createdAt: lastYear })], stock).get(
      'emp-1',
    )!
    expect(stats.revenue).toBe(200_000)
    expect(stats.revenueThisMonth).toBe(100_000)
    expect(stats.salesThisMonth).toBe(1)
  })

  it('keeps people apart', () => {
    const stats = buildEmployeeStats([sale(), sale({ id: 's2', sellerId: 'emp-2' })], stock)
    expect(stats.get('emp-1')!.sales).toBe(1)
    expect(stats.get('emp-2')!.sales).toBe(1)
  })

  it('survives a product that no longer exists', () => {
    // Cost is unknown, so margin is the full sale rather than a crash.
    const stats = buildEmployeeStats([sale()], []).get('emp-1')!
    expect(stats.margin).toBe(100_000)
  })
})

describe('quiet logins', () => {
  it('measures the gap since the last sign-in', () => {
    const at = new Date(Date.now() - 5 * 86_400_000).toISOString()
    expect(daysSinceActive({ lastActiveAt: at })).toBe(5)
    expect(daysSinceActive({ lastActiveAt: null })).toBeNull()
  })

  it('flags an active account that has gone quiet', () => {
    const quiet = new Date(Date.now() - 45 * 86_400_000).toISOString()
    expect(isDormant(employee({ lastActiveAt: quiet }))).toBe(true)
    expect(isDormant(employee())).toBe(false)
  })

  it('treats an account that never signed in as quiet', () => {
    expect(isDormant(employee({ lastActiveAt: null }))).toBe(true)
  })

  it('does not flag someone who is suspended or has left', () => {
    // They are meant to be inactive; saying so twice is noise, not a finding.
    const quiet = new Date(Date.now() - 45 * 86_400_000).toISOString()
    expect(isDormant(employee({ status: 'suspended', lastActiveAt: quiet }))).toBe(false)
    expect(isDormant(employee({ status: 'archived', lastActiveAt: quiet }))).toBe(false)
  })
})

describe('initials', () => {
  it('takes the first two names', () => {
    expect(initials('Nodira Rasulova')).toBe('NR')
    expect(initials('Akhmet Dauletmuratov ogli')).toBe('AD')
    expect(initials('Sardor')).toBe('S')
  })
})
