import { parseNumber } from '@/shared/lib/importFields'
import type { Id } from '@/shared/types'
import type { Product, ProductVariation, VariationRow } from '@/features/products/model/product'
import { t } from '@/shared/i18n'

/**
 * Mass update — OX's «Массовое обновление инф. товаров».
 *
 * A spreadsheet in, many products changed at once. One column of the file is
 * the **key** that finds the product (barcode, SKU, or an id), and the other
 * columns each say which **field** they overwrite. Rows the key cannot find are
 * skipped rather than stopping the run, and an empty cell leaves its field
 * alone — a file only has to carry what is changing.
 *
 * Everything here is pure: the screen shows the plan before anything is
 * written, and the store applies exactly what was shown.
 */

/* --- keys ----------------------------------------------------------------- */

export type KeyType = 'barcode' | 'sku' | 'variationId' | 'productId'

export const KEY_TYPES: { value: KeyType; label: string }[] = [
  { value: 'barcode', label: 'Barcode' },
  { value: 'sku', label: 'SKU' },
  { value: 'variationId', label: 'Variation ID' },
  { value: 'productId', label: 'Product ID' },
]

export const keyLabel = (key: KeyType) => t(KEY_TYPES.find((k) => k.value === key)?.label ?? key)

/* --- fields --------------------------------------------------------------- */

export type ActionType =
  | 'productName'
  | 'variationName'
  | 'sku'
  | 'barcode'
  | 'salePrice'
  | 'costPrice'
  | 'wholesalePrice'
  | 'quantity'
  | 'shelfAddress'
  | 'brand'
  | 'category'
  | 'partSide'
  | 'oem'
  | 'vehicleMakes'
  | 'vehicleModels'
  | 'manufacturer'
  | 'cargoWeightKg'
  | 'cargoSize'
  | 'description'

const VARIATION_KEYS: KeyType[] = ['barcode', 'sku', 'variationId']
const ANY_KEY: KeyType[] = ['barcode', 'sku', 'variationId', 'productId']

export interface ActionSpec {
  value: ActionType
  label: string
  /**
   * Which keys can drive it. A product ID finds every variation of a product,
   * so it can set what the product shares — its name, category — but not
   * what each variation has on its own, like a barcode.
   */
  allow: KeyType[]
  needsCurrency?: boolean
  needsLocation?: boolean
  /** Hidden from roles that may not see what we pay. */
  costOnly?: boolean
}

/** In the product list's own order and wording. */
export const ACTIONS: ActionSpec[] = [
  { value: 'productName', label: 'Product name', allow: ANY_KEY },
  { value: 'variationName', label: 'Variation name', allow: VARIATION_KEYS },
  { value: 'sku', label: 'SKU', allow: ['barcode', 'variationId'] },
  { value: 'barcode', label: 'Barcode', allow: ['sku', 'variationId'] },
  { value: 'quantity', label: 'Quantity', allow: VARIATION_KEYS, needsLocation: true },
  { value: 'shelfAddress', label: 'Storage address', allow: VARIATION_KEYS },
  { value: 'salePrice', label: 'Sale price', allow: ANY_KEY, needsCurrency: true },
  { value: 'wholesalePrice', label: 'Wholesale price', allow: ANY_KEY, needsCurrency: true },
  {
    value: 'costPrice',
    label: 'Supplier price',
    allow: ANY_KEY,
    needsCurrency: true,
    costOnly: true,
  },
  { value: 'brand', label: 'Manufacturer brand', allow: ANY_KEY },
  { value: 'category', label: 'Category', allow: ANY_KEY },
  { value: 'partSide', label: 'Part', allow: VARIATION_KEYS },
  { value: 'oem', label: 'OEM', allow: VARIATION_KEYS },
  { value: 'vehicleMakes', label: 'Make', allow: ANY_KEY },
  { value: 'vehicleModels', label: 'Model', allow: ANY_KEY },
  { value: 'manufacturer', label: 'Product brand', allow: ANY_KEY },
  { value: 'cargoWeightKg', label: 'Cargo weight', allow: VARIATION_KEYS },
  { value: 'cargoSize', label: 'Cargo size', allow: VARIATION_KEYS },
  { value: 'description', label: 'Description', allow: ANY_KEY },
]

export const actionSpec = (action: ActionType) => ACTIONS.find((a) => a.value === action)!

/* --- what each column is -------------------------------------------------- */

export type Currency = 'UZS' | 'USD'

export type ColumnRole =
  | { kind: 'skip' }
  | { kind: 'key'; keyType: KeyType }
  | { kind: 'action'; action: ActionType; currency?: Currency; locationId?: string }

export const SKIP: ColumnRole = { kind: 'skip' }

/** A field can be chosen when every key column already chosen can drive it. */
export function actionAllowed(action: ActionType, roles: ColumnRole[]) {
  const keys = roles.flatMap((role) => (role.kind === 'key' ? [role.keyType] : []))
  return keys.every((key) => actionSpec(action).allow.includes(key))
}

