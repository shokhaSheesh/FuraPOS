import { z } from 'zod'
import type { Id, IsoDate } from '@/shared/types'

export type ProductStatus = 'active' | 'archived' | 'draft'
export type UnitOfMeasure = 'pcs' | 'kg' | 'l' | 'm' | 'pack'

/**
 * Suppliers are paid in USD while customers pay in UZS — that is how an
 * importer of truck parts operates, and it is visible in the reference data
 * (supplier price 85 USD against a sale price of 1 476 000 UZS). Cost
 * therefore carries its own currency and is never assumed to be UZS.
 */
export type CostCurrency = 'USD' | 'UZS'

/** Which side of the vehicle a part fits. The main variation axis here. */
export type PartSide = 'left' | 'right' | 'both'

export const PART_SIDES: { value: PartSide; label: string }[] = [
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
  { value: 'both', label: 'Universal' },
]

/**
 * An axis a product varies along — "Side" with values Left / Right, "Colour"
 * with Black / Silver. A variation is one combination of one value per option,
 * which is what makes its name: "Left / Black".
 *
 * Capped at three, as Shopify caps it: a fourth axis multiplies the grid past
 * what anyone edits by hand, and in this catalogue two is already unusual.
 */
export interface ProductOption {
  id: Id
  /** Shown as the column heading and in the variation's name. */
  name: string
  values: string[]
}

export const MAX_OPTIONS = 3

/**
 * The option named "Side" is special: the catalogue already has a real, typed
 * `partSide` used for filtering, so when a product varies by side we drive that
 * field from the option rather than asking for the same answer twice.
 */
export const SIDE_OPTION_NAME = 'Side'
export const isSideOption = (option: { name: string }) =>
  option.name.trim().toLowerCase() === SIDE_OPTION_NAME.toLowerCase()

/** One variation's answer to each option, in the product's option order. */
export interface OptionValue {
  optionId: Id
  value: string
}

export interface StockAtLocation {
  locationId: Id
  locationName: string
  quantity: number
}

/**
 * The sellable unit. A product is the thing in the catalogue; a variation is
 * what actually has a barcode, a price and stock on a shelf — "DAF XF 105 step
 * — left" rather than "DAF XF 105 step".
 *
 * Everything that can differ between two variants of the same part lives here:
 * its own SKU, its own cost, its own stock. Everything shared — what the part
 * is, which vehicle it fits — lives on the product.
 */
export interface ProductVariation {
  id: Id
  productId: Id
  /** What distinguishes it, e.g. "Left" or "1.5 m". */
  name: string
  /** Which value of each option this variation is. Empty for a lone variation. */
  optionValues: OptionValue[]
  sku: string
  barcode: string | null
  partSide: PartSide | null

  costPrice: number
  costCurrency: CostCurrency
  salePrice: number
  /** Promotional price when set; null means it sells at salePrice. */
  discountPrice: number | null

  stock: number
  stockByLocation: StockAtLocation[]
  lowStockThreshold: number | null
  /** Shelf or bin reference, for picking. */
  shelfAddress: string | null
  /** Minimum quantity a supplier will accept. */
  moq: number | null

  imageUrl: string | null
  status: ProductStatus
}

export interface Product {
  id: Id
  name: string
  /** Free text; the reference tenant keeps the OEM number here. */
  description: string | null
  categoryId: Id
  categoryName: string
  /** Full hierarchy, e.g. "Chassis > Brakes". */
  categoryPath: string
  brandId: Id | null
  /** Who we buy from — "AKCHAEV INC" in the reference data. */
  brandName: string | null
  /**
   * Who made the part — "Space" in the reference data. OX keeps these as two
   * separate columns (Бренд and Бренд товара) because for an importer they are
   * genuinely different companies.
   */
  manufacturer: string | null
  tags: string[]
  unit: UnitOfMeasure

  /** Which vehicles it fits — how an auto-parts catalogue is searched. */
  vehicleMake: string | null
  vehicleModels: string[]

  cargoWeightKg: number | null
  /** Free text, e.g. "120*60*30". */
  cargoSize: string | null

