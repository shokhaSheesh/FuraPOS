import { describe, expect, it } from 'vitest'
import { allocate, outstanding, settlementsFor } from './settlement'

const receipt = (id: string, at: string) => ({
  id,
  number: `GR-${id}`,
  receivedAt: at,
  createdAt: at,
})

const charge = (receiptId: string, amount: number) => ({
  kind: 'debt_charged' as const,
  amount,
  referenceType: 'goods_receipt',
  referenceId: receiptId,
})

const payment = (receiptId: string, amount: number) => ({
  kind: 'debt_repaid' as const,
  amount: -amount,
  referenceType: 'goods_receipt',
  referenceId: receiptId,
})

const RECEIPTS = [
  receipt('a', '2026-01-01'),
  receipt('b', '2026-02-01'),
  receipt('c', '2026-03-01'),
]

describe('settlementsFor', () => {
  it('says what each delivery cost and what is still owed on it', () => {
    const rows = settlementsFor(RECEIPTS, [charge('a', 1000), payment('a', 400)])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ number: 'GR-a', invoiced: 1000, paid: 400, pending: 600 })
  })

  it('treats a fully paid delivery as nothing pending', () => {
    const [row] = settlementsFor(RECEIPTS, [charge('a', 1000), payment('a', 1000)])
    expect(row?.pending).toBe(0)
    expect(outstanding(settlementsFor(RECEIPTS, [charge('a', 1000), payment('a', 1000)]))).toEqual(
      [],
    )
  })

  it('nets off a cancellation, which reverses the charge', () => {
    const reversal = { ...charge('a', -1000), kind: 'adjustment' as const }
    const [row] = settlementsFor(RECEIPTS, [charge('a', 1000), reversal])
    expect(row?.invoiced).toBe(0)
    expect(row?.pending).toBe(0)
  })

  it('never reports a negative pending, however much was paid', () => {
    // Overpaying makes supplier credit, which nothing models yet — it must not
    // show up as a delivery owing minus money.
    const [row] = settlementsFor(RECEIPTS, [charge('a', 1000), payment('a', 1500)])
    expect(row?.pending).toBe(0)
  })

  it('ignores movements that name no receipt', () => {
    const loose = {
      kind: 'debt_repaid' as const,
      amount: -500,
      referenceType: null,
      referenceId: null,
    }
    expect(settlementsFor(RECEIPTS, [loose])).toEqual([])
  })

  it('leaves out deliveries that were never charged', () => {
    const rows = settlementsFor(RECEIPTS, [charge('b', 50)])
    expect(rows.map((row) => row.receiptId)).toEqual(['b'])
  })

  it('orders by when the goods landed, oldest first', () => {
    const rows = settlementsFor(RECEIPTS, [charge('c', 1), charge('a', 1), charge('b', 1)])
    expect(rows.map((row) => row.receiptId)).toEqual(['a', 'b', 'c'])
  })
})

describe('allocate', () => {
  const settlements = settlementsFor(RECEIPTS, [
    charge('a', 100),
    charge('b', 200),
    charge('c', 50),
  ])

  it('clears the oldest debt first', () => {
    const { allocations, unallocated } = allocate(settlements, 100)
    expect(allocations).toEqual([{ receiptId: 'a', number: 'GR-a', amount: 100 }])
    expect(unallocated).toBe(0)
  })

  it('spreads a lump sum across deliveries', () => {
    const { allocations } = allocate(settlements, 250)
    expect(allocations).toEqual([
      { receiptId: 'a', number: 'GR-a', amount: 100 },
      { receiptId: 'b', number: 'GR-b', amount: 150 },
    ])
  })

  it('splits a delivery when the payment only covers part of it', () => {
    const { allocations } = allocate(settlements, 40)
    expect(allocations).toEqual([{ receiptId: 'a', number: 'GR-a', amount: 40 }])
  })

  it('hands back what it could not place, so the caller can refuse it', () => {
    const { allocations, unallocated } = allocate(settlements, 1000)
    expect(allocations.reduce((sum, entry) => sum + entry.amount, 0)).toBe(350)
    expect(unallocated).toBe(650)
  })

  it('allocates nothing when there is nothing outstanding', () => {
    expect(allocate([], 500)).toEqual({ allocations: [], unallocated: 500 })
  })
})
