import { describe, expect, it } from 'vitest'
import { useDataStore } from '@/data/store'
import { buildStockLog } from '@/features/productLogs/api/logs'
import { amountPaid, orderTotal, payable, productsTotal, takesStock } from './onlineSale'

const sale = {
  lines: [
    {
      id: 'a',
      variationId: 'v',
      productId: 'p',
      sku: 's',
      name: 'n',
      imageUrl: null,
      quantity: 1,
      unitPrice: 123_000,
    },
  ],
  deliveryFee: 33_000,
  discount: 0,
  cashbackUsed: 0,
}

describe('online sale money', () => {
  it('adds products and delivery, less discount', () => {
    expect(productsTotal(sale)).toBe(123_000)
    expect(orderTotal(sale)).toBe(156_000)
    expect(orderTotal({ ...sale, discount: 6_000 })).toBe(150_000)
  })

  it('takes cashback off what has to be paid in money, never below zero', () => {
    expect(payable({ ...sale, cashbackUsed: 150_000 })).toBe(6_000)
    expect(payable({ ...sale, cashbackUsed: 500_000 })).toBe(0)
  })

  it('counts successful payments and takes refunds back off', () => {
    const t = (status: 'success' | 'refunded' | 'failed', amount: number) => ({
      id: status,
      provider: 'payme' as const,
      reference: 'r',
      status,
      amount,
      createdAt: '2026-09-01',
    })
    expect(amountPaid({ transactions: [t('success', 6_000), t('failed', 6_000)] })).toBe(6_000)
    expect(amountPaid({ transactions: [t('success', 6_000), t('refunded', 6_000)] })).toBe(0)
  })

  it('holds stock unless cancelled', () => {
    expect(takesStock({ status: 'preparing' })).toBe(true)
    expect(takesStock({ status: 'cancelled' })).toBe(false)
    expect(takesStock({ status: 'returned' })).toBe(false)
  })
})

describe('online sales and stock', () => {
  it('every line of a live order is a movement out of the shelf it was picked from', () => {
    const state = useDataStore.getState()
    const log = buildStockLog(state)
    const live = state.onlineSales.find((s) => takesStock(s))!
    const entries = log.filter((e) => e.kind === 'online_sale' && e.documentId === live.id)
    expect(entries).toHaveLength(live.lines.length)
    expect(entries.every((e) => e.delta < 0 && e.locationId === live.locationId)).toBe(true)
  })

  it('a cancelled order leaves nothing in the log', () => {
    const state = useDataStore.getState()
    const cancelled = state.onlineSales.find((s) => s.status === 'cancelled')!
    expect(buildStockLog(state).some((e) => e.documentId === cancelled.id)).toBe(false)
  })
})
