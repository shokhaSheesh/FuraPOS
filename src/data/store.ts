import { create } from 'zustand'
import { combinationName } from '@/features/products/model/product'
import type { Product, VariationRow } from '@/features/products/model/product'
import type { Transfer, TransferLine, TransferStatus } from '@/features/transfers/model/transfer'
import type {
  Correction,
  CorrectionLine,
  CorrectionReason,
} from '@/features/corrections/model/correction'
import type {
  Stocktake,
  StocktakeLine,
} from '@/features/stocktaking/model/stocktake'
import {
  priceUnder,
  type Repricing,
  type RepricingLine,
} from '@/features/repricing/model/repricing'
import {
  landedUnitCost,
  type AdditionalCost,
  type GoodsReceipt,
  type ReceiptLine,
  type ReceiptStatus,
} from '@/features/receipts/model/receipt'
import type { Sale, SaleLine, SaleStatus } from '@/features/sales/model/sale'
import {
  brands,
  categories,
  clients,
  locations,
  products as seedProducts,
  sales as seedSales,
  USD_RATE,
  corrections as seedCorrections,
  receipts as seedReceipts,
  repricings as seedRepricings,
  stocktakes as seedStocktakes,
  suppliers,
  transfers as seedTransfers,
  variations as seedVariations,
} from './seed'
import { computeTotals } from '@/features/sales/model/sale'

export interface Client {
  id: string
  name: string
  phone: string
  debt: number
}

interface CatalogState {
  products: Product[]
  variations: VariationRow[]
  sales: Sale[]
  transfers: Transfer[]
  corrections: Correction[]
  receipts: GoodsReceipt[]
  stocktakes: Stocktake[]
  repricings: Repricing[]
  clients: Client[]
  categories: typeof categories
  brands: typeof brands
  locations: typeof locations
  suppliers: typeof suppliers

  createSale: (input: CreateSaleInput) => Sale
  updateSale: (id: string, patch: { status?: SaleStatus; paid?: number }) => Sale | undefined
  deleteVariation: (id: string) => void
  /** Inline toggles on the catalogue row, as in the reference product. */
  setProductFlag: (productId: string, flag: 'isShippable' | 'showOnline', value: boolean) => void
  createProduct: (input: ProductInput) => Product
  updateProduct: (id: string, input: ProductInput) => Product | undefined

  createTransfer: (input: CreateTransferInput) => Transfer
  /**
   * Advances a transfer and moves the stock that goes with it. Returns the
   * reason it could not, so the screen can say so rather than failing quietly.
   */
  setTransferStatus: (
    id: string,
    to: TransferStatus,
    /**
     * Per-line quantities for this step, keyed by line id: what is actually
     * being sent, or what actually arrived. Omitted means "all of it".
     */
    quantities?: Record<string, number>,
  ) => { ok: true } | { ok: false; error: string }

  createReceipt: (input: CreateReceiptInput) => GoodsReceipt
  /** Posts or cancels a receipt, landing or reversing the stock that goes with it. */
  setReceiptStatus: (
    id: string,
    to: ReceiptStatus,
    /** What was actually counted off the truck, keyed by line id. */
    quantities?: Record<string, number>,
  ) => { ok: true } | { ok: false; error: string }

  /** Prepares a price change: works out every new price but changes nothing yet. */
  createRepricing: (input: CreateRepricingInput) => Repricing
  /** Overrides one line's new price, for hand-tuning before applying. */
  setRepricingPrice: (id: string, lineId: string, newPrice: number) => void
  applyRepricing: (id: string) => { ok: true } | { ok: false; error: string }
  /** Puts every price back to what it was, exactly. */
  revertRepricing: (id: string) => { ok: true } | { ok: false; error: string }

  /** Opens a count: freezes what the system believes for everything in scope. */
  startStocktake: (input: StartStocktakeInput) => Stocktake
  /** Records one shelf count. `null` puts a line back to uncounted. */
  setStocktakeCount: (id: string, lineId: string, counted: number | null) => void
  /** Commits the variances as a correction, and returns it. */
  applyStocktake: (id: string) => { ok: true; correctionId: string } | { ok: false; error: string }
  cancelStocktake: (id: string) => { ok: true } | { ok: false; error: string }

  createCorrection: (input: CreateCorrectionInput) => Correction
  /** Reverses a correction's effect, leaving both documents in the history. */
  cancelCorrection: (id: string) => { ok: true } | { ok: false; error: string }
}

export interface CreateReceiptInput {
  supplierId: string | null
  invoiceNumber: string
  locationId: string
  comment: string
  lines: ReceiptLine[]
  additionalCosts: AdditionalCost[]
  /** Draft to keep working on it, received to post it straight away. */
  status: Extract<ReceiptStatus, 'draft' | 'received'>
}

export interface CreateRepricingInput {
  rule: Repricing['rule']
  /** Empty means everything. */
  categoryId: string
  brandId: string
  comment: string
}