  isShippable: boolean
  showOnline: boolean

  /** The axes this product varies along. Empty when it is sold one way. */
  options: ProductOption[]
  variations: ProductVariation[]
  status: ProductStatus
  createdAt: IsoDate
  updatedAt: IsoDate
}

/**
 * A variation flattened with the parent fields needed to display or search it.
 * This is what the catalogue lists and what a sale line points at.
 */
export interface VariationRow extends ProductVariation {
  productName: string
  /** Product name and variation together, e.g. "Brake disc — Left". */
  fullName: string
  description: string | null
  categoryId: Id
  categoryName: string
  categoryPath: string
  brandId: Id | null
  brandName: string | null
  manufacturer: string | null
  tags: string[]
  unit: UnitOfMeasure
  vehicleMake: string | null
  vehicleModels: string[]
  cargoWeightKg: number | null
  cargoSize: string | null
  isShippable: boolean
  showOnline: boolean
  options: ProductOption[]
}

/* --- money -------------------------------------------------------------- */

/** What the discount takes off, in money. OX shows this beside the net price. */
export const discountAmount = (v: Pick<ProductVariation, 'salePrice' | 'discountPrice'>) =>
  v.discountPrice === null ? 0 : v.salePrice - v.discountPrice

export const effectivePrice = (v: Pick<ProductVariation, 'salePrice' | 'discountPrice'>) =>
  v.discountPrice ?? v.salePrice

export const costInUzs = (
  v: Pick<ProductVariation, 'costPrice' | 'costCurrency'>,
  usdRate: number,
) => (v.costCurrency === 'USD' ? v.costPrice * usdRate : v.costPrice)

/** Derived, never stored — margin must always follow live prices. */
export function marginRatio(
  v: Pick<ProductVariation, 'costPrice' | 'costCurrency' | 'salePrice' | 'discountPrice'>,
  usdRate: number,
): number {
  const price = effectivePrice(v)
  if (price === 0) return 0
  return (price - costInUzs(v, usdRate)) / price
}

/* --- product-level aggregates ------------------------------------------- */

export const productStock = (product: Product) =>
  product.variations.reduce((sum, v) => sum + v.stock, 0)

/** Products show a price range, since variations can be priced differently. */
export function productPriceRange(product: Product): { min: number; max: number } {
  const prices = product.variations.map(effectivePrice)
  return { min: Math.min(...prices), max: Math.max(...prices) }
}

/* --- options and combinations ------------------------------------------- */

/** Options that are actually usable: named, and with at least one value. */
export const usableOptions = <T extends { name: string; values: string[] }>(options: T[]) =>
  options.filter((option) => option.name.trim() && option.values.length > 0)

/**
 * Every combination of one value per option, in option order — the cartesian
 * product. Two options of 2 and 3 values give 6 combinations, named
 * "Left / Black", "Left / Silver", and so on.
 */
export function optionCombinations<T extends { id: Id; values: string[] }>(
  options: T[],
): OptionValue[][] {
  return options.reduce<OptionValue[][]>(
    (rows, option) =>
      rows.flatMap((row) => option.values.map((value) => [...row, { optionId: option.id, value }])),
    [[]],
  )
}

/** How a combination is displayed and stored as a variation's name. */
export const combinationName = (values: OptionValue[]) => values.map((v) => v.value).join(' / ')

/** Identity of a combination, for matching an edited grid against the old one. */
const combinationKey = (values: OptionValue[]) =>
  values
    .map((v) => `${v.optionId}=${v.value}`)
    .sort()
    .join('|')

/**
 * Rebuilds the variation grid after the options change, **keeping what the user
 * already typed**.

 * Three ways a row can survive:
 *
 * 1. *Exact* — the same combination still exists, so it is untouched. Matching
 *    is by combination and not by position, so reordering an option's values
 *    does not shuffle prices onto the wrong rows.
 * 2. *Inherited* — a second option was added, so "Left" becomes "Left / Black",
 *    "Left / Silver", "Left / Red". All three inherit the pricing and settings
 *    that were typed for "Left", because re-typing them is what makes people
 *    abandon options and create three products instead. Only the first keeps
 *    the SKU and barcode: those identify one sellable thing and cannot be
 *    duplicated.
 * 3. Otherwise the combination is new and arrives blank.
 *
 * Anything left over is reported in `dropped` so the caller can say so rather
 * than letting typed work disappear silently.
 */
