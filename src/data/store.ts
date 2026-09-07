import { create } from 'zustand'
import { combinationName } from '@/features/products/model/product'
import type { Product, VariationRow } from '@/features/products/model/product'
import type { Transfer, TransferLine, TransferStatus } from '@/features/transfers/model/transfer'
import type { Sale, SaleLine, SaleStatus } from '@/features/sales/model/sale'
import {
  brands,
  categories,
  clients,
  locations,
  products as seedProducts,
  sales as seedSales,
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
  clients: Client[]
  categories: typeof categories
  brands: typeof brands
  locations: typeof locations

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
  setTransferStatus: (id: string, to: TransferStatus) => { ok: true } | { ok: false; error: string }
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
    categoryName: product.categoryName,
    categoryPath: product.categoryPath,
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
  clients,
  categories,
  brands,
  locations,

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

  setTransferStatus: (id, to) => {
    const transfer = get().transfers.find((t) => t.id === id)
    if (!transfer) return { ok: false, error: 'That transfer no longer exists' }

    /** Moves every line by `delta` at one end of the transfer. */
    const move = (locationId: string, locationName: string, sign: 1 | -1) => {
      const byVariation = new Map<string, number>()
      for (const line of transfer.lines) {
        byVariation.set(line.variationId, (byVariation.get(line.variationId) ?? 0) + line.quantity)
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

    if (to === 'in_transit') {
      if (transfer.status !== 'draft') return { ok: false, error: 'This transfer has already left' }
      // Checked against live stock, not against what was available when the
      // draft was written — a sale may have taken the last one since.
      const short = transfer.lines.find((line) => {
        const row = get().variations.find((v) => v.id === line.variationId)
        return !row || quantityAt(row.stockByLocation, transfer.fromLocationId) < line.quantity
      })
      if (short) {
        return {
          ok: false,
          error: `${transfer.fromLocationName} no longer has ${short.quantity} × ${short.name}`,
        }
      }
      move(transfer.fromLocationId, transfer.fromLocationName, -1)
    }

    if (to === 'received') {
      if (transfer.status !== 'in_transit') {
        return { ok: false, error: 'Only a transfer in transit can be received' }
      }
      move(transfer.toLocationId, transfer.toLocationName, 1)
    }

    if (to === 'cancelled') {
      if (transfer.status === 'received') {
        return { ok: false, error: 'It has already been received — correct it instead' }
      }
      // Goods already on the truck go back where they came from; a draft never
      // moved anything, so there is nothing to undo.
      if (transfer.status === 'in_transit') {
        move(transfer.fromLocationId, transfer.fromLocationName, 1)
      }
    }

    set({
      transfers: get().transfers.map((t) =>
        t.id === id
          ? {
              ...t,
              status: to,
              sentAt: to === 'in_transit' ? now : t.sentAt,
              receivedAt: to === 'received' ? now : t.receivedAt,
              updatedAt: now,
            }
          : t,
      ),
    })
    return { ok: true }
  },
}))