export interface StartStocktakeInput {
  locationId: string
  /** Empty means every category. */
  categoryId: string
  /** Empty means every brand. */
  brandId: string
  comment: string
}

export interface CreateCorrectionInput {
  locationId: string
  reason: CorrectionReason
  comment: string
  /** `countedBefore` is ignored: the store reads it live at the moment of writing. */
  lines: CorrectionLine[]
  /** Set by a stocktake so its adjustment is traceable back to the count. */
  source?: 'manual' | 'stocktake'
  sourceRef?: string | null
}

export interface CreateTransferInput {
  fromLocationId: string
  toLocationId: string
  comment: string
  lines: TransferLine[]
  /** Draft to keep working on it, in_transit to send it straight away. */
  status: Extract<TransferStatus, 'draft' | 'in_transit'>
}

export interface CreateSaleInput {
  clientId: string | null
  locationId: string
  channel: Sale['channel']
  paymentMethod: Sale['paymentMethod']
  comment: string
  paid: number
  lines: SaleLine[]
  status: SaleStatus
  expiresAt: string | null
  delivery: Sale['delivery']
}

type VariationInput = Omit<
  Product['variations'][number],
  'id' | 'productId' | 'stock' | 'stockByLocation' | 'imageUrl' | 'name'
> & {
  /** The name is generated from `optionValues`, never sent. */
  id?: string
  /** Quantity per location; `stock` is the sum and is never sent. */
  stockByLocation: { locationId: string; quantity: number }[]
}

export type ProductInput = Omit<
  Product,
  'id' | 'categoryName' | 'categoryPath' | 'brandName' | 'createdAt' | 'updatedAt' | 'variations'
> & {
  variations: VariationInput[]
}

/**
 * A variation is named by its option values — "Left / Black" — so the name is
 * derived on write and never typed. A product sold one way has no options, and
 * its lone variation keeps the neutral name the catalogue hides anyway.
 */
const variationName = (optionValues: { value: string }[]) =>
  optionValues.length ? combinationName(optionValues as never) : 'Standard'

/**
 * Turns a form's `{ locationId, quantity }` rows into stored stock: names are
 * resolved here so screens never have to join, and `stock` is always the sum
 * so the two can never disagree.
 */
function resolveStock(
  rows: { locationId: string; quantity: number }[],
  locationList: readonly { id: string; name: string }[],
) {
  const stockByLocation = rows.map((row) => ({
    locationId: row.locationId,
    locationName: locationList.find((l) => l.id === row.locationId)?.name ?? '—',
    quantity: row.quantity,
  }))
  return { stockByLocation, stock: stockByLocation.reduce((sum, r) => sum + r.quantity, 0) }
}

/** Keeps the flat sellable list in step with a product's variations. */
function flatten(product: Product): VariationRow[] {
  return product.variations.map((variation) => ({
    ...variation,
    options: product.options,
    status: product.status === 'archived' ? 'archived' : variation.status,
    productName: product.name,
    fullName: product.variations.length > 1 ? `${product.name} — ${variation.name}` : product.name,
    description: product.description,
    categoryId: product.categoryId,
    categoryName: product.categoryName,
    categoryPath: product.categoryPath,
    brandId: product.brandId,
    brandName: product.brandName,
    manufacturer: product.manufacturer,
    tags: product.tags,
    unit: product.unit,
    vehicleMake: product.vehicleMake,
    vehicleModels: product.vehicleModels,
    cargoWeightKg: product.cargoWeightKg,
    cargoSize: product.cargoSize,
    isShippable: product.isShippable,
    showOnline: product.showOnline,
  }))
}

/**
 * Adds `delta` to one variation's quantity at one location, in both places the
 * app reads stock from: the nested product and the flat catalogue row. They are
 * two views of one fact, so they are always written together — and `stock`
 * is recomputed as the sum rather than adjusted, so it cannot drift.
 *
 * A location the variation has never been stocked at gains a row; a row that
 * reaches zero is kept, because "carried here, none right now" is different
 * from "not carried here" and the catalogue's location filter relies on it.
 */
function applyStockDelta(
  variations: { locationId: string; locationName: string; quantity: number }[],
  locationId: string,
  locationName: string,
  delta: number,
) {
  const existing = variations.find((row) => row.locationId === locationId)
  const next = existing
    ? variations.map((row) =>
        row.locationId === locationId ? { ...row, quantity: row.quantity + delta } : row,
      )
    : [...variations, { locationId, locationName, quantity: delta }]
  return { stockByLocation: next, stock: next.reduce((sum, row) => sum + row.quantity, 0) }
}

/**
 * Applies a map of variationId → delta at one location, in both places stock
 * is read from. Shared by transfers and corrections so there is exactly one
 * piece of code that can change what a shelf holds.
 */