export function reconcileVariations<
  T extends { optionValues: OptionValue[]; sku: string; id?: string; barcode?: string | null },
>(
  options: { id: Id; values: string[] }[],
  existing: T[],
  blank: (values: OptionValue[]) => T,
  /**
   * Applied to a row that starts from a donor's values but is a new sellable
   * thing in its own right. Anything counted rather than described — stock
   * above all — belongs here: "Left / Silver" inherits Left's price, but not
   * Left's discs.
   */
  onNew: (row: T) => T = (row) => row,
): { variations: T[]; dropped: T[] } {
  const combinations = optionCombinations(options)
  // With no usable options the product is sold one way: keep the first row.
  if (combinations.length === 1 && combinations[0]!.length === 0) {
    const [first, ...rest] = existing
    return {
      variations: [first ? { ...first, optionValues: [] } : blank([])],
      dropped: rest,
    }
  }

  const survivors = new Set<T>()
  /** A donor's identity passes to one row only; later inheritors start blank. */
  const claimed = new Set<T>()

  const variations = combinations.map((values) => {
    const key = combinationKey(values)
    const exact = existing.find((v) => combinationKey(v.optionValues) === key)
    if (exact) {
      survivors.add(exact)
      claimed.add(exact)
      return { ...exact, optionValues: values }
    }

    /**
     * The closest relative: how many option answers this combination and that
     * variation share outright. One rule covers every edit —
     *
     * - widening ("Left" → "Left / Black") agrees on Side;
     * - narrowing ("Left / Black" → "Left") agrees on Side;
     * - a new value ("Left / Silver" beside "Left / Black") agrees on Side, so
     *   it starts from its sibling's pricing rather than from zero;
     * - renaming a value ("Left" → "Nearside") agrees on nothing when Side is
     *   the only option, so that row correctly starts blank.
     *
     * A guessed price the user can see and overwrite beats an empty grid; a
     * guessed SKU would be a duplicate identity, which is why only the first
     * claimant of a donor keeps it.
     */
    const agreement = (v: T) =>
      v.optionValues.filter((own) =>
        values.some((value) => value.optionId === own.optionId && value.value === own.value),
      ).length

    const donor = existing
      .map((v) => ({ v, score: agreement(v) }))
      .filter((candidate) => candidate.score > 0)
      // Most in common first; among equals prefer one that still has an
      // identity, so narrowing recovers the SKU rather than a blank sibling.
      .sort(
        (a, b) => b.score - a.score || Number(Boolean(b.v.sku)) - Number(Boolean(a.v.sku)),
      )[0]?.v

    if (!donor) return blank(values)
    survivors.add(donor)
    // Only one row may continue the donor's identity — its id, SKU and
    // barcode. The rest are new variations that merely start from its
    // pricing; giving them the same id would make two rows the same record.
    const first = !claimed.has(donor)
    claimed.add(donor)
    const inherited = { ...donor, optionValues: values }
    if (first) return inherited
    return onNew({
      ...inherited,
      id: undefined,
      sku: '',
      ...('barcode' in donor ? { barcode: null } : {}),
    })
  })

  return { variations, dropped: existing.filter((v) => !survivors.has(v)) }
}

/* --- validation --------------------------------------------------------- */

/**
 * How many sellable things this product is. A product sold one way — one
 * barcode, one price — should not have to invent a variation name for itself,
 * so the form asks for the mode first and hides the name field in `single`.
 * Storage is unchanged either way: a single product is still one variation.
 */
export type VariationMode = 'single' | 'multiple'

/** What a form holds for one location's opening or on-hand quantity. */
export const stockAtLocationFormSchema = z.object({
  locationId: z.string(),
  quantity: z.number().int().nonnegative(),
})

