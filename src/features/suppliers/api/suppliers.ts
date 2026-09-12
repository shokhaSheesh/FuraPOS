import { useMemo } from 'react'
import { useDataStore, type SupplierInput } from '@/data/store'
import { matches, paginate } from '@/data/query'
import { USD_RATE } from '@/data/seed'
import { landedTotal, landedUnitCost } from '@/features/receipts/model/receipt'
import type { ListQuery } from '@/shared/types'
import type { WalletTransaction } from '@/shared/types/wallet'
import {
  isDormant,
  type Supplier,
  type SupplierAccess,
  type SupplierStats,
} from '../model/supplier'

/**
 * A supplier's numbers are derived from receipts and live stock rather than
 * stored, because a stored total is a total that goes stale the next time
 * anything is received or sold.
 *
 * Sold-through carries the same caveat as a receipt's: without lot tracking,
 * whatever is still on the shelf is assumed to be theirs, which understates
 * when a later delivery has restocked in between.
 */
export function useSupplierStats() {
  const receipts = useDataStore((s) => s.receipts)
  const variations = useDataStore((s) => s.variations)

  return useMemo(() => {
    const byId = new Map<string, SupplierStats>()
    const stock = new Map(variations.map((v) => [v.id, v]))

    for (const receipt of receipts) {
      if (receipt.status !== 'received') continue
      // Receipts with no supplier still count somewhere: `null` is the bucket
      // OX shows as "Без поставщика", and it is worth surfacing rather than
      // dropping, because unattributed stock is a question in itself.
      const key = receipt.supplierId ?? '__none__'
      const current: SupplierStats = byId.get(key) ?? {
        purchased: 0,
        purchasedUnits: 0,
        onHandUnits: 0,
        onHandValue: 0,
        soldValue: 0,
        soldRatio: 0,
        receipts: 0,
        lastReceiptAt: null,
        products: 0,
      }

      current.receipts += 1
      current.purchased += landedTotal(receipt, USD_RATE)
      if (current.lastReceiptAt === null || (receipt.receivedAt ?? '') > current.lastReceiptAt) {
        current.lastReceiptAt = receipt.receivedAt
      }

      for (const line of receipt.lines) {
        const landed = line.receivedQuantity ?? 0
        current.purchasedUnits += landed
        const row = stock.get(line.variationId)
        const here =
          row?.stockByLocation.find((entry) => entry.locationId === receipt.locationId)?.quantity ??
          0
        const stillHere = Math.min(here, landed)
        const unitCost = landedUnitCost(line, receipt, USD_RATE)
        current.onHandUnits += stillHere
        current.onHandValue += stillHere * unitCost
        current.soldValue += (landed - stillHere) * unitCost
      }

      byId.set(key, current)
    }

    for (const [key, stats] of byId) {
      stats.soldRatio = stats.purchased === 0 ? 0 : stats.soldValue / stats.purchased
      stats.products = new Set(
        receipts
          .filter((r) => r.status === 'received' && (r.supplierId ?? '__none__') === key)
          .flatMap((r) => r.lines.map((line) => line.variationId)),
      ).size
    }

    const empty: SupplierStats = {
      purchased: 0,
      purchasedUnits: 0,
      onHandUnits: 0,
      onHandValue: 0,
      soldValue: 0,
      soldRatio: 0,
      receipts: 0,
      lastReceiptAt: null,
      products: 0,
    }

    return { get: (id: string) => byId.get(id) ?? empty, byId }
  }, [receipts, variations])
}

/** A supplier with its numbers attached, which is what the table lists. */
export interface SupplierRow {
  supplier: Supplier
  stats: SupplierStats
}

export function useSuppliers(query: ListQuery) {
  const suppliers = useDataStore((s) => s.suppliers)
  const stats = useSupplierStats()

  const data = useMemo(() => {
    const rows: SupplierRow[] = suppliers
      .map((supplier) => ({ supplier, stats: stats.get(supplier.id) }))
      .filter(({ supplier, stats: s }) => {
        if (query.status && supplier.status !== query.status) return false
        if (query.lens === 'owed' && supplier.debt <= 0) return false
        if (query.lens === 'dormant' && !isDormant(s)) return false
        if (query.zone && supplier.zone !== query.zone) return false
        return matches(
          [supplier.name, supplier.contactName, supplier.phone, supplier.email, supplier.zone],
          query.search,
        )
      })

    const ordered = query.sort ? rows : [...rows].sort((a, b) => b.supplier.debt - a.supplier.debt)
    return paginate(ordered, query)
  }, [suppliers, stats, query])

  return { data, isLoading: false }
}

export function useSupplier(id: string) {
  const supplier = useDataStore((s) => s.suppliers.find((entry) => entry.id === id))
  const stats = useSupplierStats()
  return {
    data: supplier ? { supplier, stats: stats.get(id) } : undefined,
    isLoading: false,
    isError: !supplier,
  }
}

export interface SuppliersSummary {
  debt: number
  owing: number
  onHandValue: number
  onHandUnits: number
  purchased: number
  soldRatio: number
  dormant: number
  unattributedValue: number
}