function commitDeltas(
  state: { products: Product[]; variations: VariationRow[] },
  deltas: Map<string, number>,
  locationId: string,
  locationName: string,
) {
  return {
    products: state.products.map((product) => {
      if (!product.variations.some((v) => deltas.has(v.id))) return product
      return {
        ...product,
        variations: product.variations.map((variation) => {
          const delta = deltas.get(variation.id)
          if (delta === undefined || delta === 0) return variation
          return {
            ...variation,
            ...applyStockDelta(variation.stockByLocation, locationId, locationName, delta),
          }
        }),
      }
    }),
    variations: state.variations.map((row) => {
      const delta = deltas.get(row.id)
      if (delta === undefined || delta === 0) return row
      return {
        ...row,
        ...applyStockDelta(row.stockByLocation, locationId, locationName, delta),
      }
    }),
  }
}

/** What one location currently holds of one variation. */
const quantityAt = (rows: { locationId: string; quantity: number }[], locationId: string) =>
  rows.find((row) => row.locationId === locationId)?.quantity ?? 0

/**
 * The whole dataset, in memory. Everything the screens show comes from here —
 * there is no backend and no network. Writes replace the relevant array so
 * subscribed components re-render.
 */
export const useDataStore = create<CatalogState>((set, get) => ({
  products: seedProducts,
  variations: seedVariations,
  sales: seedSales,
  transfers: seedTransfers,
  corrections: seedCorrections,
  receipts: seedReceipts,
  stocktakes: seedStocktakes,
  repricings: seedRepricings,
  clients,
  categories,
  brands,
  locations,
  suppliers,

  createSale: (input) => {
    const sales = get().sales
    const sequence = sales.length + 1
    const totals = computeTotals(input.lines, input.paid)
    const client = get().clients.find((c) => c.id === input.clientId)
    const now = new Date().toISOString()

    const sale: Sale = {
      id: `sale-${sequence}`,
      number: `S-${String(sequence).padStart(5, '0')}`,
      status: input.status,
      channel: input.channel,
      clientId: input.clientId,
      clientName: client?.name ?? null,
      locationId: input.locationId,
      locationName: get().locations.find((l) => l.id === input.locationId)?.name ?? '—',
      sellerName: 'Akhmet Dauletmuratov',
      paymentMethod: input.paymentMethod,
      comment: input.comment || null,
      lines: input.lines,
      subtotal: totals.subtotal,
      discount: totals.discount,
      deliveryCost: input.delivery?.cost ?? 0,
      total: totals.total + (input.delivery?.cost ?? 0),
      paid: input.paid,
      debt: Math.max(0, totals.total + (input.delivery?.cost ?? 0) - input.paid),
      delivery: input.delivery,
      expiresAt: input.expiresAt,
      createdAt: now,
      updatedAt: now,
      finishedAt: input.status === 'completed' ? now : null,
    }

    set({ sales: [...sales, sale] })
    return sale
  },

  updateSale: (id, patch) => {
    let updated: Sale | undefined
    set({
      sales: get().sales.map((sale) => {
        if (sale.id !== id) return sale
        const paid =
          patch.paid !== undefined ? Math.min(sale.total, sale.paid + patch.paid) : sale.paid
        const status = patch.status ?? sale.status
        updated = {
          ...sale,
          status,
          paid,
          debt: Math.max(0, sale.total - paid),
          updatedAt: new Date().toISOString(),
          finishedAt:
            status === 'completed' || status === 'delivered'
              ? (sale.finishedAt ?? new Date().toISOString())
              : sale.finishedAt,
        }
        return updated
      }),
    })
    return updated
  },

  deleteVariation: (id) => set({ variations: get().variations.filter((v) => v.id !== id) }),

  setProductFlag: (productId, flag, value) =>
    set({
      products: get().products.map((p) => (p.id === productId ? { ...p, [flag]: value } : p)),
      // The flag lives on the product, so every one of its rows moves together.
      variations: get().variations.map((v) =>
        v.productId === productId ? { ...v, [flag]: value } : v,
      ),
    }),

  createProduct: (input) => {
    const id = `prd-${get().products.length + 1}`
    const category = get().categories.find((c) => c.id === input.categoryId)
    const now = new Date().toISOString()

    const product: Product = {
      ...input,
      id,
      categoryName: category?.name ?? '—',
      categoryPath: category?.path ?? '—',
      brandName: get().brands.find((b) => b.id === input.brandId)?.name ?? null,
      variations: input.variations.map((variation, index) => ({
        ...variation,
        id: variation.id ?? `var-${id}-${index + 1}`,
        productId: id,
        name: variationName(variation.optionValues),
        ...resolveStock(variation.stockByLocation, get().locations),
        imageUrl: null,
      })),
      createdAt: now,
      updatedAt: now,
    }

    set({
      products: [...get().products, product],
      variations: [...get().variations, ...flatten(product)],
    })
    return product
  },

  updateProduct: (id, input) => {
    const existing = get().products.find((p) => p.id === id)
    if (!existing) return undefined
    const category = get().categories.find((c) => c.id === input.categoryId)

    const product: Product = {
      ...existing,
      ...input,
      id,
      categoryName: category?.name ?? existing.categoryName,
      categoryPath: category?.path ?? existing.categoryPath,
      brandName: get().brands.find((b) => b.id === input.brandId)?.name ?? null,
      variations: input.variations.map((variation, index) => {
        const previous = existing.variations.find((v) => v.id === variation.id)
        return {
          ...variation,
          id: variation.id ?? `var-${id}-${Date.now()}-${index}`,
          productId: id,
          name: variationName(variation.optionValues),
          ...resolveStock(variation.stockByLocation, get().locations),
          imageUrl: previous?.imageUrl ?? null,
        }
      }),
      updatedAt: new Date().toISOString(),
    }

    set({
      products: get().products.map((p) => (p.id === id ? product : p)),
      variations: [...get().variations.filter((v) => v.productId !== id), ...flatten(product)],
    })
    return product
  },

  createTransfer: (input) => {
    const sequence = get().transfers.length + 1
    const now = new Date().toISOString()
    const named = (id: string) => get().locations.find((l) => l.id === id)?.name ?? '—'

    const transfer: Transfer = {
      id: `tr-${sequence}`,
      number: `TR-${String(sequence).padStart(5, '0')}`,
      status: 'draft',
      fromLocationId: input.fromLocationId,
      fromLocationName: named(input.fromLocationId),
      toLocationId: input.toLocationId,
      toLocationName: named(input.toLocationId),
      lines: input.lines,
      comment: input.comment || null,
      createdBy: 'Akhmet Dauletmuratov',
      sentBy: null,
      receivedBy: null,
      createdAt: now,
      sentAt: null,
      receivedAt: null,
      updatedAt: now,
    }

    set({ transfers: [...get().transfers, transfer] })
    // Sending goes through the same path as sending later, so the stock
    // deduction and its checks exist in exactly one place.
    if (input.status === 'in_transit') get().setTransferStatus(transfer.id, 'in_transit')
    return get().transfers.find((t) => t.id === transfer.id) ?? transfer
  },

  setTransferStatus: (id, to, quantities) => {
    const transfer = get().transfers.find((t) => t.id === id)
    if (!transfer) return { ok: false, error: 'That transfer no longer exists' }

    /** Moves the given per-line amounts at one end of the transfer. */
    const move = (
      locationId: string,
      locationName: string,
      sign: 1 | -1,
      amount: (line: TransferLine) => number,
    ) => {
      const byVariation = new Map<string, number>()
      for (const line of lines) {
        const quantity = amount(line)
        if (quantity <= 0) continue
        byVariation.set(line.variationId, (byVariation.get(line.variationId) ?? 0) + quantity)
      }
      set({
        products: get().products.map((product) => {
          if (!product.variations.some((v) => byVariation.has(v.id))) return product
          return {
            ...product,
            variations: product.variations.map((variation) => {
              const quantity = byVariation.get(variation.id)
              if (quantity === undefined) return variation
              return {
                ...variation,
                ...applyStockDelta(
                  variation.stockByLocation,
                  locationId,
                  locationName,
                  sign * quantity,
                ),
              }
            }),
          }
        }),
        variations: get().variations.map((row) => {
          const quantity = byVariation.get(row.id)
          if (quantity === undefined) return row
          return {
            ...row,
            ...applyStockDelta(row.stockByLocation, locationId, locationName, sign * quantity),
          }
        }),
      })
    }

    const now = new Date().toISOString()
    const actor = 'Akhmet Dauletmuratov'
    let lines = transfer.lines

    if (to === 'in_transit') {
      if (transfer.status !== 'draft') return { ok: false, error: 'This transfer has already left' }

      // What is actually being sent — the warehouse may not have found all of
      // what was asked for. Defaults to the full request.
      lines = transfer.lines.map((line) => ({
        ...line,
        sentQuantity: Math.max(0, quantities?.[line.id] ?? line.requestedQuantity),
      }))

      const nothing = lines.every((line) => (line.sentQuantity ?? 0) === 0)
      if (nothing) return { ok: false, error: 'Nothing to send — every line is zero' }

      // Checked against live stock, not against what was available when the
      // draft was written — a sale may have taken the last one since.
      const short = lines.find((line) => {
        const row = get().variations.find((v) => v.id === line.variationId)
        return (
          !row ||
          quantityAt(row.stockByLocation, transfer.fromLocationId) < (line.sentQuantity ?? 0)
        )
      })
      if (short) {
        return {
          ok: false,
          error: `${transfer.fromLocationName} no longer has ${short.sentQuantity} × ${short.name}`,
        }
      }
      move(transfer.fromLocationId, transfer.fromLocationName, -1, (line) => line.sentQuantity ?? 0)
    }

    if (to === 'received') {
      if (transfer.status !== 'in_transit') {
        return { ok: false, error: 'Only a transfer in transit can be received' }
      }
      // What actually turned up. Anything sent but not received never arrives
      // anywhere: it left the source shelf and is simply gone, which is exactly
      // what the shortfall on the document records.
      lines = transfer.lines.map((line) => ({
        ...line,
        receivedQuantity: Math.min(
          line.sentQuantity ?? 0,
          Math.max(0, quantities?.[line.id] ?? line.sentQuantity ?? 0),
        ),
      }))
      move(transfer.toLocationId, transfer.toLocationName, 1, (line) => line.receivedQuantity ?? 0)
    }

    if (to === 'cancelled') {
      if (transfer.status === 'received') {
        return { ok: false, error: 'It has already been received — correct it instead' }
      }
      // Goods already on the truck go back where they came from; a draft never
      // moved anything, so there is nothing to undo.
      if (transfer.status === 'in_transit') {
        move(
          transfer.fromLocationId,
          transfer.fromLocationName,
          1,
          (line) => line.sentQuantity ?? 0,
        )
      }
    }

    set({
      transfers: get().transfers.map((t) =>
        t.id === id
          ? {
              ...t,
              status: to,
              lines,
              sentAt: to === 'in_transit' ? now : t.sentAt,
              sentBy: to === 'in_transit' ? actor : t.sentBy,
              receivedAt: to === 'received' ? now : t.receivedAt,
              receivedBy: to === 'received' ? actor : t.receivedBy,
              updatedAt: now,
            }
          : t,
      ),
    })
    return { ok: true }
  },

  createReceipt: (input) => {
    const sequence = get().receipts.length + 1
    const now = new Date().toISOString()

    const receipt: GoodsReceipt = {
      id: `gr-${sequence}`,
      number: `GR-${String(sequence).padStart(5, '0')}`,
      status: 'draft',
      supplierId: input.supplierId,
      supplierName: get().suppliers.find((s) => s.id === input.supplierId)?.name ?? null,
      invoiceNumber: input.invoiceNumber || null,
      locationId: input.locationId,
      locationName: get().locations.find((l) => l.id === input.locationId)?.name ?? '—',
      lines: input.lines,
      additionalCosts: input.additionalCosts,
      comment: input.comment || null,
      createdBy: 'Akhmet Dauletmuratov',
      receivedBy: null,
      createdAt: now,
      receivedAt: null,
      updatedAt: now,
    }

    set({ receipts: [...get().receipts, receipt] })
    // Posting goes through the same path whether it happens now or later, so
    // the stock and cost effects exist in exactly one place.
    if (input.status === 'received') get().setReceiptStatus(receipt.id, 'received')
    return get().receipts.find((r) => r.id === receipt.id) ?? receipt
  },

  setReceiptStatus: (id, to, quantities) => {
    const receipt = get().receipts.find((r) => r.id === id)
    if (!receipt) return { ok: false, error: 'That receipt no longer exists' }

    let lines = receipt.lines

    if (to === 'received') {
      if (receipt.status !== 'draft') return { ok: false, error: 'This receipt is already posted' }
      lines = receipt.lines.map((line) => ({
        ...line,
        receivedQuantity: Math.max(0, quantities?.[line.id] ?? line.orderedQuantity),
      }))
      if (lines.every((line) => (line.receivedQuantity ?? 0) === 0)) {
        return { ok: false, error: 'Nothing to receive — every line is zero' }
      }
    }

    if (to === 'cancelled' && receipt.status === 'draft') {
      // A draft never landed anything, so cancelling only closes the document.
      set({
        receipts: get().receipts.map((r) =>
          r.id === id ? { ...r, status: 'cancelled', updatedAt: new Date().toISOString() } : r,
        ),
      })
      return { ok: true }
    }

    if (to === 'cancelled' && receipt.status === 'cancelled') {
      return { ok: false, error: 'It has already been cancelled' }
    }

    const sign = to === 'received' ? 1 : -1
    const deltas = new Map<string, number>()
    for (const line of lines) {
      const quantity = line.receivedQuantity ?? 0
      if (quantity > 0) {
        deltas.set(line.variationId, (deltas.get(line.variationId) ?? 0) + sign * quantity)
      }
    }

    // Cancelling a posted receipt must not leave stock it created behind, and
    // must not push a shelf below zero either — the goods may already be sold.
    if (sign === -1) {
      const overdrawn = [...deltas.entries()].find(([variationId, delta]) => {
        const row = get().variations.find((v) => v.id === variationId)
        return quantityAt(row?.stockByLocation ?? [], receipt.locationId) + delta < 0
      })
      if (overdrawn) {
        const name = lines.find((line) => line.variationId === overdrawn[0])?.name ?? 'a product'
        return {
          ok: false,
          error: `${name} has already left ${receipt.locationName} — correct it instead of cancelling`,
        }
      }
    }

    const now = new Date().toISOString()

    set({
      receipts: get().receipts.map((r) =>
        r.id === id
          ? {
              ...r,
              status: to,
              lines,
              receivedAt: to === 'received' ? now : r.receivedAt,
              receivedBy: to === 'received' ? 'Akhmet Dauletmuratov' : r.receivedBy,
              updatedAt: now,
            }
          : r,
      ),
      ...commitDeltas(get(), deltas, receipt.locationId, receipt.locationName),
    })

    /*
      Posting is where a cost price is actually discovered. The variation takes
      the *landed* cost of this receipt — the supplier's price plus its share of
      freight and duty — because a cost that ignores those makes every margin on
      every screen optimistic.

      Last landed cost wins, rather than a weighted average across what is
      already on the shelf. It is the simpler rule and the predictable one, but
      it is a business decision: see docs/OX-NAVIGATION-MAP.md.
    */
    if (to === 'received') {
      const costs = new Map<string, number>()
      for (const line of lines) {
        if ((line.receivedQuantity ?? 0) > 0) {
          costs.set(line.variationId, landedUnitCost(line, { ...receipt, lines }, USD_RATE))
        }
      }
      set({
        products: get().products.map((product) =>
          product.variations.some((v) => costs.has(v.id))
            ? {
                ...product,
                variations: product.variations.map((variation) =>
                  costs.has(variation.id)
                    ? {
                        ...variation,
                        costPrice: Math.round(costs.get(variation.id)!),
                        costCurrency: 'UZS',
                      }
                    : variation,
                ),
              }
            : product,
        ),
        variations: get().variations.map((row) =>
          costs.has(row.id)
            ? { ...row, costPrice: Math.round(costs.get(row.id)!), costCurrency: 'UZS' }
            : row,
        ),
      })
    }

    return { ok: true }
  },

  createRepricing: (input) => {
    const sequence = get().repricings.length + 1
    const now = new Date().toISOString()
    const category = get().categories.find((c) => c.id === input.categoryId)
    const brand = get().brands.find((b) => b.id === input.brandId)

    const lines: RepricingLine[] = get()
      .variations.filter((variation) => {
        if (variation.status === 'archived') return false
        if (input.categoryId && variation.categoryId !== input.categoryId) return false
        if (input.brandId && variation.brandId !== input.brandId) return false
        return true
      })
      .map((variation, index) => {
        // Cost is snapshotted in UZS so the margin columns stay readable a
        // month later, when the rate has moved.
        const costAtTime =
          variation.costCurrency === 'USD' ? variation.costPrice * USD_RATE : variation.costPrice
        const base = {
          id: `rpl-${sequence}-${index + 1}`,
          variationId: variation.id,
          productId: variation.productId,
          sku: variation.sku,
          name: variation.fullName,
          imageUrl: variation.imageUrl,
          categoryName: variation.categoryName,
          costAtTime,
          oldPrice: variation.salePrice,
          oldDiscountPrice: variation.discountPrice,
        }
        const newPrice = priceUnder(input.rule, base)
        return {
          ...base,
          newPrice,
          // A promotional price moves with the price it discounts, keeping the
          // discount's shape rather than its absolute size.
          newDiscountPrice:
            variation.discountPrice === null || variation.salePrice === 0
              ? null
              : Math.round((variation.discountPrice / variation.salePrice) * newPrice),
        }
      })

    const repricing: Repricing = {
      id: `rp-${sequence}`,
      number: `RP-${String(sequence).padStart(5, '0')}`,
      status: 'draft',
      rule: input.rule,
      categoryId: input.categoryId || null,
      categoryName: category?.name ?? null,
      brandId: input.brandId || null,
      brandName: brand?.name ?? null,
      lines,
      comment: input.comment || null,
      createdBy: 'Akhmet Dauletmuratov',
      createdAt: now,
      appliedAt: null,
      revertedAt: null,
      updatedAt: now,
    }

    set({ repricings: [...get().repricings, repricing] })
    return repricing
  },

  setRepricingPrice: (id, lineId, newPrice) =>
    set({
      repricings: get().repricings.map((repricing) =>
        repricing.id === id
          ? {
              ...repricing,
              lines: repricing.lines.map((line) =>
                line.id === lineId
                  ? {
                      ...line,
                      newPrice: Math.max(0, newPrice),
                      newDiscountPrice:
                        line.oldDiscountPrice === null || line.oldPrice === 0
                          ? null
                          : Math.round((line.oldDiscountPrice / line.oldPrice) * newPrice),
                    }
                  : line,
              ),
              updatedAt: new Date().toISOString(),
            }
          : repricing,
      ),
    }),

  applyRepricing: (id) => {
    const repricing = get().repricings.find((r) => r.id === id)
    if (!repricing) return { ok: false, error: 'That price change no longer exists' }
    if (repricing.status !== 'draft') {
      return { ok: false, error: 'This price change has already been applied' }
    }

    const changed = repricing.lines.filter((line) => line.newPrice !== line.oldPrice)
    if (changed.length === 0) {
      return { ok: false, error: 'Nothing to apply — every price is unchanged' }
    }

    const next = new Map(changed.map((line) => [line.variationId, line]))
    const now = new Date().toISOString()

    set({
      products: get().products.map((product) =>
        product.variations.some((v) => next.has(v.id))
          ? {
              ...product,
              variations: product.variations.map((variation) => {
                const line = next.get(variation.id)
                return line
                  ? {
                      ...variation,
                      salePrice: line.newPrice,
                      discountPrice: line.newDiscountPrice,
                    }
                  : variation
              }),
            }
          : product,
      ),
      variations: get().variations.map((row) => {
        const line = next.get(row.id)
        return line
          ? { ...row, salePrice: line.newPrice, discountPrice: line.newDiscountPrice }
          : row
      }),
      repricings: get().repricings.map((r) =>
        r.id === id ? { ...r, status: 'applied', appliedAt: now, updatedAt: now } : r,
      ),
    })
    return { ok: true }
  },

  revertRepricing: (id) => {
    const repricing = get().repricings.find((r) => r.id === id)
    if (!repricing) return { ok: false, error: 'That price change no longer exists' }
    if (repricing.status !== 'applied') {
      return { ok: false, error: 'Only an applied price change can be reverted' }
    }

    /*
      Restores the exact prices that were snapshotted, not the reverse of the
      rule — a percentage reversed is not the original number, and rounding
      would make it drift further every time.
    */
    const previous = new Map(repricing.lines.map((line) => [line.variationId, line]))
    const now = new Date().toISOString()

    set({
      products: get().products.map((product) =>
        product.variations.some((v) => previous.has(v.id))
          ? {
              ...product,
              variations: product.variations.map((variation) => {
                const line = previous.get(variation.id)
                return line
                  ? {
                      ...variation,
                      salePrice: line.oldPrice,
                      discountPrice: line.oldDiscountPrice,
                    }
                  : variation
              }),
            }
          : product,
      ),
      variations: get().variations.map((row) => {
        const line = previous.get(row.id)
        return line
          ? { ...row, salePrice: line.oldPrice, discountPrice: line.oldDiscountPrice }
          : row
      }),
      repricings: get().repricings.map((r) =>
        r.id === id ? { ...r, status: 'reverted', revertedAt: now, updatedAt: now } : r,
      ),
    })
    return { ok: true }
  },

  startStocktake: (input) => {
    const sequence = get().stocktakes.length + 1
    const now = new Date().toISOString()
    const category = get().categories.find((c) => c.id === input.categoryId)
    const brand = get().brands.find((b) => b.id === input.brandId)

    /*
      Every variation the location carries goes on the sheet, including ones
      the system says are at zero — a shelf that should be empty and is not is
      exactly the discrepancy a stocktake is looking for. `expected` is frozen
      here, because it is what the person walking the aisle will be compared
      against; re-reading it at the end would blame them for a sale.
    */
    const lines: StocktakeLine[] = get()
      .variations.filter((variation) => {
        if (variation.status === 'archived') return false
        if (input.categoryId && variation.categoryId !== input.categoryId) return false
        if (input.brandId && variation.brandId !== input.brandId) return false
        return variation.stockByLocation.some((row) => row.locationId === input.locationId)
      })
      .map((variation, index) => ({
        id: `stl-${sequence}-${index + 1}`,
        variationId: variation.id,
        productId: variation.productId,
        sku: variation.sku,
        name: variation.fullName,
        imageUrl: variation.imageUrl,
        unit: variation.unit,
        categoryId: variation.categoryId,
        categoryName: variation.categoryName,
        shelfAddress: variation.shelfAddress,
        expected: quantityAt(variation.stockByLocation, input.locationId),
        counted: null,
        unitCost: variation.costPrice,
        costCurrency: variation.costCurrency,
      }))

    const stocktake: Stocktake = {
      id: `st-${sequence}`,
      number: `ST-${String(sequence).padStart(5, '0')}`,
      status: 'counting',
      locationId: input.locationId,
      locationName: get().locations.find((l) => l.id === input.locationId)?.name ?? '—',
      categoryId: input.categoryId || null,
      categoryName: category?.name ?? null,
      brandId: input.brandId || null,
      brandName: brand?.name ?? null,
      lines,
      comment: input.comment || null,
      createdBy: 'Akhmet Dauletmuratov',
      createdAt: now,
      appliedAt: null,
      correctionId: null,
      updatedAt: now,
    }

    set({ stocktakes: [...get().stocktakes, stocktake] })
    return stocktake
  },

  setStocktakeCount: (id, lineId, counted) =>
    set({
      stocktakes: get().stocktakes.map((stocktake) =>
        stocktake.id === id
          ? {
              ...stocktake,
              lines: stocktake.lines.map((line) =>
                line.id === lineId ? { ...line, counted } : line,
              ),
              updatedAt: new Date().toISOString(),
            }
          : stocktake,
      ),
    }),

  applyStocktake: (id) => {
    const stocktake = get().stocktakes.find((s) => s.id === id)
    if (!stocktake) return { ok: false, error: 'That stocktake no longer exists' }
    if (stocktake.status !== 'counting') {
      return { ok: false, error: 'This stocktake has already been closed' }
    }

    /*
      Only counted lines, and only ones that disagree. An uncounted line is not
      a zero — nobody got to it — and writing it off would turn an unfinished
      count into a fabricated loss. This is the whole reason a stocktake is not
      just a large correction.
    */
    const changed = stocktake.lines.filter(
      (line) => line.counted !== null && line.counted !== line.expected,
    )
    if (changed.length === 0) {
      return { ok: false, error: 'Nothing to apply — every count matches the system' }
    }

    /*
      The variance is measured against the frozen figure, then applied as a
      delta to whatever the shelf holds now. If a sale happened mid-count, that
      sale survives; setting the shelf to the counted number would silently
      undo it.
    */
    const correction = get().createCorrection({
      locationId: stocktake.locationId,
      reason: 'miscount',
      comment: `Stocktake ${stocktake.number}`,
      source: 'stocktake',
      sourceRef: stocktake.id,
      lines: changed.map((line) => ({
        id: line.id,
        variationId: line.variationId,
        productId: line.productId,
        sku: line.sku,
        name: line.name,
        imageUrl: line.imageUrl,
        unit: line.unit,
        // createCorrection reads `countedBefore` live and ignores what is passed,
        // so the delta below is applied against current stock, not the snapshot.
        countedBefore: line.expected,
        countedAfter:
          quantityAt(
            get().variations.find((v) => v.id === line.variationId)?.stockByLocation ?? [],
            stocktake.locationId,
          ) +
          (line.counted! - line.expected),
        unitCost: line.unitCost,
        costCurrency: line.costCurrency,
      })),
    })

    const now = new Date().toISOString()
    set({
      stocktakes: get().stocktakes.map((s) =>
        s.id === id
          ? { ...s, status: 'applied', appliedAt: now, correctionId: correction.id, updatedAt: now }
          : s,
      ),
    })
    return { ok: true, correctionId: correction.id }
  },

  cancelStocktake: (id) => {
    const stocktake = get().stocktakes.find((s) => s.id === id)
    if (!stocktake) return { ok: false, error: 'That stocktake no longer exists' }
    if (stocktake.status === 'applied') {
      return { ok: false, error: 'It has been applied — reverse its correction instead' }
    }
    set({
      stocktakes: get().stocktakes.map((s) =>
        s.id === id ? { ...s, status: 'cancelled', updatedAt: new Date().toISOString() } : s,
      ),
    })
    return { ok: true }
  },

  createCorrection: (input) => {
    const sequence = get().corrections.length + 1
    const now = new Date().toISOString()
    const location = get().locations.find((l) => l.id === input.locationId)
    const locationName = location?.name ?? '—'

    /*
      `countedBefore` is read here rather than trusted from the form: between
      opening the screen and saving, a sale may have taken one off the shelf.
      Recording what the system believed at the moment of writing is what keeps
      the document readable a month later, and it is what the delta is measured
      against — so a correction never silently undoes a sale it never saw.
    */
    const lines: CorrectionLine[] = input.lines.map((line) => ({
      ...line,
      countedBefore: quantityAt(
        get().variations.find((v) => v.id === line.variationId)?.stockByLocation ?? [],
        input.locationId,
      ),
    }))

    const correction: Correction = {
      id: `cor-${sequence}`,
      number: `CR-${String(sequence).padStart(5, '0')}`,
      status: 'applied',
      locationId: input.locationId,
      locationName,
      reason: input.reason,
      lines,
      source: input.source ?? 'manual',
      sourceRef: input.sourceRef ?? null,
      comment: input.comment || null,
      createdBy: 'Akhmet Dauletmuratov',
      createdAt: now,
      updatedAt: now,
    }

    const deltas = new Map<string, number>()
    for (const line of lines) {
      const delta = line.countedAfter - line.countedBefore
      if (delta !== 0) deltas.set(line.variationId, (deltas.get(line.variationId) ?? 0) + delta)
    }

    set({
      corrections: [...get().corrections, correction],
      ...commitDeltas(get(), deltas, input.locationId, locationName),
    })
    return correction
  },

  cancelCorrection: (id) => {
    const correction = get().corrections.find((c) => c.id === id)
    if (!correction) return { ok: false, error: 'That correction no longer exists' }
    if (correction.status === 'cancelled') {
      return { ok: false, error: 'It has already been cancelled' }
    }

    // Reversed, not deleted: the original and its reversal both stay in the
    // history, because "this was corrected and then un-corrected" is itself
    // something an auditor needs to be able to see.
    const deltas = new Map<string, number>()
    for (const line of correction.lines) {
      const delta = line.countedBefore - line.countedAfter
      if (delta !== 0) deltas.set(line.variationId, (deltas.get(line.variationId) ?? 0) + delta)
    }

    set({
      corrections: get().corrections.map((c) =>
        c.id === id ? { ...c, status: 'cancelled', updatedAt: new Date().toISOString() } : c,
      ),
      ...commitDeltas(get(), deltas, correction.locationId, correction.locationName),
    })
    return { ok: true }
  },
}))
