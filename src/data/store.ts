import { create } from 'zustand'
import { combinationName } from '@/features/products/model/product'
import type { Product, VariationRow } from '@/features/products/model/product'
import type { Transfer, TransferLine, TransferStatus } from '@/features/transfers/model/transfer'
import type {
  Correction,
  CorrectionLine,
  CorrectionReason,
} from '@/features/corrections/model/correction'
import type { Stocktake, StocktakeLine } from '@/features/stocktaking/model/stocktake'
import {
  generatePassword,
  type Supplier,
  type SupplierAccess,
} from '@/features/suppliers/model/supplier'
import type { OrderLine, OrderStatus, PurchaseOrder } from '@/features/orders/model/order'
import { outstandingUnits } from '@/features/orders/model/order'
import type { ReorderSchedule } from '@/features/schedules/model/schedule'
import type { Employee, EmployeeStatus } from '@/features/employees/model/employee'
import type { Role } from '@/features/roles/model/role'
import type { Client, ClientStatus } from '@/features/clients/model/client'
import type { Promotion } from '@/features/promotions/model/promotion'
import type { ReportDefinition } from '@/features/reports/model/report'
import type { PrintTemplate } from '@/features/printTemplates/model/template'
import type { Driver, DriverDraft } from '@/features/drivers/model/driver'
import {
  openShiftFor,
  type CashMovement,
  type CashRegister,
  type CashShift,
} from '@/features/cashShifts/model/shift'
import type {
  Brand,
  CategorySettings,
  CompanySettings,
  LocationSettings,
  NotificationChannel,
  NotificationPreferences,
} from '@/features/settings/model/settings'
export type { Client }
import type { ReorderSettings } from '@/features/schedules/model/reorder'
import { buildReorderLines, lineCostUzs, needsOrdering } from '@/features/schedules/model/reorder'
import type { WalletTransaction } from '@/shared/types/wallet'
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
  orders as seedOrders,
  schedules as seedSchedules,
  promotions as seedPromotions,
  reports as seedReports,
  printTemplates as seedPrintTemplates,
  drivers as seedDrivers,
  cashRegisters as seedCashRegisters,
  cashShifts as seedCashShifts,
  companySettings as seedCompany,
  brandSettings as seedBrandSettings,
  locationSettings as seedLocationSettings,
  categorySettings as seedCategorySettings,
  notificationPreferences as seedNotifications,
  employees as seedEmployees,
  roles as seedRoles,
  suppliers as seedSuppliers,
  walletTransactions as seedWalletTransactions,
  transfers as seedTransfers,
  variations as seedVariations,
} from './seed'
import { computeTotals } from '@/features/sales/model/sale'

interface CatalogState {
  products: Product[]
  variations: VariationRow[]
  sales: Sale[]
  transfers: Transfer[]
  corrections: Correction[]
  receipts: GoodsReceipt[]
  stocktakes: Stocktake[]
  repricings: Repricing[]
  suppliers: Supplier[]
  orders: PurchaseOrder[]
  schedules: ReorderSchedule[]
  employees: Employee[]
  roles: Role[]
  /** One ledger for every wallet owner, filtered by owner on read. */
  walletTransactions: WalletTransaction[]
  clients: Client[]
  promotions: Promotion[]
  reports: ReportDefinition[]
  printTemplates: PrintTemplate[]
  drivers: Driver[]
  cashRegisters: CashRegister[]
  cashShifts: CashShift[]
  company: CompanySettings
  brandSettings: Brand[]
  locationSettings: LocationSettings[]
  categorySettings: CategorySettings[]
  notifications: NotificationPreferences
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
  createOrder: (input: CreateOrderInput) => PurchaseOrder
  setOrderStatus: (id: string, to: OrderStatus) => { ok: true } | { ok: false; error: string }
  /**
   * Books a delivery against an order: creates the goods receipt, posts it, and
   * writes the received quantities back onto the order.
   */
  receiveAgainstOrder: (
    id: string,
    quantities: Record<string, number>,
    invoiceNumber: string,
  ) => { ok: true; receiptId: string } | { ok: false; error: string }

  createSchedule: (input: ScheduleInput) => ReorderSchedule
  updateSchedule: (id: string, input: ScheduleInput) => void
  deleteSchedule: (id: string) => void
  /**
   * Does what the schedule exists to do: works out what to reorder and leaves
   * a draft order for a person to check. Never sends anything to a supplier.
   */
  runSchedule: (
    id: string,
    trigger: 'schedule' | 'manual',
  ) => { ok: true; orderId: string | null } | { ok: false; error: string }

  updateCompany: (input: Partial<CompanySettings>) => void

  createBrand: (input: Omit<Brand, 'id'>) => Brand
  updateBrand: (id: string, input: Omit<Brand, 'id'>) => void
  deleteBrand: (id: string) => { ok: true } | { ok: false; error: string }

  createLocation: (input: Omit<LocationSettings, 'id'>) => LocationSettings
  updateLocation: (id: string, input: Omit<LocationSettings, 'id'>) => void
  deleteLocation: (id: string) => { ok: true } | { ok: false; error: string }

  createCategory: (input: Omit<CategorySettings, 'id'>) => CategorySettings
  updateCategory: (id: string, input: Omit<CategorySettings, 'id'>) => void
  deleteCategory: (id: string) => { ok: true } | { ok: false; error: string }

