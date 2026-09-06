import { create } from 'zustand'
import type { Product, VariationRow } from '@/features/products/model/product'
import type { Sale, SaleLine, SaleStatus } from '@/features/sales/model/sale'
import {
  brands,
  categories,
  clients,
  locations,
  products as seedProducts,
  sales as seedSales,
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
  clients: Client[]
  categories: typeof categories
  brands: typeof brands
  locations: typeof locations

  createSale: (input: CreateSaleInput) => Sale
  updateSale: (id: string, patch: { status?: SaleStatus; paid?: number }) => Sale | undefined
  deleteVariation: (id: string) => void
  createProduct: (input: ProductInput) => Product
  updateProduct: (id: string, input: ProductInput) => Product | undefined
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

export type ProductInput = Omit<
  Product,
  'id' | 'categoryName' | 'categoryPath' | 'brandName' | 'createdAt' | 'updatedAt' | 'variations'
> & {
  variations: (Omit<Product['variations'][number], 'id' | 'productId'> & { id?: string })[]
}

/** Keeps the flat sellable list in step with a product's variations. */
function flatten(product: Product): VariationRow[] {
  return product.variations.map((variation) => ({
    ...variation,
    status: product.status === 'archived' ? 'archived' : variation.status,
    productName: product.name,
    fullName: product.variations.length > 1 ? `${product.name} — ${variation.name}` : product.name,
    description: product.description,
    categoryName: product.categoryName,
    categoryPath: product.categoryPath,
    brandName: product.brandName,
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
 * The whole dataset, in memory. Everything the screens show comes from here —
 * there is no backend and no network. Writes replace the relevant array so
 * subscribed components re-render.
 */
export const useDataStore = create<CatalogState>((set, get) => ({
  products: seedProducts,
  variations: seedVariations,
  sales: seedSales,
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
        const paid = patch.paid !== undefined ? Math.min(sale.total, sale.paid + patch.paid) : sale.paid
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
        // Stock arrives through goods receipt, never through the product form.
        stock: 0,
        stockByLocation: [],
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
          stock: previous?.stock ?? 0,
          stockByLocation: previous?.stockByLocation ?? [],
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
}))
