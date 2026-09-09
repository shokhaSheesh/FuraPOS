import { z } from 'zod'
import type { Id, IsoDate } from '@/shared/types'

/**
 * Company-wide settings.
 *
 * Small on purpose. OX's Настройки is nine tabs, several of which are
 * builders — custom client fields, product properties, cash terminals — that
 * this product deliberately does not have. What is left is the handful of
 * facts every other screen reads: who the company is, what money and dates
 * look like, and which sales count as revenue.
 */
export interface CompanySettings {
  name: string
  /** Shown on the sidebar and on printed documents. */
  logoUrl: string | null
  industry: string
  address: string | null
  phone: string | null
  email: string | null

  /**
   * What one USD costs. Supplier invoices are in USD and customers pay in
   * UZS, so this rate sits behind every landed cost in the product.
   */
  usdRate: number

  /** Which payment methods a sale may use. */
  paymentMethods: string[]
  /**
   * Whether a sale can be put on a client's account past their credit limit.
   * Off means the limit is a rule; on means it is a warning.
   */
  allowOverCreditLimit: boolean
  /**
   * Which sale statuses count towards revenue.
   *
   * OX calls this «Настройки расчёта выручки» and it is the one setting on
   * that screen with teeth: change it and every figure in Analytics moves.
   */
  revenueStatuses: string[]

  updatedAt: IsoDate
}

export const INDUSTRIES = [
  'Auto parts',
  'General retail',
  'Wholesale',
  'Grocery',
  'Pharmacy',
  'Other',
]

export const companySchema = z.object({
  name: z.string().min(2, 'The company needs a name'),
  industry: z.string(),
  address: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().email('That is not an email address').or(z.literal('')).nullable(),
  usdRate: z.number().positive('A rate of zero would make every cost zero'),
  paymentMethods: z.array(z.string()).min(1, 'A sale has to be payable somehow'),
  allowOverCreditLimit: z.boolean(),
  revenueStatuses: z.array(z.string()).min(1, 'Something has to count as revenue'),
})

export type CompanyDraft = z.infer<typeof companySchema>

/* --- brands, locations, categories --------------------------------------- */

export interface Brand {
  id: Id
  name: string
  /** Where they are from — OX's «Зона». */
  zone: string | null
  active: boolean
}

export type LocationKind = 'warehouse' | 'shop'

export const LOCATION_KINDS: { value: LocationKind; label: string }[] = [
  { value: 'warehouse', label: 'Warehouse' },
  { value: 'shop', label: 'Shop' },
]

export interface LocationSettings {
  id: Id
  name: string
  kind: LocationKind
  address: string | null
  /** Floor area in m², as OX records it. */
  areaSqm: number | null
  active: boolean
}

export interface CategorySettings {
  id: Id
  name: string
  /** Parent category, so the tree has more than one level. */
  parentId: Id | null
}

export const brandSchema = z.object({
  name: z.string().min(1, 'Give the brand a name'),
  zone: z.string().nullable(),
  active: z.boolean(),
})

export const locationSchema = z.object({
  name: z.string().min(2, 'Give the location a name'),
  kind: z.enum(['warehouse', 'shop']),
  address: z.string().nullable(),
  areaSqm: z.number().positive().nullable(),
  active: z.boolean(),
})

export const categorySchema = z.object({
  name: z.string().min(1, 'Give the category a name'),
  parentId: z.string().nullable(),
})

/* --- notifications ------------------------------------------------------- */

/**
 * Notification preferences are **(event) × (channel)**, never (page) × (channel)
 * — CLAUDE.md is explicit, and it is the right shape: somebody wants low stock
 * by Telegram and price changes by email, not "the products module" by both.
 */
export type NotificationChannel = 'inApp' | 'email' | 'telegram' | 'sms'

export const NOTIFICATION_CHANNELS: { value: NotificationChannel; label: string }[] = [
  { value: 'inApp', label: 'In app' },
  { value: 'email', label: 'Email' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'sms', label: 'SMS' },
]

export interface NotificationEvent {
  key: string
  label: string
  /** Which module it belongs to, for grouping and counting. */
  group: string
  hint: string
}

export const NOTIFICATION_EVENTS: NotificationEvent[] = [
  {
    key: 'stock.low',
    label: 'Stock runs low',
    group: 'Products',
    hint: 'A part drops below its reorder point',
  },
  {
    key: 'stock.out',
    label: 'Stock runs out',
    group: 'Products',
    hint: 'A part reaches zero at a location',
  },
  {
    key: 'price.changed',
    label: 'A price changes',
    group: 'Products',
    hint: 'A repricing is applied',
  },
  {
    key: 'order.late',
    label: 'An order is late',
    group: 'Procurement',
    hint: 'A supplier misses the date they promised',
  },
  {
    key: 'order.delivered',
    label: 'An order is delivered',
    group: 'Procurement',
    hint: 'Everything on an order has arrived',
  },
  {
    key: 'schedule.drafted',
    label: 'A reorder draft is ready',
    group: 'Procurement',
    hint: 'A schedule has run and left an order to check',
  },
  {
    key: 'sale.overdue',
    label: 'A client payment is overdue',
    group: 'Sales',
    hint: 'A sale on account passes its terms',
  },
  {
    key: 'sale.large',
    label: 'A large sale is made',
    group: 'Sales',
    hint: 'A sale exceeds the threshold worth knowing about',
  },
  {
    key: 'client.overLimit',
    label: 'A client goes over their limit',
    group: 'Marketing',
    hint: 'Somebody owes more than they were allowed',
  },
  {
    key: 'stocktake.variance',
    label: 'A stocktake finds a variance',
    group: 'Products',
    hint: 'A count disagrees with the system',
  },
]

/** `{ 'stock.low': ['inApp', 'telegram'], … }` */
export type NotificationPreferences = Record<string, NotificationChannel[]>

export const isSubscribed = (
  preferences: NotificationPreferences,
  event: string,
  channel: NotificationChannel,
) => preferences[event]?.includes(channel) ?? false

/** How many events in a group are on at all — the badge beside a heading. */
export function countInGroup(preferences: NotificationPreferences, group: string): number {
  return NOTIFICATION_EVENTS.filter(
    (event) => event.group === group && (preferences[event.key]?.length ?? 0) > 0,
  ).length
}

export const NOTIFICATION_GROUPS = [...new Set(NOTIFICATION_EVENTS.map((event) => event.group))]