  toggleNotification: (event: string, channel: NotificationChannel) => void

  /**
   * Opens a drawer. Refuses a second one on the same register: two open shifts
   * on one drawer means neither person can be held to its contents.
   */
  openShift: (input: {
    registerId: string
    employeeId: string
    openingFloat: number
  }) => { ok: true; shift: CashShift } | { ok: false; error: string }
  closeShift: (
    id: string,
    countedCash: number,
    closingComment: string | null,
  ) => { ok: true } | { ok: false; error: string }
  addCashMovement: (
    id: string,
    input: { kind: CashMovement['kind']; reason: string; amount: number; comment: string | null },
  ) => { ok: true } | { ok: false; error: string }
  createDriver: (input: DriverDraft) => Driver
  updateDriver: (id: string, input: DriverDraft) => void
  deleteDriver: (id: string) => void

  createCashRegister: (input: Omit<CashRegister, 'id' | 'locationName'>) => CashRegister
  updateCashRegister: (id: string, input: Omit<CashRegister, 'id' | 'locationName'>) => void
  deleteCashRegister: (id: string) => { ok: true } | { ok: false; error: string }

  createPrintTemplate: (input: TemplateInput) => PrintTemplate
  updatePrintTemplate: (id: string, input: TemplateInput) => void
  duplicatePrintTemplate: (id: string) => PrintTemplate | undefined
  deletePrintTemplate: (id: string) => void

  createReport: (input: ReportInput) => ReportDefinition
  updateReport: (id: string, input: ReportInput) => void
  deleteReport: (id: string) => void
  setReportPinned: (id: string, pinned: boolean) => void

  createPromotion: (input: PromotionInput) => Promotion
  updatePromotion: (id: string, input: PromotionInput) => void
  setPromotionPaused: (id: string, paused: boolean) => void
  deletePromotion: (id: string) => void

  createClient: (input: ClientInput) => Client
  updateClient: (id: string, input: ClientInput) => void
  setClientStatus: (id: string, status: ClientStatus) => void

  createRole: (input: RoleInput) => Role
  updateRole: (id: string, input: RoleInput) => void
  setRolePermissions: (id: string, permissions: string[]) => void
  deleteRole: (id: string) => { ok: true } | { ok: false; error: string }

  createEmployee: (input: EmployeeInput) => Employee
  updateEmployee: (id: string, input: EmployeeInput) => void
  setEmployeeStatus: (id: string, status: EmployeeStatus) => void

  createSupplier: (input: SupplierInput) => Supplier
  updateSupplier: (id: string, input: SupplierInput) => Supplier | undefined
  /**
   * Switches portal sign-in on or off without touching the login itself, so
   * turning access back on does not mean issuing a new identity.
   */
  setSupplierAccess: (id: string, access: SupplierAccess) => void
  /**
   * Mints a password, records that one was set, and hands it back — the only
   * moment it exists anywhere. Nothing stores it, so the caller has one chance
   * to put it in front of somebody.
   */
  issueSupplierPassword: (
    id: string,
  ) => { ok: true; password: string } | { ok: false; error: string }
  /** Records money paid to a supplier: reduces the debt, writes the movement. */
  paySupplier: (
    id: string,
    amount: number,
    comment: string,
  ) => { ok: true } | { ok: false; error: string }

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
  /** Set when the delivery was booked against a purchase order. */
  orderId?: string | null
  orderNumber?: string | null
}

export interface CreateOrderInput {
  supplierId: string
  locationId: string
  expectedAt: string | null
  comment: string
  lines: OrderLine[]
  status: Extract<OrderStatus, 'draft' | 'sent'>
}

export type ReportInput = Omit<ReportDefinition, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>
export type TemplateInput = Omit<PrintTemplate, 'id' | 'createdBy' | 'updatedAt'>

export interface PromotionInput {
  name: string
  kind: Promotion['kind']
  value: number
  scope: Promotion['scope']
  scopeIds: string[]
  audience: Promotion['audience']
  clientIds: string[]
  driverIds: string[]
  startsAt: string
  endsAt: string | null
  paused: boolean
  minimumSale: number | null
  comment: string | null
}

export interface ClientInput {
  name: string
  type: Client['type']
  phone: string | null
  email: string | null
  address: string | null
  creditLimit: number | null
  status: ClientStatus
  comment: string | null
}

export interface RoleInput {
  name: string
}

export interface EmployeeInput {
  fullName: string
  phone: string | null
  email: string | null
  roleId: string
  locationId: string | null
  status: EmployeeStatus
  hiredAt: string
  salary: number | null
  comment: string | null
}

export interface ScheduleInput {
  supplierId: string
  locationId: string
  daysOfMonth: number[]
  timeOfDay: string
  settings: ReorderSettings
  active: boolean
}

/*
 * `passwordSetAt` and `lastSignedInAt` are deliberately not part of the form's
 * payload: one is written only by issuing a password, the other only by the
 * supplier actually signing in. Neither is a field anybody should be able to type.
 */
export type SupplierInput = Omit<
  Supplier,
  'id' | 'debt' | 'lastPaymentAt' | 'passwordSetAt' | 'lastSignedInAt' | 'createdAt' | 'updatedAt'
>