export const optionFormSchema = z.object({
  id: z.string(),
  name: z.string(),
  values: z.array(z.string()),
})

export const variationFormSchema = z.object({
  /** Present when editing an existing variation, absent for a new one. */
  id: z.string().optional(),
  /**
   * Whether this combination is actually sold. Options multiply out to every
   * pairing, but a catalogue rarely stocks all of them — there may be a left
   * in black and a right in red and nothing else. An unsold combination stays
   * visible so it can be switched back on, but is not asked for and not saved.
   */
  enabled: z.boolean(),
  // Required only when the combination is sold — see the refinement below.
  sku: z.string(),
  barcode: z.string().nullable(),
  partSide: z.enum(['left', 'right', 'both']).nullable(),
  costPrice: z.number().nonnegative(),
  costCurrency: z.enum(['USD', 'UZS']),
  salePrice: z.number().nonnegative(),
  discountPrice: z.number().nonnegative().nullable(),
  lowStockThreshold: z.number().int().nonnegative().nullable(),
  shelfAddress: z.string().nullable(),
  moq: z.number().int().positive().nullable(),
  status: z.enum(['active', 'archived', 'draft']),
  stockByLocation: z.array(stockAtLocationFormSchema),
  optionValues: z.array(z.object({ optionId: z.string(), value: z.string() })),
})

export const productFormSchema = z
  .object({
    name: z.string().min(2, 'Name is required'),
    description: z.string().nullable(),
    categoryId: z.string().min(1, 'Pick a category'),
    brandId: z.string().nullable(),
    manufacturer: z.string().nullable(),
    tags: z.array(z.string()),
    unit: z.enum(['pcs', 'kg', 'l', 'm', 'pack']),
    vehicleMake: z.string().nullable(),
    vehicleModels: z.array(z.string()),
    cargoWeightKg: z.number().nonnegative().nullable(),
    cargoSize: z.string().nullable(),
    isShippable: z.boolean(),
    showOnline: z.boolean(),
    status: z.enum(['active', 'archived', 'draft']),
    variationMode: z.enum(['single', 'multiple']),
    options: z.array(optionFormSchema).max(MAX_OPTIONS),
    /**
     * Which locations stock this product. Quantities are only asked for these,
     * and a location dropped here loses its stock rows on save.
     */
    locationIds: z.array(z.string()).min(1, 'Stock it at one location at least'),
    // A product with no variations is not sellable.
    variations: z.array(variationFormSchema).min(1, 'Add at least one variation'),
  })
  .superRefine((values, ctx) => {
    // A combination that is not sold is not asked for — that is the whole
    // point of switching it off — so SKU is required per sold row here rather
    // than on the field itself.
    values.variations.forEach((variation, index) => {
      if (!variation.enabled || variation.sku.trim()) return
      ctx.addIssue({
        code: 'custom',
        path: ['variations', index, 'sku'],
        message: 'SKU is required',
      })
    })

    if (values.variationMode !== 'multiple') return

    // Variation names are generated from the options, so it is the options
    // that have to be complete — a half-filled option would silently produce
    // no variations at all.
    if (usableOptions(values.options).length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['options'],
        message: 'Add an option with at least one value, or switch to one variation',
      })
    }

    const sold = values.variations.filter((variation) => variation.enabled)
    if (sold.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['variations'],
        message: 'Tick at least one combination — a product with none is not sellable',
      })
    }

    values.options.forEach((option, index) => {
      if (!option.name.trim()) {
        ctx.addIssue({
          code: 'custom',
          path: ['options', index, 'name'],
          message: 'Name this option',
        })
      }
      if (option.values.length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['options', index, 'values'],
          message: 'Add at least one value',
        })
      }
    })

    // Two options called the same thing make two identical column headings.
    const names = values.options.map((o) => o.name.trim().toLowerCase()).filter(Boolean)
    names.forEach((name, index) => {
      if (names.indexOf(name) === index) return
      ctx.addIssue({
        code: 'custom',
        path: ['options', index, 'name'],
        message: 'Already used by another option',
      })
    })
  })

export type ProductFormValues = z.infer<typeof productFormSchema>
