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

/**
 * A truck brand and the models it comes in — DAF → XF 105, CF 85.
 *
 * Not the same thing as a part brand. Bosch makes the filter; DAF makes the
 * lorry it fits. For a truck-parts business the second list is the one people
 * search by, and until now it was typed by hand on every product and every
 * truck, which is how one model ends up as "XF105", "XF 105" and "xf-105".
 *
 * Products and trucks keep the *names* rather than ids, so nothing downstream
 * had to change shape; this list is what those names are picked from, and a
 * rename here is written through to them so the two never drift.
 */
export interface VehicleModel {
  id: Id
  name: string
}

export interface VehicleMake {
  id: Id
  name: string
  models: VehicleModel[]
}

/** Case- and space-insensitive, so "XF105" is caught as a copy of "XF 105". */
export const sameName = (a: string, b: string) =>
  a.replace(/\s+/g, '').toLowerCase() === b.replace(/\s+/g, '').toLowerCase()

/** What leans on a make or one of its models, so neither is deleted out from under it. */
export interface VehicleUsage {
  products: number
  trucks: number
}

interface TruckLike {
  make: string | null
  model: string | null
}

export function vehicleUsage(
  make: string,
  model: string | null,
  products: { vehicleMakes: string[]; vehicleModels: string[] }[],
  trucks: TruckLike[],
): VehicleUsage {
  const productCount = products.filter(
    (product) =>
      product.vehicleMakes.some((productMake) => sameName(productMake, make)) &&
      (model === null || product.vehicleModels.some((m) => sameName(m, model))),
  ).length
  const truckCount = trucks.filter(
    (truck) =>
      truck.make !== null &&
      sameName(truck.make, make) &&
      (model === null || (truck.model !== null && sameName(truck.model, model))),
  ).length
  return { products: productCount, trucks: truckCount }
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
  /** A data URL, or null for no picture — see ImageField. */
  imageUrl: string | null
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
  imageUrl: z.string().nullable(),
})