export interface CreateRepricingInput {
  rule: Repricing['rule']
  /** Empty means everything. */
  categoryId: string
  brandId: string
  /** Empty means every location; otherwise only what that shelf carries. */
  locationId: string
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
  /** Whether this shelf is pushing stock out or asking another to supply it. */
  kind: Transfer['kind']
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
  /** Set when the seller applied a promotion on the New sale screen. */
  promotionId?: string | null
  /** Who collected the parts, scanned at the counter. */
  driverId?: string | null
  /** The truck the purchase was for — his own, or his autopark's. */
  truckPlate?: string | null
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
/** A promotion stores the names of what it applies to, so a renamed category
 *  or product does not silently change what an old promotion claims to cover. */
function namesOfScope(
  state: {
    categories: readonly { readonly id: string; readonly name: string }[]
    products: readonly { readonly id: string; readonly name: string }[]
  },
  scope: Promotion['scope'],
  scopeIds: string[],
): string[] {
  if (scope === 'all') return []
  const list = scope === 'category' ? state.categories : state.products
  return scopeIds.map((id) => list.find((entry) => entry.id === id)?.name ?? '—')
}

/** Client names for a targeted promotion, snapshotted the same way. */
function namesOfClients(
  state: { clients: readonly { readonly id: string; readonly name: string }[] },
  audience: Promotion['audience'],
  clientIds: string[],
): string[] {
  if (audience !== 'clients') return []
  return clientIds.map((id) => state.clients.find((client) => client.id === id)?.name ?? '—')
}

/** Driver names for a driver-targeted promotion, snapshotted the same way. */
function namesOfDrivers(
  state: { drivers: readonly { readonly id: string; readonly fullName: string }[] },
  audience: Promotion['audience'],
  driverIds: string[],
): string[] {
  if (audience !== 'drivers') return []
  return driverIds.map((id) => state.drivers.find((driver) => driver.id === id)?.fullName ?? '—')
}

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
  promotions: seedPromotions,
  reports: seedReports,
  printTemplates: seedPrintTemplates,
  drivers: seedDrivers,
  cashRegisters: seedCashRegisters,
  cashShifts: seedCashShifts,
  company: seedCompany,
  brandSettings: seedBrandSettings,
  locationSettings: seedLocationSettings,
  categorySettings: seedCategorySettings,
  notifications: seedNotifications,
  categories,
  brands,
  locations,
  suppliers: seedSuppliers,
  orders: seedOrders,
  schedules: seedSchedules,
  employees: seedEmployees,
  roles: seedRoles,
  walletTransactions: seedWalletTransactions,

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
      // No auth in this build: every sale is made by the signed-in user.
      sellerId: 'emp-1',
      sellerName: 'Akhmet Dauletmuratov',
      promotionId: input.promotionId ?? null,
      /*
        The two facts the customer-facing apps read: the driver so his own
        "My orders" can show an offline purchase, and the truck so the
        autopark owner sees an operation on the right vehicle.
      */
      driverId: input.driverId ?? null,
      driverName: get().drivers.find((d) => d.id === input.driverId)?.fullName ?? null,
      truckPlate: input.truckPlate ?? null,
      paymentMethod: input.paymentMethod,
      // Only cash reaches a drawer. The New sale screen refuses a cash sale
      // with no shift open, so this is the record of which one took it.
      shiftId:
        input.paymentMethod === 'cash'
          ? (openShiftFor(get().cashShifts, input.locationId)?.id ?? null)
          : null,
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
      kind: input.kind,
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
    /* Sending goes through the same path as sending later, so the stock
       deduction and its checks exist in exactly one place. A request never
       takes this branch: the requester does not hold the goods, so it has
       nothing to dispatch and the source has not agreed yet. */
    if (input.kind === 'send' && input.status === 'in_transit') {
      get().setTransferStatus(transfer.id, 'in_transit')
    }
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
      orderId: input.orderId ?? null,
      orderNumber: input.orderNumber ?? null,
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
        // Falls back to the invoiced figure only when nobody has counted:
        // a receipt booked in against an order already carries the count.
        receivedQuantity: Math.max(
          0,
          quantities?.[line.id] ?? line.receivedQuantity ?? line.orderedQuantity,
        ),
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

  createOrder: (input) => {
    const sequence = get().orders.length + 1
    const now = new Date().toISOString()
    const supplier = get().suppliers.find((s) => s.id === input.supplierId)

    const order: PurchaseOrder = {
      id: `po-${sequence}`,
      number: `PO-${String(sequence).padStart(5, '0')}`,
      status: input.status,
      supplierId: input.supplierId || null,
      supplierName: supplier?.name ?? null,
      locationId: input.locationId,
      locationName: get().locations.find((l) => l.id === input.locationId)?.name ?? '—',
      expectedAt: input.expectedAt,
      lines: input.lines,
      comment: input.comment || null,
      receiptIds: [],
      createdBy: 'Akhmet Dauletmuratov',
      createdAt: now,
      sentAt: input.status === 'sent' ? now : null,
      closedAt: null,
      updatedAt: now,
    }

    set({ orders: [...get().orders, order] })
    return order
  },