/** What has to be fixed before the run can go ahead. Empty means ready. */
export function problems(roles: ColumnRole[]): string[] {
  const found: string[] = []
  if (!roles.some((role) => role.kind === 'key')) found.push('No key column chosen')
  const actions = roles.flatMap((role) => (role.kind === 'action' ? [role] : []))
  if (actions.length === 0) found.push('No field to update chosen')
  for (const role of actions) {
    const spec = actionSpec(role.action)
    if (!actionAllowed(role.action, roles)) {
      found.push(`${spec.label} cannot be found by the chosen key`)
    }
    if (spec.needsCurrency && !role.currency) found.push(`${spec.label}: no currency chosen`)
    if (spec.needsLocation && !role.locationId) found.push(`${spec.label}: no location chosen`)
  }
  const duplicates = actions
    .map((role) => role.action)
    .filter((action, index, all) => all.indexOf(action) !== index)
  for (const action of new Set(duplicates)) {
    found.push(`${actionSpec(action).label} is chosen for more than one column`)
  }
  return found
}

/**
 * A heading read as a role, so a file made from the template maps itself.
 * Only the obvious ones: anything unclear is left for the person to choose.
 */
export function guessRole(heading: string): ColumnRole {
  const text = heading.trim().toLowerCase()
  if (!text) return SKIP
  if (/штрих|barcode|ean/.test(text)) return { kind: 'key', keyType: 'barcode' }
  if (/^(sku|артикул)$/.test(text)) return { kind: 'key', keyType: 'sku' }
  const byLabel = ACTIONS.find((action) => action.label.toLowerCase() === text)
  if (byLabel) return { kind: 'action', action: byLabel.value }
  if (/цена продажи|sale price|price/.test(text)) return { kind: 'action', action: 'salePrice' }
  if (/название|product name|name/.test(text)) return { kind: 'action', action: 'productName' }
  return SKIP
}

/* --- finding products ----------------------------------------------------- */

const same = (a: string | null | undefined, b: string) =>
  (a ?? '').trim().toLowerCase() === b.trim().toLowerCase()

/** The variations a key value points at. A product ID finds all of them. */
export function findVariations(value: string, key: KeyType, variations: VariationRow[]) {
  const wanted = value.trim()
  if (!wanted) return []
  switch (key) {
    case 'barcode':
      return variations.filter((v) => same(v.barcode, wanted))
    case 'sku':
      return variations.filter((v) => same(v.sku, wanted))
    case 'variationId':
      return variations.filter((v) => v.id === wanted)
    case 'productId':
      return variations.filter((v) => v.productId === wanted)
  }
}

export interface KeyCheck {
  total: number
  found: number
  notFound: string[]
}

/** How many rows the key will find — shown before anything runs. */
export function checkKeys(
  rows: string[][],
  roles: ColumnRole[],
  variations: VariationRow[],
): KeyCheck {
  const keyIndexes = roles.flatMap((role, index) => (role.kind === 'key' ? [index] : []))
  let found = 0
  const notFound: string[] = []
  for (const row of rows) {
    const hit = keyIndexes.some((index) => {
      const role = roles[index] as { kind: 'key'; keyType: KeyType }
      return findVariations(row[index] ?? '', role.keyType, variations).length > 0
    })
    if (hit) found++
    else notFound.push(keyIndexes.map((index) => row[index] ?? '').find(Boolean) ?? '(empty)')
  }
  return { total: rows.length, found, notFound }
}

/* --- the plan ------------------------------------------------------------- */

type VariationPatch = Partial<
  Pick<
    ProductVariation,
    | 'name'
    | 'sku'
    | 'barcode'
    | 'salePrice'
    | 'saleCurrency'
    | 'costPrice'
    | 'costCurrency'
    | 'wholesalePrice'
    | 'wholesaleCurrency'
    | 'shelfAddress'
    | 'partSide'
    | 'oem'
    | 'cargoWeightKg'
    | 'cargoSize'
  >
>

type ProductPatch = Partial<
  Pick<
    Product,
    | 'name'
    | 'description'
    | 'categoryId'
    | 'categoryName'
    | 'categoryPath'
    | 'brandId'
    | 'brandName'
    | 'manufacturer'
    | 'vehicleMakes'
    | 'vehicleModels'
  >
>

export interface MassUpdatePlan {
  productPatches: Map<Id, ProductPatch>
  variationPatches: Map<Id, VariationPatch>
  /** locationId → variationId → the quantity the shelf should now hold. */
  stock: Map<Id, Map<Id, number>>
  errors: string[]
  skipped: number
}

const list = (text: string) =>
  text
    .split(/[,;]/)
    .map((part) => part.trim())
    .filter(Boolean)

/**
 * Works out every change a file makes, without making any.
 *
 * `rows` are the data rows only — the heading, if any, already taken off.
 */
