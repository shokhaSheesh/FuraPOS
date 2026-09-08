import { z } from 'zod'
import type { Id, IsoDate } from '@/shared/types'

/**
 * Who buys from us.
 *
 * For a parts business the customer list is not a mailing list — it is a
 * **credit ledger with names on it**. Half the trade is repeat garages buying
 * on account, and the questions that matter are: what do they owe, are they
 * good for it, and have they stopped coming. A CRM that answers "what is their
 * email address" answers nothing anybody asked.
 *
 * So the record carries a type (a garage is not a walk-in), a credit limit,
 * and a debt — and everything else about them is derived from their sales.
 */
export type ClientType = 'person' | 'business'

export const CLIENT_TYPES: { value: ClientType; label: string; hint: string }[] = [
  { value: 'person', label: 'Person', hint: 'Walk-in or individual buyer' },
  { value: 'business', label: 'Business', hint: 'Garage, fleet or reseller, usually on account' },
]

export type ClientStatus = 'active' | 'blocked' | 'archived'

export const CLIENT_STATUSES: {
  value: ClientStatus
  label: string
  tone: 'success' | 'danger' | 'neutral'
}[] = [
  { value: 'active', label: 'Active', tone: 'success' },
  // Not deletion: someone who stopped paying should still be findable, and
  // their history is the reason they were blocked.
  { value: 'blocked', label: 'Blocked', tone: 'danger' },
  { value: 'archived', label: 'Archived', tone: 'neutral' },
]

export const clientStatusLabel = (status: ClientStatus) =>
  CLIENT_STATUSES.find((entry) => entry.value === status)?.label ?? status

export const clientStatusTone = (status: ClientStatus) =>
  CLIENT_STATUSES.find((entry) => entry.value === status)?.tone ?? 'neutral'

export interface Client {
  id: Id
  name: string
  type: ClientType
  phone: string | null
  email: string | null
  address: string | null
  /**
   * What they owe us, positive. Kept on the client rather than derived from
   * sales, because a sale can be paid before or after it is fulfilled and the
   * two are not the same ledger — the same reason supplier debt is stored.
   */
  debt: number
  /**
   * How much they may owe at once. Null means no account: they pay up front.
   * This is the field the New sale screen has to respect.
   */
  creditLimit: number | null
  /** Loyalty balance they can spend. */
  cashback: number
  status: ClientStatus
  comment: string | null
  createdAt: IsoDate
  updatedAt: IsoDate
}

/** What the sales ledger says about a client. Derived, never stored. */
export interface ClientStats {
  revenue: number
  sales: number
  units: number
  averageCheck: number
  lastSaleAt: IsoDate | null
  /** Distinct products they have ever bought — how broad the relationship is. */
  products: number
}

export const EMPTY_CLIENT_STATS: ClientStats = {
  revenue: 0,
  sales: 0,
  units: 0,
  averageCheck: 0,
  lastSaleAt: null,
  products: 0,
}

/* --- the questions the screen exists to answer --------------------------- */

/**
 * How much more they are allowed to take on account.
 *
 * Null when they have no account at all, which is different from zero: "pays
 * up front" and "has used their whole limit" both stop a credit sale, but only
 * one of them is a problem.
 */
export function headroom(client: Pick<Client, 'debt' | 'creditLimit'>): number | null {
  if (client.creditLimit === null) return null
  return Math.max(0, client.creditLimit - client.debt)
}

/** Owing more than they were ever allowed to. */
export const isOverLimit = (client: Pick<Client, 'debt' | 'creditLimit'>) =>
  client.creditLimit !== null && client.debt > client.creditLimit

/** Days since they last bought anything. Null when they never have. */
export function daysSinceLastSale(stats: Pick<ClientStats, 'lastSaleAt'>): number | null {
  if (!stats.lastSaleAt) return null
  return Math.floor((Date.now() - new Date(stats.lastSaleAt).getTime()) / 86_400_000)
}

/** A client who used to buy regularly and has stopped. */
export const DORMANT_DAYS = 60

export function isDormant(client: Client, stats: ClientStats): boolean {
  if (client.status !== 'active') return false
  // Somebody who never bought is a lead, not a lapsed customer.
  if (stats.sales === 0) return false
  const days = daysSinceLastSale(stats)
  return days !== null && days >= DORMANT_DAYS
}

/* --- validation ---------------------------------------------------------- */

export const clientDraftSchema = z.object({
  name: z.string().min(2, 'Give them a name'),
  type: z.enum(['person', 'business']),
  phone: z.string().nullable(),
  email: z.string().email('That is not an email address').or(z.literal('')).nullable(),
  address: z.string().nullable(),
  creditLimit: z.number().nonnegative('A credit limit cannot be negative').nullable(),
  status: z.enum(['active', 'blocked', 'archived']),
  comment: z.string().nullable(),
})

export type ClientDraft = z.infer<typeof clientDraftSchema>