  setOrderStatus: (id, to) => {
    const order = get().orders.find((o) => o.id === id)
    if (!order) return { ok: false, error: 'That order no longer exists' }
    if (order.status === 'received') {
      return { ok: false, error: 'It has already been delivered in full' }
    }
    if (order.status === 'cancelled') return { ok: false, error: 'It has already been cancelled' }
    if (to === 'cancelled' && get().receipts.some((r) => r.orderId === id)) {
      // Part of it is already on a shelf; cancelling would leave stock with no
      // order behind it and an order claiming nothing arrived.
      return {
        ok: false,
        error: 'Part of this order has already been delivered — close it instead of cancelling',
      }
    }

    const now = new Date().toISOString()
    set({
      orders: get().orders.map((o) =>
        o.id === id
          ? {
              ...o,
              status: to,
              sentAt: to === 'sent' ? now : o.sentAt,
              closedAt: to === 'cancelled' || to === 'received' ? now : o.closedAt,
              updatedAt: now,
            }
          : o,
      ),
    })
    return { ok: true }
  },

  receiveAgainstOrder: (id, quantities, invoiceNumber) => {
    const order = get().orders.find((o) => o.id === id)
    if (!order) return { ok: false, error: 'That order no longer exists' }
    if (order.status === 'draft') {
      return { ok: false, error: 'Send the order before booking a delivery against it' }
    }
    if (order.status === 'received' || order.status === 'cancelled') {
      return { ok: false, error: 'This order is closed' }
    }

    /*
      Never more than is still outstanding. A supplier who over-ships has sent
      something that was not ordered, and it should arrive on its own receipt
      rather than quietly inflating this one.
    */
    const arriving = order.lines
      .map((line) => {
        const outstanding = Math.max(0, line.orderedQuantity - line.receivedQuantity)
        return {
          line,
          outstanding,
          quantity: Math.min(Math.max(0, quantities[line.id] ?? 0), outstanding),
        }
      })
      .filter((entry) => entry.quantity > 0)

    if (arriving.length === 0) {
      return { ok: false, error: 'Nothing to receive — every line is zero or already complete' }
    }

    // The delivery is a real goods receipt, posted through the same path as any
    // other, so stock and landed cost behave identically whether or not an
    // order was involved.
    const receipt = get().createReceipt({
      supplierId: order.supplierId,
      invoiceNumber,
      locationId: order.locationId,
      comment: order.comment ?? '',
      orderId: order.id,
      orderNumber: order.number,
      lines: arriving.map(({ line, outstanding, quantity }) => ({
        id: `grl-${order.id}-${line.id}`,
        variationId: line.variationId,
        productId: line.productId,
        sku: line.sku,
        name: line.name,
        imageUrl: line.imageUrl,
        unit: line.unit,
        /*
          The two numbers come from two different places, and conflating them
          was hiding every short delivery: what was still outstanding on the
          order is what the supplier is expected to have sent, and what a
          person counted on the dock is what actually turned up. Writing the
          counted figure into both made "42 invoiced, 40 received" read as
          "40 and 40" — no shortage, no claim, and freight spread over the
          wrong number of units.
        */
        orderedQuantity: outstanding,
        receivedQuantity: quantity,
        unitCost: line.unitCost,
        costCurrency: line.costCurrency,
      })),
      additionalCosts: [],
      status: 'received',
    })

    const received = new Map(arriving.map(({ line, quantity }) => [line.id, quantity]))
    const lines = order.lines.map((line) => ({
      ...line,
      receivedQuantity: line.receivedQuantity + (received.get(line.id) ?? 0),
    }))
    const done = outstandingUnits({ lines }) === 0
    const now = new Date().toISOString()

    set({
      orders: get().orders.map((o) =>
        o.id === id
          ? {
              ...o,
              lines,
              receiptIds: [...o.receiptIds, receipt.id],
              status: done ? 'received' : 'partial',
              closedAt: done ? now : o.closedAt,
              updatedAt: now,
            }
          : o,
      ),
    })
    return { ok: true, receiptId: receipt.id }
  },

  createSchedule: (input) => {
    const now = new Date().toISOString()
    const schedule: ReorderSchedule = {
      id: `sch-${get().schedules.length + 1}-${Date.now()}`,
      supplierId: input.supplierId,
      supplierName: get().suppliers.find((s) => s.id === input.supplierId)?.name ?? '—',
      locationId: input.locationId,
      locationName: get().locations.find((l) => l.id === input.locationId)?.name ?? '—',
      daysOfMonth: [...new Set(input.daysOfMonth)].sort((a, b) => a - b),
      timeOfDay: input.timeOfDay,
      settings: input.settings,
      active: input.active,
      lastRun: null,
      createdBy: 'Akhmet Dauletmuratov',
      createdAt: now,
      updatedAt: now,
    }
    set({ schedules: [...get().schedules, schedule] })
    return schedule
  },

  updateSchedule: (id, input) => {
    set({
      schedules: get().schedules.map((schedule) =>
        schedule.id === id
          ? {
              ...schedule,
              ...input,
              supplierName:
                get().suppliers.find((s) => s.id === input.supplierId)?.name ??
                schedule.supplierName,
              locationName:
                get().locations.find((l) => l.id === input.locationId)?.name ??
                schedule.locationName,
              daysOfMonth: [...new Set(input.daysOfMonth)].sort((a, b) => a - b),
              updatedAt: new Date().toISOString(),
            }
          : schedule,
      ),
    })
  },

  deleteSchedule: (id) => set({ schedules: get().schedules.filter((s) => s.id !== id) }),