export function useSuppliersSummary(query: ListQuery) {
  const suppliers = useDataStore((s) => s.suppliers)
  const stats = useSupplierStats()

  return useMemo<SuppliersSummary>(() => {
    const scoped = suppliers.filter((supplier) => {
      if (query.zone && supplier.zone !== query.zone) return false
      return matches([supplier.name, supplier.contactName, supplier.zone], query.search)
    })

    const totals = scoped.reduce(
      (acc, supplier) => {
        const s = stats.get(supplier.id)
        return {
          onHandValue: acc.onHandValue + s.onHandValue,
          onHandUnits: acc.onHandUnits + s.onHandUnits,
          purchased: acc.purchased + s.purchased,
          soldValue: acc.soldValue + s.soldValue,
        }
      },
      { onHandValue: 0, onHandUnits: 0, purchased: 0, soldValue: 0 },
    )

    return {
      debt: scoped.reduce((sum, supplier) => sum + supplier.debt, 0),
      owing: scoped.filter((supplier) => supplier.debt > 0).length,
      onHandValue: totals.onHandValue,
      onHandUnits: totals.onHandUnits,
      purchased: totals.purchased,
      soldRatio: totals.purchased === 0 ? 0 : totals.soldValue / totals.purchased,
      dormant: scoped.filter((supplier) => isDormant(stats.get(supplier.id))).length,
      // What OX calls "Без поставщика": stock we cannot attribute to anyone.
      unattributedValue: stats.get('__none__').onHandValue,
    }
  }, [suppliers, stats, query])
}

export function useSupplierLensCounts(query: ListQuery) {
  const suppliers = useDataStore((s) => s.suppliers)
  const stats = useSupplierStats()
  const data = useMemo(() => {
    const scoped = suppliers.filter((supplier) =>
      matches([supplier.name, supplier.contactName, supplier.zone], query.search),
    )
    return {
      all: scoped.length,
      owed: scoped.filter((supplier) => supplier.debt > 0).length,
      dormant: scoped.filter((supplier) => isDormant(stats.get(supplier.id))).length,
    }
  }, [suppliers, stats, query])
  return { data, isLoading: false }
}

export function useSupplierWallet(id: string) {
  const supplier = useDataStore((s) => s.suppliers.find((entry) => entry.id === id))
  const all = useDataStore((s) => s.walletTransactions)
  return useMemo(() => {
    const transactions: WalletTransaction[] = all
      .filter((entry) => entry.ownerType === 'supplier' && entry.ownerId === id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return {
      wallet: {
        ownerId: id,
        ownerType: 'supplier' as const,
        balance: supplier?.debt ?? 0,
        cashback: 0,
        debt: supplier?.debt ?? 0,
        creditLimit: null,
        currency: 'UZS',
        updatedAt: supplier?.updatedAt ?? new Date().toISOString(),
      },
      transactions,
    }
  }, [supplier, all, id])
}

/* --- writes -------------------------------------------------------------- */

export function useCreateSupplier() {
  const create = useDataStore((s) => s.createSupplier)
  return {
    isPending: false,
    mutate: (input: SupplierInput, opts?: { onSuccess?: (s: Supplier) => void }) => {
      opts?.onSuccess?.(create(input))
    },
  }
}

export function useUpdateSupplier(id: string) {
  const update = useDataStore((s) => s.updateSupplier)
  return {
    isPending: false,
    mutate: (input: SupplierInput, opts?: { onSuccess?: () => void }) => {
      update(id, input)
      opts?.onSuccess?.()
    },
  }
}

/**
 * Turning portal access on or off. Separate from the form because it is a
 * single deliberate act, not one field among fifteen saved together.
 */
export function useSetSupplierAccess(id: string) {
  const set = useDataStore((s) => s.setSupplierAccess)
  return {
    isPending: false,
    mutate: (access: SupplierAccess, opts?: { onSuccess?: () => void }) => {
      set(id, access)
      opts?.onSuccess?.()
    },
  }
}

/**
 * Issuing a password. The password comes back through `onSuccess` rather than
 * being readable from the store afterwards, because that one hand-off is the
 * only place it exists.
 */
export function useIssueSupplierPassword() {
  const issue = useDataStore((s) => s.issueSupplierPassword)
  return {
    isPending: false,
    // The id is passed at call time rather than bound: the form issues the
    // first password for a supplier that did not exist when the hook ran.
    mutate: (
      id: string,
      opts?: { onSuccess?: (password: string) => void; onError?: (m: string) => void },
    ) => {
      const result = issue(id)
      if (result.ok) opts?.onSuccess?.(result.password)
      else opts?.onError?.(result.error)
    },
  }
}

export function usePaySupplier(id: string) {
  const pay = useDataStore((s) => s.paySupplier)
  return {
    isPending: false,
    mutate: (
      input: { amount: number; comment: string },
      opts?: { onSuccess?: () => void; onError?: (message: string) => void },
    ) => {
      const result = pay(id, input.amount, input.comment)
      if (result.ok) opts?.onSuccess?.()
      else opts?.onError?.(result.error)
    },
  }
}
