import { describe, expect, it } from 'vitest'
import { useDataStore } from '@/data/store'
import { buildStockLog } from '../api/logs'
import { logKindLabel, STOCK_LOG_KINDS } from './log'

const log = () => buildStockLog(useDataStore.getState())

describe('the stock log', () => {
  it('has an entry for every kind of document that moves stock', () => {
    const kinds = new Set(log().map((entry) => entry.kind))
    expect(kinds.has('receipt')).toBe(true)
    expect(kinds.has('sale')).toBe(true)
    expect(kinds.has('transfer_in')).toBe(true)
    expect(kinds.has('transfer_out')).toBe(true)
  })

  it('is newest first', () => {
    const entries = log()
    for (let i = 1; i < Math.min(entries.length, 50); i += 1) {
      expect(entries[i - 1]!.at >= entries[i]!.at).toBe(true)
    }
  })

  it('never records a change of nothing', () => {
    expect(log().every((entry) => entry.delta !== 0)).toBe(true)
  })

  it('takes stock away for a sale and adds it for a receipt', () => {
    const entries = log()
    expect(entries.filter((e) => e.kind === 'sale').every((e) => e.delta < 0)).toBe(true)
    expect(entries.filter((e) => e.kind === 'receipt').every((e) => e.delta > 0)).toBe(true)
  })

  it('records both sides of a transfer, at different locations', () => {
    const entries = log()
    const out = entries.find((e) => e.kind === 'transfer_out')!
    const back = entries.find((e) => e.kind === 'transfer_in' && e.documentId === out.documentId)!
    expect(back.delta).toBe(-out.delta)
    expect(back.locationId).not.toBe(out.locationId)
  })

  it('links every entry to the document that caused it', () => {
    expect(log().every((entry) => Boolean(entry.documentId && entry.documentNumber))).toBe(true)
  })

  it('gives a correction a real reason and leaves the rest blank', () => {
    // OX's reason column says "automatic update" on every row, which is no
    // reason at all. Ours carries one only where a document records one.
    const entries = log()
    const correction = entries.find((e) => e.kind === 'correction')
    if (correction) expect(correction.reason).toBeTruthy()
    expect(entries.filter((e) => e.kind === 'sale').every((e) => e.reason === null)).toBe(true)
  })
})

describe('the running balance', () => {
  it('lands exactly on what the product page shows', () => {
    // The whole point of working backwards from current stock: the last entry
    // for a shelf must equal that shelf's stock today, or the log and the
    // catalogue disagree and neither can be trusted.
    const entries = buildStockLog(useDataStore.getState())
    const { variations } = useDataStore.getState()

    const newestPerShelf = new Map<string, (typeof entries)[number]>()
    for (const entry of entries) {
      const key = `${entry.variationId}@${entry.locationId}`
      if (!newestPerShelf.has(key)) newestPerShelf.set(key, entry) // already newest-first
    }

    let checked = 0
    for (const [key, entry] of newestPerShelf) {
      if (entry.balanceAfter === null) continue
      const [variationId, locationId] = key.split('@')
      const row = variations
        .find((v) => v.id === variationId)
        ?.stockByLocation.find((s) => s.locationId === locationId)
      if (!row) continue
      expect(entry.balanceAfter).toBe(row.quantity)
      checked += 1
    }
    expect(checked).toBeGreaterThan(10)
  })

  it('moves by exactly the delta between consecutive entries on one shelf', () => {
    const entries = buildStockLog(useDataStore.getState())
    const shelf = entries
      .filter(
        (e) => e.variationId === entries[0]!.variationId && e.locationId === entries[0]!.locationId,
      )
      .reverse() // oldest first

    for (let i = 1; i < shelf.length; i += 1) {
      const previous = shelf[i - 1]!
      const current = shelf[i]!
      if (previous.balanceAfter === null || current.balanceAfter === null) continue
      expect(current.balanceAfter - previous.balanceAfter).toBe(current.delta)
    }
  })
})

describe('labels', () => {
  it('names every kind', () => {
    for (const entry of STOCK_LOG_KINDS) {
      expect(logKindLabel(entry.value)).toBe(entry.label)
    }
  })
})
