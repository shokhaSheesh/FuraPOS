import { useMemo } from 'react'
import { useDataStore, type EmployeeInput } from '@/data/store'
import { matches } from '@/data/query'
import { USD_RATE } from '@/data/seed'
import type { Sale } from '@/features/sales/model/sale'
import type { VariationRow } from '@/features/products/model/product'
import {
  EMPTY_STATS,
  isDormant,
  type Employee,
  type EmployeeStats,
  type EmployeeStatus,
} from '../model/employee'

const startOfMonth = () => {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1).getTime()
}

const costOf = (variation: VariationRow | undefined) =>
  variation
    ? variation.costCurrency === 'USD'
      ? variation.costPrice * USD_RATE
      : variation.costPrice
    : 0

/**
 * What the sales ledger says about each person.
 *
 * Deleted sales are excluded, for the same reason they are excluded from
 * revenue everywhere else: a cancelled sale is not a sale, and letting one
 * count would let anyone inflate their own numbers by typing and voiding.
 *
 * **Margin is an estimate.** A sale line records what it sold for but not what
 * it cost, so cost comes from the product's cost *today* rather than on the day
 * it went out of the door. It is right enough to compare two sellers over the
 * same period, and wrong for anything an accountant would sign.
 */
export function buildEmployeeStats(
  sales: Sale[],
  variations: VariationRow[],
): Map<string, EmployeeStats> {
  const byId = new Map<string, VariationRow>(variations.map((v) => [v.id, v]))
  const monthStart = startOfMonth()
  const stats = new Map<string, EmployeeStats>()

  for (const sale of sales) {
    if (sale.status === 'deleted' || !sale.sellerId) continue

    const current = stats.get(sale.sellerId) ?? { ...EMPTY_STATS }
    const at = new Date(sale.createdAt).getTime()

    let cost = 0
    let units = 0
    for (const line of sale.lines) {
      cost += costOf(byId.get(line.variationId)) * line.quantity
      units += line.quantity
    }

    current.revenue += sale.total
    current.sales += 1
    current.units += units
    current.margin += sale.total - cost
    if (at >= monthStart) {
      current.revenueThisMonth += sale.total
      current.salesThisMonth += 1
    }
    if (!current.lastSaleAt || sale.createdAt > current.lastSaleAt) {
      current.lastSaleAt = sale.createdAt
    }
    stats.set(sale.sellerId, current)
  }

  for (const entry of stats.values()) {
    entry.averageCheck = entry.sales === 0 ? 0 : entry.revenue / entry.sales
    entry.marginRatio = entry.revenue === 0 ? 0 : entry.margin / entry.revenue
  }

  return stats
}

export interface EmployeeFilters {
  search?: unknown
  role?: unknown
  location?: unknown
  status?: unknown
}

export interface EmployeeRow extends Employee {
  stats: EmployeeStats
  dormant: boolean
}

export function useEmployees(filters: EmployeeFilters = {}) {
  const employees = useDataStore((s) => s.employees)
  const sales = useDataStore((s) => s.sales)
  const variations = useDataStore((s) => s.variations)

  return useMemo(() => {
    const stats = buildEmployeeStats(sales, variations)

    const items: EmployeeRow[] = employees
      .map((employee) => ({
        ...employee,
        stats: stats.get(employee.id) ?? EMPTY_STATS,
        dormant: isDormant(employee),
      }))
      .filter((employee) => {
        if (filters.role && employee.roleId !== filters.role) return false
        if (filters.location && employee.locationId !== filters.location) return false
        if (filters.status && employee.status !== filters.status) return false
        return matches(
          [employee.fullName, employee.phone, employee.email, employee.roleName],
          filters.search as string | undefined,
        )
      })
      /*
        Archived people sink; among the rest, whoever has sold most this month
        leads. Ranked on the same figure the table shows, deliberately — a list
        sorted on a number that is not on screen reads as broken.
      */
      .sort((a, b) => {
        const byStatus = Number(a.status === 'archived') - Number(b.status === 'archived')
        if (byStatus !== 0) return byStatus
        const byMonth = b.stats.revenueThisMonth - a.stats.revenueThisMonth
        return byMonth !== 0 ? byMonth : b.stats.revenue - a.stats.revenue
      })

    return { data: { items, total: items.length }, isLoading: false }
  }, [employees, sales, variations, filters.role, filters.location, filters.status, filters.search])
}

export function useEmployee(id: string | undefined) {
  const employees = useDataStore((s) => s.employees)
  const sales = useDataStore((s) => s.sales)
  const variations = useDataStore((s) => s.variations)

  return useMemo(() => {
    const employee = employees.find((e) => e.id === id)
    if (!employee) return { data: undefined, isLoading: false }
    const stats = buildEmployeeStats(sales, variations).get(employee.id) ?? EMPTY_STATS
    return {
      data: { ...employee, stats, dormant: isDormant(employee) } as EmployeeRow,
      isLoading: false,
    }
  }, [employees, sales, variations, id])
}

/** The sales one person made, newest first. */
export function useEmployeeSales(id: string | undefined, limit = 10) {
  const sales = useDataStore((s) => s.sales)

  return useMemo(
    () =>
      sales
        .filter((sale) => sale.sellerId === id && sale.status !== 'deleted')
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit),
    [sales, id, limit],
  )
}

export function useEmployeeStatusCounts(filters: EmployeeFilters = {}) {
  const { data } = useEmployees({ ...filters, status: null })

  return useMemo(() => {
    const counts: Record<string, number> = { all: data.items.length }
    for (const employee of data.items) {
      counts[employee.status] = (counts[employee.status] ?? 0) + 1
    }
    return { data: counts }
  }, [data.items])
}

export interface EmployeesSummary {
  active: number
  dormant: number
  revenueThisMonth: number
  topSeller: EmployeeRow | null
}

export function useEmployeesSummary(): EmployeesSummary {
  const { data } = useEmployees()

  return useMemo(() => {
    const live = data.items.filter((e) => e.status !== 'archived')
    const ranked = [...live].sort((a, b) => b.stats.revenueThisMonth - a.stats.revenueThisMonth)
    return {
      active: data.items.filter((e) => e.status === 'active').length,
      dormant: data.items.filter((e) => e.dormant).length,
      revenueThisMonth: live.reduce((sum, e) => sum + e.stats.revenueThisMonth, 0),
      topSeller: ranked[0]?.stats.revenueThisMonth ? ranked[0] : null,
    }
  }, [data.items])
}

export function useEmployeeActions() {
  const create = useDataStore((s) => s.createEmployee)
  const update = useDataStore((s) => s.updateEmployee)
  const setStatus = useDataStore((s) => s.setEmployeeStatus)

  return {
    create: (input: EmployeeInput) => create(input),
    update: (id: string, input: EmployeeInput) => update(id, input),
    setStatus: (id: string, status: EmployeeStatus) => setStatus(id, status),
    isPending: false,
  }
}