  runSchedule: (id, trigger) => {
    const schedule = get().schedules.find((s) => s.id === id)
    if (!schedule) return { ok: false, error: 'That schedule no longer exists' }

    const lines = buildReorderLines(
      { variations: get().variations, sales: get().sales, receipts: get().receipts },
      schedule.settings,
      {
        supplierId: schedule.supplierId,
        locationId: schedule.locationId,
        onlyNeeded: true,
      },
    ).filter(needsOrdering)

    const at = new Date().toISOString()

    // Finding nothing is a real outcome, not a failure: it means the shelves
    // are fine. Recording it stops anyone wondering whether the run happened.
    if (lines.length === 0) {
      const run = { at, orderId: null, orderNumber: null, products: 0, units: 0, value: 0, trigger }
      set({
        schedules: get().schedules.map((s) =>
          s.id === id ? { ...s, lastRun: run, updatedAt: at } : s,
        ),
      })
      return { ok: true, orderId: null }
    }

    /*
      A draft, never a sent order. The schedule does the arithmetic and the
      typing; committing money to a supplier stays a human decision.
    */
    const order = get().createOrder({
      supplierId: schedule.supplierId,
      locationId: schedule.locationId,
      expectedAt: new Date(Date.now() + schedule.settings.leadTimeDays * 86_400_000).toISOString(),
      comment: `Suggested by the ${schedule.supplierName} schedule`,
      status: 'draft',
      lines: lines.map((line, index) => ({
        id: `sol-${id}-${index}`,
        variationId: line.variationId,
        productId: line.productId,
        sku: line.sku,
        name: line.name,
        imageUrl: line.imageUrl,
        unit: line.unit,
        orderedQuantity: line.suggested,
        receivedQuantity: 0,
        unitCost: line.unitCost,
        costCurrency: line.costCurrency,
      })),
    })

    const run: ReorderSchedule['lastRun'] = {
      at,
      orderId: order.id,
      orderNumber: order.number,
      products: lines.length,
      units: lines.reduce((sum, line) => sum + line.suggested, 0),
      value: lines.reduce((sum, line) => sum + lineCostUzs(line, USD_RATE), 0),
      trigger,
    }

    set({
      schedules: get().schedules.map((s) =>
        s.id === id ? { ...s, lastRun: run, updatedAt: at } : s,
      ),
    })
    return { ok: true, orderId: order.id }
  },

  updateCompany: (input) =>
    set({ company: { ...get().company, ...input, updatedAt: new Date().toISOString() } }),

  createBrand: (input) => {
    const brand: Brand = { ...input, id: `brand-${Date.now()}` }
    set({ brandSettings: [...get().brandSettings, brand] })
    return brand
  },
  updateBrand: (id, input) =>
    set({
      brandSettings: get().brandSettings.map((brand) =>
        brand.id === id ? { ...brand, ...input } : brand,
      ),
    }),
  deleteBrand: (id) => {
    // Products snapshot the brand name, but they still point at the id — and a
    // product pointing at a brand that no longer exists is a blank column.
    const used = get().variations.filter((variation) => variation.brandId === id).length
    if (used > 0) {
      return { ok: false, error: `${used} products use this brand — change them first` }
    }
    set({ brandSettings: get().brandSettings.filter((brand) => brand.id !== id) })
    return { ok: true }
  },

  createLocation: (input) => {
    const location: LocationSettings = { ...input, id: `loc-${Date.now()}` }
    set({ locationSettings: [...get().locationSettings, location] })
    return location
  },
  updateLocation: (id, input) =>
    set({
      locationSettings: get().locationSettings.map((location) =>
        location.id === id ? { ...location, ...input } : location,
      ),
    }),
  deleteLocation: (id) => {
    // Stock lives at a location. Deleting one with stock on it would leave
    // parts nowhere, which is worse than an extra row in a list.
    const units = get().variations.reduce(
      (sum, variation) =>
        sum + (variation.stockByLocation.find((row) => row.locationId === id)?.quantity ?? 0),
      0,
    )
    if (units > 0) {
      return { ok: false, error: `${units} units are still stored here — move them first` }
    }
    set({ locationSettings: get().locationSettings.filter((location) => location.id !== id) })
    return { ok: true }
  },

  createCategory: (input) => {
    const category: CategorySettings = { ...input, id: `cat-${Date.now()}` }
    set({ categorySettings: [...get().categorySettings, category] })
    return category
  },
  updateCategory: (id, input) =>
    set({
      categorySettings: get().categorySettings.map((category) =>
        category.id === id ? { ...category, ...input } : category,
      ),
    }),
  deleteCategory: (id) => {
    const used = get().variations.filter((variation) => variation.categoryId === id).length
    if (used > 0) {
      return { ok: false, error: `${used} products are in this category — move them first` }
    }
    const children = get().categorySettings.filter((category) => category.parentId === id).length
    if (children > 0) {
      return { ok: false, error: `It has ${children} sub-categories — remove those first` }
    }
    set({ categorySettings: get().categorySettings.filter((category) => category.id !== id) })
    return { ok: true }
  },

  toggleNotification: (event, channel) => {
    const current = get().notifications[event] ?? []
    const next = current.includes(channel)
      ? current.filter((entry) => entry !== channel)
      : [...current, channel]
    set({ notifications: { ...get().notifications, [event]: next } })
  },