export function planMassUpdate({
  rows,
  roles,
  variations,
  categories,
  brands,
}: {
  rows: string[][]
  roles: ColumnRole[]
  variations: VariationRow[]
  categories: readonly { id: string; name: string; path: string }[]
  brands: readonly { id: string; name: string }[]
}): MassUpdatePlan {
  const productPatches = new Map<Id, ProductPatch>()
  const variationPatches = new Map<Id, VariationPatch>()
  const stock = new Map<Id, Map<Id, number>>()
  const errors: string[] = []
  let skipped = 0

  const patchProduct = (id: Id, patch: ProductPatch) =>
    productPatches.set(id, { ...productPatches.get(id), ...patch })
  const patchVariation = (id: Id, patch: VariationPatch) =>
    variationPatches.set(id, { ...variationPatches.get(id), ...patch })

  rows.forEach((row, rowIndex) => {
    const line = rowIndex + 1
    let targets: VariationRow[] = []
    roles.forEach((role, index) => {
      if (role.kind !== 'key' || targets.length) return
      targets = findVariations(row[index] ?? '', role.keyType, variations)
    })
    if (targets.length === 0) {
      skipped++
      return
    }

    roles.forEach((role, index) => {
      if (role.kind !== 'action') return
      const cell = (row[index] ?? '').trim()
      // An empty cell changes nothing: a file only carries what is changing.
      if (!cell) return
      const spec = actionSpec(role.action)
      const number = () => {
        const parsed = parseNumber(cell)
        if (parsed === null || parsed < 0) {
          errors.push(`Row ${line}: ${spec.label} "${cell}" is not a number`)
          return null
        }
        return parsed
      }

      for (const target of targets) {
        switch (role.action) {
          case 'productName':
            patchProduct(target.productId, { name: cell })
            break
          case 'description':
            patchProduct(target.productId, { description: cell })
            break
          case 'manufacturer':
            patchProduct(target.productId, { manufacturer: cell })
            break
          case 'vehicleMakes':
            patchProduct(target.productId, { vehicleMakes: list(cell) })
            break
          case 'vehicleModels':
            patchProduct(target.productId, { vehicleModels: list(cell) })
            break
          case 'category': {
            const category = categories.find((c) => same(c.name, cell) || same(c.path, cell))
            if (!category) {
              errors.push(`Row ${line}: no category called "${cell}"`)
              return
            }
            patchProduct(target.productId, {
              categoryId: category.id,
              categoryName: category.name,
              categoryPath: category.path,
            })
            break
          }
          case 'brand': {
            const brand = brands.find((entry) => same(entry.name, cell))
            if (!brand) {
              errors.push(`Row ${line}: no brand called "${cell}"`)
              return
            }
            patchProduct(target.productId, { brandId: brand.id, brandName: brand.name })
            break
          }
          case 'variationName':
            patchVariation(target.id, { name: cell })
            break
          case 'sku':
            patchVariation(target.id, { sku: cell })
            break
          case 'barcode':
            patchVariation(target.id, { barcode: cell })
            break
          case 'shelfAddress':
            patchVariation(target.id, { shelfAddress: cell })
            break
          case 'partSide':
            patchVariation(target.id, { partSide: cell })
            break
          case 'oem':
            patchVariation(target.id, { oem: cell })
            break
          case 'cargoSize':
            patchVariation(target.id, { cargoSize: cell })
            break
          case 'cargoWeightKg': {
            const value = number()
            if (value === null) return
            patchVariation(target.id, { cargoWeightKg: value })
            break
          }
          case 'salePrice': {
            const value = number()
            if (value === null) return
            patchVariation(target.id, { salePrice: value, saleCurrency: role.currency ?? 'UZS' })
            break
          }
          case 'costPrice': {
            const value = number()
            if (value === null) return
            patchVariation(target.id, { costPrice: value, costCurrency: role.currency ?? 'UZS' })
            break
          }
          case 'wholesalePrice': {
            const value = number()
            if (value === null) return
            patchVariation(target.id, {
              wholesalePrice: value,
              wholesaleCurrency: role.currency ?? 'UZS',
            })
            break
          }
          case 'quantity': {
            const value = number()
            if (value === null || !role.locationId) return
            if (!Number.isInteger(value)) {
              errors.push(`Row ${line}: quantity "${cell}" is not a whole number`)
              return
            }
            const at = stock.get(role.locationId) ?? new Map<Id, number>()
            at.set(target.id, value)
            stock.set(role.locationId, at)
            break
          }
        }
      }
    })
  })

  // An error is reported once per row, however many variations it reached.
  return { productPatches, variationPatches, stock, errors: [...new Set(errors)], skipped }
}

/** The counts shown when a run finishes, and kept in the history. */
export const planCounts = (plan: MassUpdatePlan) => ({
  products: plan.productPatches.size,
  variations: plan.variationPatches.size,
  stock: [...plan.stock.values()].reduce((sum, at) => sum + at.size, 0),
})

/* --- history -------------------------------------------------------------- */

/** One run, as the history lists it. */
export interface MassUpdateRecord {
  id: Id
  createdAt: string
  userName: string
  fileName: string
  totalRows: number
  status: 'done' | 'failed'
  result: { products: number; variations: number; stock: number }
  errors: string[]
  /** The corrections a quantity column wrote, so a stock change can be traced. */
  correctionNumbers: string[]
}

/** A saved column mapping, for a file that arrives in the same shape every week. */
export interface MassUpdatePreset {
  id: Id
  name: string
  roles: ColumnRole[]
  hasHeader: boolean
}