  openShift: ({ registerId, employeeId, openingFloat }) => {
    const register = get().cashRegisters.find((entry) => entry.id === registerId)
    if (!register) return { ok: false, error: 'That register no longer exists' }

    const already = get().cashShifts.find(
      (shift) => shift.status === 'open' && shift.registerId === registerId,
    )
    if (already) {
      return {
        ok: false,
        error: `${already.employeeName} already has ${register.name} open — close ${already.number} first`,
      }
    }

    const employee = get().employees.find((entry) => entry.id === employeeId)
    const sequence = get().cashShifts.length + 1
    const shift: CashShift = {
      id: `shift-${sequence}-${Date.now()}`,
      number: `CS-${String(sequence).padStart(5, '0')}`,
      registerId,
      registerName: register.name,
      locationId: register.locationId,
      locationName: register.locationName,
      employeeId,
      employeeName: employee?.fullName ?? '—',
      status: 'open',
      openedAt: new Date().toISOString(),
      closedAt: null,
      openingFloat,
      movements: [],
      countedCash: null,
      closingComment: null,
    }
    set({ cashShifts: [shift, ...get().cashShifts] })
    return { ok: true, shift }
  },

  closeShift: (id, countedCash, closingComment) => {
    const shift = get().cashShifts.find((entry) => entry.id === id)
    if (!shift) return { ok: false, error: 'That shift no longer exists' }
    if (shift.status === 'closed') return { ok: false, error: 'That shift is already closed' }

    set({
      cashShifts: get().cashShifts.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              status: 'closed' as const,
              closedAt: new Date().toISOString(),
              countedCash,
              closingComment,
            }
          : entry,
      ),
    })
    return { ok: true }
  },

  addCashMovement: (id, input) => {
    const shift = get().cashShifts.find((entry) => entry.id === id)
    if (!shift) return { ok: false, error: 'That shift no longer exists' }
    // A closed shift is a settled record. Letting money into one after the
    // fact would silently change a variance somebody already signed off.
    if (shift.status === 'closed') return { ok: false, error: 'That shift is closed' }

    const movement: CashMovement = {
      id: `mov-${shift.movements.length + 1}-${Date.now()}`,
      ...input,
      at: new Date().toISOString(),
      by: 'Akhmet Dauletmuratov',
    }
    set({
      cashShifts: get().cashShifts.map((entry) =>
        entry.id === id ? { ...entry, movements: [...entry.movements, movement] } : entry,
      ),
    })
    return { ok: true }
  },

  createDriver: (input) => {
    const now = new Date().toISOString()
    const driver: Driver = {
      ...input,
      id: `driver-${get().drivers.length + 1}-${Date.now()}`,
      code: `DRV-${String(get().drivers.length + 1).padStart(5, '0')}`,
      autoparkName: get().clients.find((client) => client.id === input.autoparkId)?.name ?? null,
      createdAt: now,
      updatedAt: now,
    }
    set({ drivers: [...get().drivers, driver] })
    return driver
  },

  updateDriver: (id, input) => {
    set({
      drivers: get().drivers.map((driver) =>
        driver.id === id
          ? {
              ...driver,
              ...input,
              autoparkName:
                get().clients.find((client) => client.id === input.autoparkId)?.name ?? null,
              updatedAt: new Date().toISOString(),
            }
          : driver,
      ),
    })
  },

  deleteDriver: (id) => set({ drivers: get().drivers.filter((driver) => driver.id !== id) }),

  createCashRegister: (input) => {
    const register: CashRegister = {
      ...input,
      id: `reg-${get().cashRegisters.length + 1}-${Date.now()}`,
      locationName: get().locations.find((l) => l.id === input.locationId)?.name ?? '—',
    }
    set({ cashRegisters: [...get().cashRegisters, register] })
    return register
  },

  updateCashRegister: (id, input) => {
    set({
      cashRegisters: get().cashRegisters.map((register) =>
        register.id === id
          ? {
              ...register,
              ...input,
              locationName: get().locations.find((l) => l.id === input.locationId)?.name ?? '—',
            }
          : register,
      ),
    })
  },

  deleteCashRegister: (id) => {
    // Shifts are the audit trail of a drawer; deleting the register they name
    // would orphan them, so a register with history is kept and deactivated.
    const used = get().cashShifts.some((shift) => shift.registerId === id)
    if (used) {
      return { ok: false, error: 'This register has shifts against it — deactivate it instead' }
    }
    set({ cashRegisters: get().cashRegisters.filter((register) => register.id !== id) })
    return { ok: true }
  },

  createPrintTemplate: (input) => {
    const template: PrintTemplate = {
      ...input,
      id: `tpl-${get().printTemplates.length + 1}-${Date.now()}`,
      createdBy: 'Akhmet Dauletmuratov',
      updatedAt: new Date().toISOString(),
    }
    set({ printTemplates: [...get().printTemplates, template] })
    return template
  },

  updatePrintTemplate: (id, input) => {
    set({
      printTemplates: get().printTemplates.map((template) =>
        template.id === id
          ? { ...template, ...input, updatedAt: new Date().toISOString() }
          : template,
      ),
    })
  },

  /**
   * The realistic way a second label gets made: copy the one that works and
   * change the size. Cheaper than starting from an empty sticker.
   */
  duplicatePrintTemplate: (id) => {
    const source = get().printTemplates.find((template) => template.id === id)
    if (!source) return undefined
    const copy: PrintTemplate = {
      ...source,
      id: `tpl-${get().printTemplates.length + 1}-${Date.now()}`,
      name: `${source.name} (copy)`,
      createdBy: 'Akhmet Dauletmuratov',
      updatedAt: new Date().toISOString(),
    }
    set({ printTemplates: [...get().printTemplates, copy] })
    return copy
  },

  deletePrintTemplate: (id) =>
    set({ printTemplates: get().printTemplates.filter((template) => template.id !== id) }),

  createReport: (input) => {
    const now = new Date().toISOString()
    const report: ReportDefinition = {
      ...input,
      id: `rep-${get().reports.length + 1}-${Date.now()}`,
      createdBy: 'Akhmet Dauletmuratov',
      createdAt: now,
      updatedAt: now,
    }
    set({ reports: [...get().reports, report] })
    return report
  },

  updateReport: (id, input) => {
    set({
      reports: get().reports.map((report) =>
        report.id === id ? { ...report, ...input, updatedAt: new Date().toISOString() } : report,
      ),
    })
  },

  deleteReport: (id) => set({ reports: get().reports.filter((report) => report.id !== id) }),

  setReportPinned: (id, pinned) => {
    set({
      reports: get().reports.map((report) =>
        report.id === id ? { ...report, pinned, updatedAt: new Date().toISOString() } : report,
      ),
    })
  },

  createPromotion: (input) => {
    const now = new Date().toISOString()
    const promotion: Promotion = {
      ...input,
      id: `promo-${get().promotions.length + 1}-${Date.now()}`,
      scopeNames: namesOfScope(get(), input.scope, input.scopeIds),
      clientNames: namesOfClients(get(), input.audience, input.clientIds),
      driverNames: namesOfDrivers(get(), input.audience, input.driverIds),
      createdBy: 'Akhmet Dauletmuratov',
      createdAt: now,
      updatedAt: now,
    }
    set({ promotions: [...get().promotions, promotion] })
    return promotion
  },

  updatePromotion: (id, input) => {
    set({
      promotions: get().promotions.map((promotion) =>
        promotion.id === id
          ? {
              ...promotion,
              ...input,
              scopeNames: namesOfScope(get(), input.scope, input.scopeIds),
              clientNames: namesOfClients(get(), input.audience, input.clientIds),
              driverNames: namesOfDrivers(get(), input.audience, input.driverIds),
              updatedAt: new Date().toISOString(),
            }
          : promotion,
      ),
    })
  },

  setPromotionPaused: (id, paused) => {
    set({
      promotions: get().promotions.map((promotion) =>
        promotion.id === id
          ? { ...promotion, paused, updatedAt: new Date().toISOString() }
          : promotion,
      ),
    })
  },

  deletePromotion: (id) =>
    set({ promotions: get().promotions.filter((promotion) => promotion.id !== id) }),

  createClient: (input) => {
    const now = new Date().toISOString()
    const client: Client = {
      ...input,
      id: `cli-${get().clients.length + 1}-${Date.now()}`,
      debt: 0,
      cashback: 0,
      createdAt: now,
      updatedAt: now,
    }
    set({ clients: [...get().clients, client] })
    return client
  },

  updateClient: (id, input) => {
    set({
      clients: get().clients.map((client) =>
        client.id === id ? { ...client, ...input, updatedAt: new Date().toISOString() } : client,
      ),
    })
  },

  setClientStatus: (id, status) => {
    set({
      clients: get().clients.map((client) =>
        client.id === id ? { ...client, status, updatedAt: new Date().toISOString() } : client,
      ),
    })
  },

  createRole: (input) => {
    const now = new Date().toISOString()
    const role: Role = {
      id: `role-${get().roles.length + 1}-${Date.now()}`,
      name: input.name,
      // A new role starts with nothing. Copying an existing one would be a
      // convenience that quietly hands out access nobody chose.
      permissions: [],
      isSystem: false,
      createdAt: now,
      updatedAt: now,
    }
    set({ roles: [...get().roles, role] })
    return role
  },

  updateRole: (id, input) => {
    set({
      roles: get().roles.map((role) =>
        role.id === id ? { ...role, ...input, updatedAt: new Date().toISOString() } : role,
      ),
    })
  },

  setRolePermissions: (id, permissions) => {
    const role = get().roles.find((r) => r.id === id)
    // The system role is the way back in when someone mis-configures the rest.
    if (!role || role.isSystem) return
    set({
      roles: get().roles.map((entry) =>
        entry.id === id ? { ...entry, permissions, updatedAt: new Date().toISOString() } : entry,
      ),
    })
  },

  deleteRole: (id) => {
    const role = get().roles.find((r) => r.id === id)
    if (!role) return { ok: false, error: 'That role no longer exists' }
    if (role.isSystem) return { ok: false, error: 'The Owner role cannot be deleted' }
    // Deleting it would leave people holding a role that does not exist, which
    // in practice means they can reach nothing and nobody knows why.
    const holders = get().employees.filter((e) => e.roleId === id).length
    if (holders > 0) {
      return {
        ok: false,
        error: `${holders} ${holders === 1 ? 'person holds' : 'people hold'} this role — move them first`,
      }
    }
    set({ roles: get().roles.filter((r) => r.id !== id) })
    return { ok: true }
  },

  createEmployee: (input) => {
    const now = new Date().toISOString()
    const employee: Employee = {
      ...input,
      id: `emp-${get().employees.length + 1}-${Date.now()}`,
      avatarUrl: null,
      roleName: get().roles.find((r) => r.id === input.roleId)?.name ?? '—',
      locationName: get().locations.find((l) => l.id === input.locationId)?.name ?? null,
      // Never signed in yet, which is exactly what a brand-new account should
      // say rather than borrowing today's date and looking active.
      lastActiveAt: null,
      createdAt: now,
      updatedAt: now,
    }
    set({ employees: [...get().employees, employee] })
    return employee
  },

  updateEmployee: (id, input) => {
    set({
      employees: get().employees.map((employee) =>
        employee.id === id
          ? {
              ...employee,
              ...input,
              roleName: get().roles.find((r) => r.id === input.roleId)?.name ?? employee.roleName,
              locationName: get().locations.find((l) => l.id === input.locationId)?.name ?? null,
              updatedAt: new Date().toISOString(),
            }
          : employee,
      ),
    })
  },

  setEmployeeStatus: (id, status) => {
    set({
      employees: get().employees.map((employee) =>
        employee.id === id
          ? { ...employee, status, updatedAt: new Date().toISOString() }
          : employee,
      ),
    })
  },

  createSupplier: (input) => {
    const sequence = get().suppliers.length + 1
    const now = new Date().toISOString()
    const supplier: Supplier = {
      ...input,
      id: `sup-${sequence}`,
      debt: 0,
      lastPaymentAt: null,
      // A brand-new supplier has no password yet even when access is granted:
      // the screen issues one straight after, and that is what reveals it.
      passwordSetAt: null,
      lastSignedInAt: null,
      createdAt: now,
      updatedAt: now,
    }
    set({ suppliers: [...get().suppliers, supplier] })
    return supplier
  },

  updateSupplier: (id, input) => {
    const existing = get().suppliers.find((s) => s.id === id)
    if (!existing) return undefined
    const supplier: Supplier = { ...existing, ...input, updatedAt: new Date().toISOString() }
    set({
      suppliers: get().suppliers.map((s) => (s.id === id ? supplier : s)),
      // The name is snapshotted onto receipts, but the list of them is read
      // live, so keeping it in step avoids two spellings of one company.
      receipts: get().receipts.map((receipt) =>
        receipt.supplierId === id ? { ...receipt, supplierName: supplier.name } : receipt,
      ),
    })
    return supplier
  },

  setSupplierAccess: (id, access) => {
    set({
      suppliers: get().suppliers.map((s) =>
        s.id === id ? { ...s, access, updatedAt: new Date().toISOString() } : s,
      ),
    })
  },

  issueSupplierPassword: (id) => {
    const supplier = get().suppliers.find((s) => s.id === id)
    if (!supplier) return { ok: false, error: 'That supplier no longer exists' }
    if (!supplier.username) {
      // Guards the half-filled record: a password with nothing to sign in as
      // would be a credential nobody could use and nobody could revoke.
      return { ok: false, error: `${supplier.name} has no login to set a password for` }
    }

    const password = generatePassword()
    set({
      suppliers: get().suppliers.map((s) =>
        s.id === id
          ? {
              ...s,
              // Issuing a password does not grant access on its own, but it is
              // meaningless while access is off, so `none` becomes granted.
              access: s.access === 'none' ? 'granted' : s.access,
              passwordSetAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }
          : s,
      ),
    })
    return { ok: true, password }
  },

  paySupplier: (id, amount, comment) => {
    const supplier = get().suppliers.find((s) => s.id === id)
    if (!supplier) return { ok: false, error: 'That supplier no longer exists' }
    if (amount <= 0) return { ok: false, error: 'A payment has to be more than nothing' }
    if (amount > supplier.debt) {
      // Overpaying is a real thing, but it makes a credit balance rather than a
      // negative debt, and nothing here models supplier credit yet.
      return {
        ok: false,
        error: `That is more than the ${supplier.name} debt — pay at most the outstanding amount`,
      }
    }

    const now = new Date().toISOString()
    const debt = supplier.debt - amount

    set({
      suppliers: get().suppliers.map((s) =>
        s.id === id ? { ...s, debt, lastPaymentAt: now, updatedAt: now } : s,
      ),
      walletTransactions: [
        ...get().walletTransactions,
        {
          id: `wtx-${get().walletTransactions.length + 1}`,
          ownerId: id,
          ownerType: 'supplier',
          kind: 'debt_repaid',
          // Negative because it moves the balance towards zero — the sign is
          // what makes a ledger readable at a glance.
          amount: -amount,
          balanceAfter: debt,
          comment: comment || null,
          referenceType: null,
          referenceId: null,
          createdAt: now,
          createdBy: { id: 'usr-1', name: 'Akhmet Dauletmuratov' },
        },
      ],
    })
    return { ok: true }
  },

  createRepricing: (input) => {
    const sequence = get().repricings.length + 1
    const now = new Date().toISOString()
    const category = get().categories.find((c) => c.id === input.categoryId)
    const brand = get().brands.find((b) => b.id === input.brandId)
    const location = get().locations.find((l) => l.id === input.locationId)

    const lines: RepricingLine[] = get()
      .variations.filter((variation) => {
        if (variation.status === 'archived') return false
        if (input.categoryId && variation.categoryId !== input.categoryId) return false
        if (input.brandId && variation.brandId !== input.brandId) return false
        // Location narrows to what that shelf carries — the price itself is not
        // per location.
        if (
          input.locationId &&
          !variation.stockByLocation.some((row) => row.locationId === input.locationId)
        ) {
          return false
        }
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
      locationId: input.locationId || null,
      locationName: location?.name ?? null,
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
