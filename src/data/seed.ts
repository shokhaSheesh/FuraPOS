/**
 * Deterministic seed data. Shapes here are the contract the real API must
 * meet — when the backend lands, these files are the spec to hand over.
 */
import type {
  CostCurrency,
  PartSide,
  Product,
  VariationRow,
} from '@/features/products/model/product'
import type { Sale } from '@/features/sales/model/sale'
import type { Transfer } from '@/features/transfers/model/transfer'
import type { Correction, CorrectionReason } from '@/features/corrections/model/correction'
import type { GoodsReceipt } from '@/features/receipts/model/receipt'
import type { Stocktake } from '@/features/stocktaking/model/stocktake'
import type { Repricing, RuleKind } from '@/features/repricing/model/repricing'
import type { Supplier } from '@/features/suppliers/model/supplier'
import type { ReorderSchedule } from '@/features/schedules/model/schedule'
import type { Employee } from '@/features/employees/model/employee'
import type { Role } from '@/features/roles/model/role'
import type { Client, ClientType } from '@/features/clients/model/client'
import type { Promotion } from '@/features/promotions/model/promotion'
import type { ReportDefinition } from '@/features/reports/model/report'
import type { PrintTemplate } from '@/features/printTemplates/model/template'
import type { CashRegister, CashShift } from '@/features/cashShifts/model/shift'
import type { Driver } from '@/features/drivers/model/driver'
import type {
  Brand,
  CategorySettings,
  CompanySettings,
  LocationSettings,
  NotificationPreferences,
} from '@/features/settings/model/settings'

/** `expand('sales.orders', ['view','create'])` → `sales.orders.view`, … */
const expand = (key: string, actions: readonly string[]) =>
  actions.map((action) => `${key}.${action}`)
import type { PurchaseOrder } from '@/features/orders/model/order'
import type { WalletTransaction } from '@/shared/types/wallet'

/** Kept in step with the dashboard's exchange-rate widget. */
export const USD_RATE = 12_225

/** Seeded PRNG so the mock dataset is identical on every reload. */
function makeRandom(seed: number) {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

const random = makeRandom(42)
const pick = <T>(values: readonly T[]): T => values[Math.floor(random() * values.length)]!
const between = (min: number, max: number) => Math.floor(random() * (max - min + 1)) + min

/** Hierarchical, as in the reference data ("Steps & parts > … DAF 105-95"). */
export const categories = [
  { id: 'cat-1', name: 'Engine parts', path: 'Engine > Engine parts' },
  { id: 'cat-2', name: 'Brakes', path: 'Chassis > Brakes' },
  { id: 'cat-3', name: 'Filters', path: 'Engine > Filters' },
  { id: 'cat-4', name: 'Electrics', path: 'Electrics > Electrics' },
  { id: 'cat-5', name: 'Oils & fluids', path: 'Consumables > Oils & fluids' },
  { id: 'cat-6', name: 'Accessories', path: 'Body > Accessories' },
] as const

const vehicleMakes = [
  { make: 'DAF', models: ['XF 105', 'XF 95', 'CF 85'] },
  { make: 'MAN', models: ['TGX', 'TGS'] },
  { make: 'Volvo', models: ['FH12', 'FH16'] },
  { make: 'Scania', models: ['R420', 'R440'] },
  { make: 'Mercedes', models: ['Actros', 'Axor'] },
] as const

export const brands = [
  { id: 'brand-1', name: 'Bosch' },
  { id: 'brand-2', name: 'Denso' },
  { id: 'brand-3', name: 'Mann' },
  { id: 'brand-4', name: 'Castrol' },
] as const

/**
 * Who we buy from. Debt is the number the screen is really about, so it is on
 * the record rather than derived: an invoice can be paid before or after its
 * goods arrive, and the two are not the same ledger.
 */
export const suppliers: Supplier[] = [
  {
    id: 'sup-1',
    name: 'AKCHAEV INC',
    zone: 'Uzbekistan',
    contactName: 'Rustam Akchaev',
    phone: '+998 90 123 45 67',
    email: 'rustam@akchaev.uz',
    address: 'Ташкент, ул. Амира Темура, 14',
    paymentTermDays: 30,
    debt: 1_306_722_438,
    lastPaymentAt: new Date(Date.now() - 52 * 86_400_000).toISOString(),
    // Signs in and uses it: the relationship this feature is built for.
    access: 'granted',
    username: 'akchaev',
    passwordSetAt: new Date(Date.now() - 180 * 86_400_000).toISOString(),
    lastSignedInAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    comment: 'Main importer relationship',
    status: 'active',
    createdAt: new Date(Date.now() - 700 * 86_400_000).toISOString(),
    updatedAt: new Date(Date.now() - 52 * 86_400_000).toISOString(),
  },
  {
    id: 'sup-2',
    name: 'Euro Parts DMCC',
    zone: 'UAE',
    contactName: 'Samir Haddad',
    phone: '+971 50 887 22 10',
    email: 'orders@europarts.ae',
    address: 'Jebel Ali Free Zone, Dubai',
    paymentTermDays: 45,
    debt: 214_500_000,
    lastPaymentAt: new Date(Date.now() - 12 * 86_400_000).toISOString(),
    // Invited and never signed in — the row somebody should chase.
    access: 'granted',
    username: 'euro-parts',
    passwordSetAt: new Date(Date.now() - 9 * 86_400_000).toISOString(),
    lastSignedInAt: null,
    comment: null,
    status: 'active',
    createdAt: new Date(Date.now() - 420 * 86_400_000).toISOString(),
    updatedAt: new Date(Date.now() - 12 * 86_400_000).toISOString(),
  },
  {
    id: 'sup-3',
    name: 'Sampa Otomotiv',
    zone: 'Türkiye',
    contactName: 'Emre Yıldız',
    phone: '+90 532 447 19 03',
    email: 'export@sampa.com.tr',
    address: 'Samsun OSB, Türkiye',
    paymentTermDays: 60,
    debt: 0,
    lastPaymentAt: new Date(Date.now() - 30 * 86_400_000).toISOString(),
    // We buy from them; they have no reason to log in to anything.
    access: 'none',
    username: null,
    passwordSetAt: null,
    lastSignedInAt: null,
    comment: null,
    status: 'active',
    createdAt: new Date(Date.now() - 300 * 86_400_000).toISOString(),
    updatedAt: new Date(Date.now() - 30 * 86_400_000).toISOString(),
  },
  {
    id: 'sup-4',
    name: 'Dinex Group',
    zone: 'Denmark',
    contactName: 'Lars Pedersen',
    phone: null,
    email: 'sales@dinex.dk',
    address: null,
    // Nothing agreed, so nothing can be overdue.
    paymentTermDays: null,
    debt: 0,
    lastPaymentAt: null,
    // The trial ended, so the login was switched off rather than deleted.
    access: 'disabled',
    username: 'dinex',
    passwordSetAt: new Date(Date.now() - 220 * 86_400_000).toISOString(),
    lastSignedInAt: new Date(Date.now() - 140 * 86_400_000).toISOString(),
    comment: 'Trial supplier — one shipment only',
    status: 'active',
    createdAt: new Date(Date.now() - 260 * 86_400_000).toISOString(),
    updatedAt: new Date(Date.now() - 200 * 86_400_000).toISOString(),
  },
]

export const locations = [
  { id: 'loc-1', name: 'Central warehouse' },
  { id: 'loc-2', name: 'Shop — Chilonzor' },
  { id: 'loc-3', name: 'Shop — Yunusobod' },
] as const

const productNouns = [
  'Oil filter',
  'Air filter',
  'Brake pad set',
  'Brake disc',
  'Spark plug',
  'Timing belt',
  'Alternator',
  'Starter motor',
  'Wiper blade',
  'Engine oil 5W-30',
  'Coolant',
  'Battery',
  'Fuel pump',
  'Clutch kit',
  'Shock absorber',
]

/**
 * Products carry what a part *is*; variations carry what is actually sold.
 * Most parts have one variation; side-specific ones (steps, mirrors, wings)
 * have a left and a right, which is exactly the split the reference data shows.
 */
export const products: Product[] = Array.from({ length: 137 }, (_, index) => {
  const category = pick(categories)
  const brand = random() > 0.15 ? pick(brands) : null
  const vehicle = pick(vehicleMakes)
  const createdAt = new Date(Date.now() - between(1, 900) * 86_400_000).toISOString()
  const productId = `prd-${index + 1}`
  const name = `${pick(productNouns)} ${pick(['A', 'B', 'X', 'Pro', 'HD'])}${between(10, 99)}`

  const sided = random() > 0.65
  // A sided part varies along one real axis, so it gets a real option; the
  // variation names are generated from its values, never typed.
  const options = sided
    ? [{ id: `opt-${productId}-side`, name: 'Side', values: ['Left', 'Right'] }]
    : []
  const specs: { name: string; side: PartSide | null }[] = sided
    ? [
        { name: 'Left', side: 'left' },
        { name: 'Right', side: 'right' },
      ]
    : [{ name: 'Standard', side: null }]

  const variations = specs.map((spec, vIndex) => {
    // Suppliers invoice in USD, customers pay in UZS.
    const costCurrency = random() > 0.35 ? 'USD' : 'UZS'
    const costPrice = costCurrency === 'USD' ? between(5, 900) : between(15_000, 900_000)
    const costUzs = costCurrency === 'USD' ? costPrice * USD_RATE : costPrice
    const salePrice = Math.round(costUzs * (1.15 + random() * 0.6))

    const stockByLocation = locations
      .filter(() => random() > 0.35)
      .map((location) => ({
        locationId: location.id,
        locationName: location.name,
        quantity: between(0, 90),
      }))

    return {
      id: `var-${index + 1}-${vIndex + 1}`,
      productId,
      name: spec.name,
      optionValues: options.map((option) => ({ optionId: option.id, value: spec.name })),
      sku: `SKU-${String(index + 1).padStart(5, '0')}${sided ? `-${spec.side === 'left' ? 'L' : 'R'}` : ''}`,
      barcode: random() > 0.3 ? String(4_600_000_000_000 + index * 10 + vIndex) : null,
      partSide: spec.side,
      costPrice,
      costCurrency: costCurrency as CostCurrency,
      salePrice,
      discountPrice: random() > 0.85 ? Math.round(salePrice * 0.9) : null,
      stock: stockByLocation.reduce((sum, row) => sum + row.quantity, 0),
      stockByLocation,
      lowStockThreshold: random() > 0.5 ? between(5, 30) : null,
      shelfAddress:
        random() > 0.4 ? `${pick(['A', 'B', 'C'])}-${between(1, 20)}-${between(1, 9)}` : null,
      moq: random() > 0.7 ? between(2, 12) : null,
      imageUrl: null,
      status: 'active' as const,
    }
  })

  return {
    id: productId,
    name,
    description: random() > 0.4 ? String(between(1_000_000, 9_999_999)) : null,
    categoryId: category.id,
    categoryName: category.name,
    categoryPath: category.path,
    brandId: brand?.id ?? null,
    brandName: brand?.name ?? null,
    manufacturer: random() > 0.3 ? pick(['Space', 'Sampa', 'Febi', 'Dinex']) : null,
    tags: random() > 0.6 ? [pick(['bestseller', 'import', 'oem', 'clearance'])] : [],
    unit: pick(['pcs', 'pcs', 'pcs', 'l', 'kg'] as const),
    vehicleMake: vehicle.make,
    vehicleModels: [...vehicle.models].slice(0, between(1, vehicle.models.length)),
    cargoWeightKg: random() > 0.5 ? between(1, 60) : null,
    cargoSize: random() > 0.5 ? `${between(20, 160)}*${between(20, 90)}*${between(10, 60)}` : null,
    isShippable: random() > 0.15,
    showOnline: random() > 0.35,
    options,
    variations,
    status: random() > 0.92 ? 'archived' : 'active',
    createdAt,
    updatedAt: createdAt,
  } satisfies Product
})

/** The flat, sellable list: what the catalogue shows and what a sale points at. */
export const variations: VariationRow[] = products.flatMap((product) =>
  product.variations.map((variation) => ({
    ...variation,
    // An archived product archives everything under it.
    status: product.status === 'archived' ? ('archived' as const) : variation.status,
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
    options: product.options,
  })),
)

/*
  A real customer base, not a handful of names.

  Eight clients sharing four hundred sales made every RFM score degenerate:
  everybody bought today, so everybody tied on recency and the segments
  collapsed into one. A report about who is drifting away needs customers who
  actually differ — regulars, occasionals, and people who stopped last spring.
*/
const businessNames = [
  'Автосервис "Дилшод"',
  'ООО "Транс Логистик"',
  'ИП "Мотор Плюс"',
  'ООО "Фура Парк"',
  'Автосервис "Профи"',
  'ООО "Шёлковый путь"',
  'ИП "Турбо Сервис"',
  'ООО "Азия Транс"',
  'Автобаза "Восток"',
  'ООО "Каскад Логистик"',
  'ИП "Дизель Мастер"',
  'ООО "Тошкент Карго"',
  'Автосервис "Форсаж"',
  'ООО "Магистраль"',
  'ИП "Ремкомплект"',
  'ООО "Навруз Транс"',
  'Автопарк "Чирчик"',
  'ООО "Самарканд Авто"',
]

const personFirstNames = [
  'Бекзод',
  'Гулнора',
  'Санжар',
  'Азиз',
  'Дилшод',
  'Нодира',
  'Улугбек',
  'Феруза',
  'Жасур',
  'Мадина',
  'Тимур',
  'Зарина',
  'Отабек',
  'Камола',
  'Рустам',
  'Севара',
  'Шухрат',
  'Дилноза',
  'Икром',
  'Малика',
  'Фаррух',
  'Нилуфар',
]

const personLastNames = [
  'Рахимов',
  'Каримова',
  'Умаров',
  'Тошматов',
  'Юсупов',
  'Ахмедова',
  'Назаров',
  'Сафарова',
  'Исмоилов',
  'Хасанова',
  'Мирзаев',
  'Абдуллаева',
]

const clientNames = [
  ...businessNames,
  ...personFirstNames.map(
    (first, index) => `${first} ${personLastNames[index % personLastNames.length]}`,
  ),
]

/**
 * Clients.
 *
 * The businesses buy on account and the individuals do not, which is the split
 * the screen exists to make legible — and one of them is deliberately over
 * their limit, because that is the row a credit ledger is opened to find.
 */
export const clients: Client[] = clientNames.map((name, index) => {
  const type: ClientType = businessNames.includes(name) ? 'business' : 'person'
  // Only accounts have a limit; a walk-in pays up front.
  const creditLimit = type === 'business' ? between(3, 20) * 1_000_000 : null
  const overLimit = index === 1
  const debt =
    creditLimit === null
      ? random() > 0.85
        ? between(100_000, 900_000)
        : 0
      : overLimit
        ? creditLimit + between(1_000_000, 4_000_000)
        : random() > 0.4
          ? between(0, creditLimit)
          : 0
  const createdAt = new Date(Date.now() - between(60, 900) * 86_400_000).toISOString()

  return {
    id: `cli-${index + 1}`,
    name,
    type,
    phone: `+998 9${between(0, 9)} ${between(100, 999)} ${between(10, 99)} ${between(10, 99)}`,
    email:
      type === 'business'
        ? `info@${['translog', 'motorplus', 'furapark', 'dilshod'][index % 4]}.uz`
        : null,
    address:
      type === 'business'
        ? `Ташкент, ул. ${pick(['Амира Темура', 'Бунёдкор', 'Навои', 'Чилонзор'])}, ${between(1, 90)}`
        : null,
    debt,
    creditLimit,
    cashback: random() > 0.5 ? between(0, 600) * 1000 : 0,
    status: index === 6 ? 'blocked' : 'active',
    comment: null,
    createdAt,
    updatedAt: new Date().toISOString(),
  } satisfies Client
})

/** Sales accumulate at runtime as the New sale screen posts them. */
/*
  Enough sales, over enough time, that demand is a real signal.

  Eighteen sales across 185 variations meant almost nothing had a sales rate,
  which made the reorder screen — the one screen in the app that forecasts
  rather than records — say "nothing needs ordering" about a catalogue that
  plainly does. Seed data has to exercise the features it is seeding for.
*/
/**
 * Roles.
 *
 * Four real jobs plus Owner, and each one is a different *shape* of access
 * rather than a different amount of it — which is the case the editor has to
 * handle. The accountant sees every figure and touches no stock; the
 * storekeeper moves stock all day and cannot see a price. A single "level"
 * slider could express neither.
 */
const roleSpecs: { id: string; name: string; keys: string[] }[] = [
  {
    id: 'role-1',
    name: 'Owner',
    keys: ['*'],
  },
  {
    id: 'role-2',
    name: 'Manager',
    keys: [
      ...expand('dashboard', ['view']),
      ...expand('sales.orders', ['view', 'create', 'edit', 'delete', 'export']),
      ...expand('products.list', ['view', 'create', 'edit', 'export']),
      ...expand('products.transfers', ['view', 'create', 'edit']),
      ...expand('products.corrections', ['view', 'create']),
      ...expand('products.stocktaking', ['view', 'create', 'edit']),
      ...expand('products.goodsReceipt', ['view', 'create', 'edit']),
      ...expand('products.repricing', ['view', 'create', 'edit']),
      ...expand('products.suppliers', ['view', 'create', 'edit']),
      ...expand('products.supplierPortal', ['view', 'edit']),
      ...expand('products.cost', ['view']),
      ...expand('procurement.orders', ['view', 'create', 'edit', 'export']),
      ...expand('procurement.schedules', ['view', 'create', 'edit']),
      ...expand('personnel.employees', ['view']),
      ...expand('marketing.clients', ['view', 'create', 'edit', 'export']),
      ...expand('analytics.reportBuilder', ['view', 'create', 'edit', 'export']),
      ...expand('analytics.customers', ['view', 'export']),
    ],
  },
  {
    id: 'role-3',
    name: 'Seller',
    keys: [
      // Deliberately no `products.cost`: a seller who can see the cost price
      // can work out how far they are allowed to discount.
      ...expand('sales.orders', ['view', 'create', 'edit']),
      ...expand('products.list', ['view']),
      ...expand('marketing.clients', ['view', 'create', 'edit']),
    ],
  },
  {
    id: 'role-4',
    name: 'Storekeeper',
    keys: [
      ...expand('products.list', ['view']),
      ...expand('products.transfers', ['view', 'create', 'edit']),
      ...expand('products.corrections', ['view', 'create']),
      ...expand('products.stocktaking', ['view', 'create', 'edit']),
      ...expand('products.goodsReceipt', ['view', 'create', 'edit']),
      ...expand('procurement.orders', ['view']),
    ],
  },
  {
    id: 'role-5',
    name: 'Accountant',
    keys: [
      ...expand('dashboard', ['view']),
      ...expand('sales.orders', ['view', 'export']),
      ...expand('products.cost', ['view']),
      ...expand('products.suppliers', ['view']),
      ...expand('personnel.salary', ['view']),
      ...expand('analytics.reportBuilder', ['view', 'create', 'edit', 'export']),
    ],
  },
]

export const roles: Role[] = roleSpecs.map((spec) => ({
  id: spec.id,
  name: spec.name,
  permissions: spec.keys,
  isSystem: spec.id === 'role-1',
  createdAt: new Date(Date.now() - 400 * 86_400_000).toISOString(),
  updatedAt: new Date(Date.now() - between(5, 90) * 86_400_000).toISOString(),
}))

/**
 * Staff.
 *
 * The first three are the names the seeded sales were already attributed to, so
 * their performance figures are real rather than decorative. The rest give the
 * list something to be: a suspended account, someone who has left, and two
 * whose logins have gone quiet — which is the case the "Last active" column
 * exists to catch.
 */
export const employees: Employee[] = (
  [
    ['Akhmet Dauletmuratov', 'role-1', 'loc-1', 'active', 0, 14_000_000],
    ['Mansurbek Akchaev', 'role-3', 'loc-2', 'active', 1, 5_500_000],
    ['Dilshod Yusupov', 'role-3', 'loc-3', 'active', 2, 5_500_000],
    ['Nodira Rasulova', 'role-2', 'loc-2', 'active', 3, 9_000_000],
    ['Sardor Tashmatov', 'role-4', 'loc-1', 'active', 41, 6_200_000],
    ['Gulnora Kamilova', 'role-5', null, 'active', 63, 8_400_000],
    ['Jasur Ibragimov', 'role-3', 'loc-3', 'suspended', 22, 5_500_000],
    ['Aziza Yuldasheva', 'role-3', 'loc-2', 'active', 2, 5_500_000],
    ['Bekzod Normatov', 'role-4', 'loc-1', 'archived', 210, null],
  ] as const
).map(([fullName, roleId, locationId, status, quietDays, salary], index) => {
  const location = locations.find((l) => l.id === locationId) ?? null
  const hiredAt = new Date(Date.now() - between(120, 1800) * 86_400_000).toISOString()
  return {
    id: `emp-${index + 1}`,
    fullName,
    phone: `+998 9${between(0, 9)} ${between(100, 999)}-${between(10, 99)}-${between(10, 99)}`,
    email: `${fullName.split(' ')[0]!.toLowerCase()}@fura.uz`,
    avatarUrl: null,
    roleId,
    roleName: roles.find((r) => r.id === roleId)!.name,
    locationId: location?.id ?? null,
    locationName: location?.name ?? null,
    status,
    hiredAt,
    lastActiveAt:
      status === 'archived'
        ? new Date(Date.now() - quietDays * 86_400_000).toISOString()
        : new Date(Date.now() - quietDays * 86_400_000 - between(0, 10) * 3_600_000).toISOString(),
    salary,
    comment: null,
    createdAt: hiredAt,
    updatedAt: new Date().toISOString(),
  } satisfies Employee
})

/** Whoever can actually take a sale, for attributing the seeded ones. */
const sellers = employees.filter((e) => e.status !== 'archived' && e.roleId !== 'role-5')

/**
 * Promotions.
 *
 * One running everywhere, one scoped to a category with a minimum basket, one
 * scheduled for next month and one that has already finished — because the
 * status is derived from the dates, and all four cases have to be visible for
 * that to be worth anything.
 */
export const promotions: Promotion[] = [
  {
    id: 'promo-1',
    name: 'Autumn service check',
    kind: 'percentage',
    value: 10,
    scope: 'all',
    scopeIds: [],
    scopeNames: [],
    audience: 'everyone',
    clientIds: [],
    clientNames: [],
    driverIds: [],
    driverNames: [],
    startsAt: new Date(Date.now() - 12 * 86_400_000).toISOString(),
    endsAt: new Date(Date.now() + 9 * 86_400_000).toISOString(),
    paused: false,
    minimumSale: null,
    comment: 'Runs alongside the workshop campaign',
    createdBy: 'Akhmet Dauletmuratov',
    createdAt: new Date(Date.now() - 20 * 86_400_000).toISOString(),
    updatedAt: new Date(Date.now() - 12 * 86_400_000).toISOString(),
  },
  {
    id: 'promo-2',
    name: 'Brakes bundle',
    kind: 'percentage',
    value: 15,
    audience: 'everyone',
    clientIds: [],
    clientNames: [],
    driverIds: [],
    driverNames: [],
    scope: 'category',
    scopeIds: [categories[1]!.id, categories[3]!.id],
    scopeNames: [categories[1]!.name, categories[3]!.name],
    startsAt: new Date(Date.now() - 4 * 86_400_000).toISOString(),
    endsAt: new Date(Date.now() + 25 * 86_400_000).toISOString(),
    paused: false,
    minimumSale: 2_000_000,
    comment: null,
    createdBy: 'Nodira Rasulova',
    createdAt: new Date(Date.now() - 6 * 86_400_000).toISOString(),
    updatedAt: new Date(Date.now() - 4 * 86_400_000).toISOString(),
  },
  {
    id: 'promo-3',
    name: 'Winter opening',
    kind: 'fixed',
    value: 200_000,
    audience: 'everyone',
    clientIds: [],
    clientNames: [],
    driverIds: [],
    driverNames: [],
    scope: 'product',
    scopeIds: [products[0]!.id, products[1]!.id, products[2]!.id],
    scopeNames: [products[0]!.name, products[1]!.name, products[2]!.name],
    startsAt: new Date(Date.now() + 21 * 86_400_000).toISOString(),
    endsAt: new Date(Date.now() + 51 * 86_400_000).toISOString(),
    paused: false,
    minimumSale: 1_500_000,
    comment: 'Agreed with the supplier',
    createdBy: 'Akhmet Dauletmuratov',
    createdAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
  },
  {
    id: 'promo-4',
    name: 'Summer clearance',
    kind: 'percentage',
    value: 20,
    scope: 'all',
    scopeIds: [],
    scopeNames: [],
    audience: 'everyone',
    clientIds: [],
    clientNames: [],
    driverIds: [],
    driverNames: [],
    startsAt: new Date(Date.now() - 90 * 86_400_000).toISOString(),
    endsAt: new Date(Date.now() - 40 * 86_400_000).toISOString(),
    paused: false,
    minimumSale: null,
    comment: null,
    createdBy: 'Nodira Rasulova',
    createdAt: new Date(Date.now() - 100 * 86_400_000).toISOString(),
    updatedAt: new Date(Date.now() - 40 * 86_400_000).toISOString(),
  },
]

/**
 * How each client actually behaves, so the customer report has something to
 * report. Without this every client bought the same number of times on the
 * same days, RFM scores all tied, and the segments collapsed into one.
 *
 *   `weight`  — how often they turn up. A few regulars, a long tail of
 *               occasionals, which is what a real ledger looks like.
 *   `stopped` — how many days ago they last bought anything. Non-zero for
 *               roughly a quarter of them, so "at risk" and "lost" are real
 *               people rather than empty segments.
 */
const clientProfiles = clients.map((client, index) => ({
  id: client.id,
  weight: index < 6 ? 12 : index < 16 ? 4 : 1,
  /*
    When they last bought anything, in days ago. Zero means still buying.

    The cutoff has to sit *inside* the seeded ledger — sales only go back 120
    days, so a client who "stopped 300 days ago" never bought at all and
    arrives as "lost" with no history instead of "at risk" with a reason to
    ring them. Two of the regulars are deliberately among the lapsed, so the
    two segments that matter most have real people in them.
  */
  stoppedDaysAgo:
    index === 1 || index === 4 ? between(100, 150) : random() > 0.82 ? between(95, 200) : 0,
}))

/** A client who was still buying on that day, or nobody — a walk-in. */
function pickClientFor(daysAgo: number) {
  const eligible = clientProfiles.filter(
    (entry) => entry.stoppedDaysAgo === 0 || daysAgo >= entry.stoppedDaysAgo,
  )
  if (eligible.length === 0) return null
  let ticket = random() * eligible.reduce((sum, entry) => sum + entry.weight, 0)
  for (const entry of eligible) {
    ticket -= entry.weight
    if (ticket <= 0) return clients.find((c) => c.id === entry.id) ?? null
  }
  return null
}

/**
 * Which promotion was running on a given day, if any.
 *
 * Seeded sales carry the promotion that applied to them, exactly as a sale
 * typed on the New sale screen does. Without that link a discount is an
 * anonymous number and the promotions report can never say whether a campaign
 * paid for itself.
 */
function promotionOn(daysAgo: number) {
  const at = Date.now() - daysAgo * 86_400_000
  // Every promotion running that day, then one at random — `find` would always
  // return the first and the second would never be used by anybody.
  const running = promotions.filter((promotion) => {
    if (promotion.paused) return false
    if (new Date(promotion.startsAt).getTime() > at) return false
    if (promotion.endsAt && new Date(promotion.endsAt).getTime() < at) return false
    return true
  })
  return running.length === 0 ? null : pick(running)
}

/** Whether that promotion's scope reaches this variation. */
function promotionCovers(promotion: Promotion, variation: (typeof variations)[number]) {
  if (promotion.scope === 'all') return true
  if (promotion.scopeIds.length === 0) return false
  return promotion.scope === 'category'
    ? promotion.scopeIds.includes(variation.categoryId)
    : promotion.scopeIds.includes(variation.productId)
}

export const sales: Sale[] = Array.from({ length: 420 }, (_, index) => {
  const location = pick(locations)
  /*
    Spread over ten months, biased hard towards recent days.

    Four months was too short once the customer report arrived: a client who
    goes quiet has to have *established* a pattern before stopping, and with a
    90-day "gone quiet" threshold there was no room left to build one. The bias
    keeps the recent density a reorder calculation needs.
  */
  const daysAgo = Math.round(between(0, 300) * (random() > 0.45 ? 0.35 : 1))
  const client = random() > 0.3 ? pickClientFor(daysAgo) : null
  /*
    Not every sale in a promotion's window used it — a seller has to apply it,
    and some do not. Two thirds is deliberately short of all of them, so
    "how many sales used this" is a real number rather than a restatement of
    how many sales happened.
  */
  const promotion = random() > 0.34 ? promotionOn(daysAgo) : null
  const lineCount = between(1, 5)
  /*
    Only what that shop actually stocks. Selling a part from a shelf it was
    never on leaves the product log unable to work out a running balance, and
    the log is right to refuse — it is the seed that was wrong.
  */
  const sellable = variations.filter((variation) =>
    variation.stockByLocation.some((row) => row.locationId === location.id),
  )
  const lines = Array.from({ length: lineCount }, (__, lineIndex) => {
    /*
      Real demand is not uniform: a minority of parts are most of the movement.
      Biasing two thirds of lines into the first quarter of the catalogue gives
      the long tail a warehouse actually has, so "not selling" means something
      and the reorder list is not simply every product at once.
    */
    const variation =
      random() > 0.34
        ? sellable[Math.floor(random() * Math.ceil(sellable.length / 4))]!
        : pick(sellable)
    const quantity = between(1, 8)
    return {
      id: `line-${index}-${lineIndex}`,
      variationId: variation.id,
      productId: variation.productId,
      sku: variation.sku,
      name: variation.fullName,
      brandName: variation.brandName,
      categoryName: variation.categoryName,
      imageUrl: variation.imageUrl,
      unit: variation.unit,
      quantity,
      unitPrice: variation.salePrice,
      // A covered line takes the promotion's rate; anything else keeps the
      // ordinary ad-hoc discount a seller might give.
      discountPercent:
        promotion && promotion.kind === 'percentage' && promotionCovers(promotion, variation)
          ? promotion.value
          : random() > 0.75
            ? between(1, 10)
            : 0,
    }
  })

  const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0)
  const discount = lines.reduce(
    (sum, line) => sum + (line.quantity * line.unitPrice * line.discountPercent) / 100,
    0,
  )
  const total = Math.round(subtotal - discount)
  const status = pick([
    'completed',
    'completed',
    'completed',
    'open',
    'new',
    'processed',
    'delivering',
    'delivered',
    'postponed',
  ] as const)
  const settled = status === 'completed' || status === 'delivered'
  const paid = settled ? total : random() > 0.6 ? Math.round(total / 2) : 0
  const needsDelivery = status === 'delivering' || status === 'delivered'
  const deliveryCost = needsDelivery ? between(20_000, 90_000) : 0
  const createdAt = new Date(
    Date.now() -
      daysAgo * 86_400_000 -
      // Spread across the trading day too. Offsetting only by whole days gave
      // every sale the same clock time, which reads as broken on any screen
      // that shows one — the product log especially.
      between(0, 10 * 3600) * 1000,
  )

  const seller = pick(sellers)

  return {
    id: `sale-${index + 1}`,
    number: `S-${String(index + 1).padStart(5, '0')}`,
    status: status as Sale['status'],
    clientId: client?.id ?? null,
    clientName: client?.name ?? null,
    locationId: location.id,
    locationName: location.name,
    sellerId: seller.id,
    sellerName: seller.fullName,
    promotionId: promotion?.id ?? null,
    // Filled in by the pass below, once the drivers exist.
    driverId: null,
    driverName: null,
    truckPlate: null,
    // Filled in below, once the shifts exist: a sale knows which drawer it
    // went into, and only cash sales ever do.
    shiftId: null,
    paymentMethod: pick(['cash', 'card', 'transfer', 'credit'] as const),
    channel: pick(['desk', 'desk', 'phone', 'online'] as const),
    comment: null,
    lines,
    delivery: needsDelivery
      ? {
          address: `Ташкент, ул. ${pick(['Амира Темура', 'Бунёдкор', 'Навои', 'Чилонзор'])}, ${between(1, 90)}`,
          cost: deliveryCost,
          scheduledFor: new Date(createdAt.getTime() + 86_400_000).toISOString().slice(0, 10),
          courier: pick(['Sardor', 'Jasur', 'Otabek']),
        }
      : null,
    subtotal,
    discount,
    deliveryCost,
    total: total + deliveryCost,
    paid,
    debt: Math.max(0, total + deliveryCost - paid),
    expiresAt:
      status === 'postponed' ? new Date(createdAt.getTime() + 3 * 86_400_000).toISOString() : null,
    createdAt: createdAt.toISOString(),
    updatedAt: createdAt.toISOString(),
    finishedAt: settled ? createdAt.toISOString() : null,
  }
})

/**
 * Transfers between the warehouse and the two shops.
 *
 * Their stock effects are already baked into the variation quantities above —
 * a received transfer is history, and an in-transit one has left its source but
 * not yet landed. Replaying them at boot would double-count.
 */
export const transfers: Transfer[] = Array.from({ length: 14 }, (_, index) => {
  const sequence = index + 1
  const status = pick([
    'draft',
    'in_transit',
    'in_transit',
    'received',
    'received',
    'received',
    'cancelled',
  ] as const)

  // Stock moves out of the warehouse far more often than back into it.
  const from = random() > 0.25 ? locations[0]! : pick(locations)
  const to = pick(locations.filter((location) => location.id !== from.id))

  const createdAt = new Date(Date.now() - between(1, 60) * 86_400_000)
  // Only parts the source actually carries, so a seeded draft is sendable and
  // the "At source" column is not a wall of zeroes.
  const stockedHere = variations.filter((variation) =>
    variation.stockByLocation.some((row) => row.locationId === from.id && row.quantity > 0),
  )

  const lines = Array.from({ length: between(1, 5) }, (_, lineIndex) => {
    const variation = pick(stockedHere.length ? stockedHere : variations)
    const here = variation.stockByLocation.find((row) => row.locationId === from.id)?.quantity ?? 1
    const requested = between(1, Math.max(1, Math.min(12, here)))
    // The warehouse usually finds everything, occasionally not; and most of
    // what ships arrives, but not always — which is the point of tracking all
    // three separately.
    const sent = status === 'draft' ? null : random() > 0.85 ? between(1, requested) : requested
    const received =
      status === 'received'
        ? random() > 0.9
          ? Math.max(0, (sent ?? 0) - between(1, 2))
          : sent
        : null

    return {
      id: `trl-${sequence}-${lineIndex + 1}`,
      variationId: variation.id,
      productId: variation.productId,
      sku: variation.sku,
      name: variation.fullName,
      imageUrl: variation.imageUrl,
      unit: variation.unit,
      requestedQuantity: requested,
      sentQuantity: sent,
      receivedQuantity: received,
      unitCost: variation.costPrice,
      costCurrency: variation.costCurrency,
      unitPrice: variation.salePrice,
    }
  })

  const sentAt = status === 'draft' ? null : new Date(createdAt.getTime() + 3_600_000).toISOString()
  const receivedAt =
    status === 'received' ? new Date(createdAt.getTime() + 2 * 86_400_000).toISOString() : null

  return {
    id: `tr-${sequence}`,
    number: `TR-${String(sequence).padStart(5, '0')}`,
    kind: 'send' as const,
    status,
    fromLocationId: from.id,
    fromLocationName: from.name,
    toLocationId: to.id,
    toLocationName: to.name,
    lines,
    comment:
      random() > 0.7 ? pick(['Weekly top-up', 'Shop request', 'Rebalancing slow movers']) : null,
    createdBy: pick(['Akhmet Dauletmuratov', 'Mansurbek', 'Dilnoza']),
    sentBy: status === 'draft' ? null : pick(['Mansurbek', 'Dilnoza', 'Sardor']),
    receivedBy: status === 'received' ? pick(['Jasur', 'Otabek', 'Dilnoza']) : null,
    createdAt: createdAt.toISOString(),
    sentAt,
    receivedAt,
    updatedAt: receivedAt ?? sentAt ?? createdAt.toISOString(),
  } satisfies Transfer
})

/**
 * Stock adjustments. Their effect is already baked into the variation
 * quantities above, exactly as transfers are — replaying them at boot would
 * double-count.
 *
 * Weighted towards write-offs because that is what really happens: things get
 * dropped and go missing far more often than they turn up.
 */
export const corrections: Correction[] = Array.from({ length: 11 }, (_, index) => {
  const sequence = index + 1
  const location = pick(locations)
  const reason = pick([
    'damaged',
    'damaged',
    'miscount',
    'miscount',
    'theft',
    'expired',
    'lost',
    'found',
  ] as const) satisfies CorrectionReason

  const createdAt = new Date(Date.now() - between(1, 75) * 86_400_000)
  const stockedHere = variations.filter((variation) =>
    variation.stockByLocation.some((row) => row.locationId === location.id && row.quantity > 2),
  )

  const lines = Array.from({ length: between(1, 3) }, (_, lineIndex) => {
    const variation = pick(stockedHere.length ? stockedHere : variations)
    const before =
      variation.stockByLocation.find((row) => row.locationId === location.id)?.quantity ?? 5
    // "Found" adds; everything else takes away.
    const change =
      reason === 'found' ? between(1, 4) : -between(1, Math.max(1, Math.min(4, before)))

    return {
      id: `corl-${sequence}-${lineIndex + 1}`,
      variationId: variation.id,
      productId: variation.productId,
      sku: variation.sku,
      name: variation.fullName,
      imageUrl: variation.imageUrl,
      unit: variation.unit,
      countedBefore: before,
      countedAfter: Math.max(0, before + change),
      unitCost: variation.costPrice,
      costCurrency: variation.costCurrency,
    }
  })

  return {
    id: `cor-${sequence}`,
    number: `CR-${String(sequence).padStart(5, '0')}`,
    status: random() > 0.92 ? ('cancelled' as const) : ('applied' as const),
    locationId: location.id,
    locationName: location.name,
    reason,
    lines,
    source: 'manual' as const,
    sourceRef: null,
    comment:
      random() > 0.6
        ? pick(['Dropped during unloading', 'Found behind the rack', 'Recount after stocktake'])
        : null,
    createdBy: pick(['Akhmet Dauletmuratov', 'Mansurbek', 'Dilnoza']),
    createdAt: createdAt.toISOString(),
    updatedAt: createdAt.toISOString(),
  } satisfies Correction
})

/**
 * Goods arriving from suppliers. As with transfers and corrections, their
 * effect is already baked into the variation quantities above — replaying them
 * at boot would double-count.
 *
 * Extra costs are on most of them, because for an importer freight and duty are
 * the normal case rather than the exception.
 */
export const receipts: GoodsReceipt[] = Array.from({ length: 46 }, (_, index) => {
  const sequence = index + 1
  const status = pick(['draft', 'received', 'received', 'received', 'cancelled'] as const)
  const supplier = pick(suppliers)
  // Imports land at the warehouse; the shops are supplied by transfer.
  const location = random() > 0.2 ? locations[0]! : pick(locations)
  const createdAt = new Date(Date.now() - between(2, 120) * 86_400_000)

  /*
    A supplier only "supplies" what it has actually delivered, since that link
    is inferred from receipts rather than declared. With too few deliveries a
    supplier-scoped reorder run covers a handful of products and looks broken,
    so the seed has to give every supplier real coverage of the catalogue.
  */
  const lines = Array.from({ length: between(4, 12) }, (_, lineIndex) => {
    const variation = pick(variations)
    const ordered = between(5, 60)
    return {
      id: `grl-${sequence}-${lineIndex + 1}`,
      variationId: variation.id,
      productId: variation.productId,
      sku: variation.sku,
      name: variation.fullName,
      imageUrl: variation.imageUrl,
      unit: variation.unit,
      orderedQuantity: ordered,
      // A short delivery is a claim against the supplier, and happens.
      receivedQuantity:
        status === 'draft'
          ? null
          : random() > 0.88
            ? Math.max(1, ordered - between(1, 5))
            : ordered,
      unitCost: variation.costPrice,
      costCurrency: variation.costCurrency,
    }
  })

  const additionalCosts =
    random() > 0.25
      ? [
          {
            id: `grc-${sequence}-1`,
            label: 'Freight',
            amount: between(400, 3_500),
            currency: 'USD' as const,
          },
          ...(random() > 0.4
            ? [
                {
                  id: `grc-${sequence}-2`,
                  label: 'Customs duty',
                  amount: between(2_000_000, 18_000_000),
                  currency: 'UZS' as const,
                },
              ]
            : []),
        ]
      : []

  const receivedAt =
    status === 'received' ? new Date(createdAt.getTime() + 86_400_000).toISOString() : null

  return {
    id: `gr-${sequence}`,
    number: `GR-${String(sequence).padStart(5, '0')}`,
    status,
    supplierId: supplier.id,
    supplierName: supplier.name,
    orderId: null,
    orderNumber: null,
    invoiceNumber: random() > 0.2 ? `INV-${between(10_000, 99_999)}` : null,
    locationId: location.id,
    locationName: location.name,
    lines,
    additionalCosts,
    comment: random() > 0.75 ? pick(['Part of container 3', 'Air freight — urgent']) : null,
    createdBy: pick(['Akhmet Dauletmuratov', 'Mansurbek']),
    receivedBy: status === 'received' ? pick(['Dilnoza', 'Sardor']) : null,
    createdAt: createdAt.toISOString(),
    receivedAt,
    updatedAt: receivedAt ?? createdAt.toISOString(),
  } satisfies GoodsReceipt
})

/**
 * Counts. Their variances are already reflected in the quantities above, as
 * with every other document here — replaying them at boot would double-count.
 *
 * One is left mid-count so the counting sheet has something real to show; most
 * lines in it match, because a warehouse where most lines disagree has a bigger
 * problem than its paperwork.
 */
export const stocktakes: Stocktake[] = Array.from({ length: 6 }, (_, index) => {
  const sequence = index + 1
  const status = pick(['counting', 'applied', 'applied', 'applied', 'cancelled'] as const)
  const location = pick(locations)
  const category = random() > 0.55 ? pick(categories) : null
  const brand = random() > 0.8 ? pick(brands) : null
  const createdAt = new Date(Date.now() - between(3, 90) * 86_400_000)

  const scope = variations.filter(
    (variation) =>
      variation.stockByLocation.some((row) => row.locationId === location.id) &&
      (!category || variation.categoryId === category.id) &&
      (!brand || variation.brandId === brand.id),
  )

  const lines = scope.slice(0, between(8, 24)).map((variation, lineIndex) => {
    const expected = variation.stockByLocation.find((r) => r.locationId === location.id)!.quantity
    // Most counts agree. An unfinished stocktake leaves a tail uncounted, which
    // is the state the sheet exists to make visible.
    const counted =
      status === 'counting' && lineIndex > 5
        ? null
        : random() > 0.82
          ? Math.max(0, expected - between(1, 3))
          : expected

    return {
      id: `stl-${sequence}-${lineIndex + 1}`,
      variationId: variation.id,
      productId: variation.productId,
      sku: variation.sku,
      name: variation.fullName,
      imageUrl: variation.imageUrl,
      unit: variation.unit,
      categoryId: variation.categoryId,
      categoryName: variation.categoryName,
      shelfAddress: variation.shelfAddress,
      expected,
      counted,
      unitCost: variation.costPrice,
      costCurrency: variation.costCurrency,
    }
  })

  const appliedAt =
    status === 'applied' ? new Date(createdAt.getTime() + 2 * 86_400_000).toISOString() : null

  return {
    id: `st-${sequence}`,
    number: `ST-${String(sequence).padStart(5, '0')}`,
    status,
    locationId: location.id,
    locationName: location.name,
    categoryId: category?.id ?? null,
    categoryName: category?.name ?? null,
    brandId: brand?.id ?? null,
    brandName: brand?.name ?? null,
    lines,
    comment:
      random() > 0.6 ? pick(['Monthly count', 'Quarterly audit', 'Brakes aisle only']) : null,
    createdBy: pick(['Akhmet Dauletmuratov', 'Mansurbek', 'Dilnoza']),
    createdAt: createdAt.toISOString(),
    appliedAt,
    correctionId: null,
    updatedAt: appliedAt ?? createdAt.toISOString(),
  } satisfies Stocktake
})

/**
 * Price changes. Their effect is already in the prices above, as with every
 * other document here.
 *
 * Weighted towards percentage changes because that is what actually happens:
 * the som moves against the dollar and everything is repriced together.
 */
export const repricings: Repricing[] = Array.from({ length: 8 }, (_, index) => {
  const sequence = index + 1
  const status = pick(['draft', 'applied', 'applied', 'applied', 'reverted'] as const)
  const kind = pick([
    'percent',
    'percent',
    'percent',
    'margin',
    'amount',
  ] as const) satisfies RuleKind
  const category = random() > 0.6 ? pick(categories) : null
  const brand = random() > 0.75 ? pick(brands) : null
  const repriceLocation = random() > 0.8 ? pick(locations) : null
  const createdAt = new Date(Date.now() - between(4, 150) * 86_400_000)

  const rule = {
    kind,
    value: kind === 'percent' ? between(3, 12) : kind === 'margin' ? 0.3 : between(50_000, 400_000),
    roundTo: pick([100, 1000, 1000, 5000]),
  }

  const scope = variations.filter(
    (variation) =>
      (!category || variation.categoryId === category.id) &&
      (!brand || variation.brandId === brand.id) &&
      (!repriceLocation ||
        variation.stockByLocation.some((row) => row.locationId === repriceLocation.id)),
  )

  const lines = scope.slice(0, between(6, 22)).map((variation, lineIndex) => {
    const costAtTime =
      variation.costCurrency === 'USD' ? variation.costPrice * USD_RATE : variation.costPrice
    const base = { oldPrice: variation.salePrice, costAtTime }
    const newPrice =
      kind === 'percent'
        ? Math.round((base.oldPrice * (1 + rule.value / 100)) / rule.roundTo) * rule.roundTo
        : kind === 'amount'
          ? Math.round((base.oldPrice + rule.value) / rule.roundTo) * rule.roundTo
          : Math.round(costAtTime / 0.7 / rule.roundTo) * rule.roundTo

    return {
      id: `rpl-${sequence}-${lineIndex + 1}`,
      variationId: variation.id,
      productId: variation.productId,
      sku: variation.sku,
      name: variation.fullName,
      imageUrl: variation.imageUrl,
      categoryName: variation.categoryName,
      costAtTime,
      oldPrice: base.oldPrice,
      newPrice: Math.max(0, newPrice),
      oldDiscountPrice: variation.discountPrice,
      newDiscountPrice:
        variation.discountPrice === null || variation.salePrice === 0
          ? null
          : Math.round((variation.discountPrice / variation.salePrice) * newPrice),
    }
  })

  const appliedAt =
    status === 'draft' ? null : new Date(createdAt.getTime() + 3_600_000).toISOString()
  const revertedAt =
    status === 'reverted' ? new Date(createdAt.getTime() + 4 * 86_400_000).toISOString() : null

  return {
    id: `rp-${sequence}`,
    number: `RP-${String(sequence).padStart(5, '0')}`,
    status,
    rule,
    categoryId: category?.id ?? null,
    categoryName: category?.name ?? null,
    brandId: brand?.id ?? null,
    brandName: brand?.name ?? null,
    locationId: repriceLocation?.id ?? null,
    locationName: repriceLocation?.name ?? null,
    lines,
    comment:
      random() > 0.5
        ? pick(['Exchange rate moved', 'Supplier raised prices', 'Margin correction'])
        : null,
    createdBy: pick(['Akhmet Dauletmuratov', 'Mansurbek']),
    createdAt: createdAt.toISOString(),
    appliedAt,
    revertedAt,
    updatedAt: revertedAt ?? appliedAt ?? createdAt.toISOString(),
  } satisfies Repricing
})

/**
 * Wallet movements, for every owner type in one ledger — the shape CLAUDE.md
 * asks for, so clients and employees drop into the same table later.
 *
 * Only suppliers have any yet. A charge is what an invoice added to the debt; a
 * payment is money going the other way, which is why it is negative.
 */
const supplierWalletTransactions: WalletTransaction[] = suppliers
  .filter((supplier) => supplier.lastPaymentAt !== null)
  .flatMap((supplier, index) => {
    const paidAt = new Date(supplier.lastPaymentAt!)
    const charged = supplier.debt + between(80_000_000, 400_000_000)
    const chargedAt = new Date(paidAt.getTime() - between(5, 40) * 86_400_000)
    const payment = charged - supplier.debt

    return [
      {
        id: `wtx-${index + 1}-1`,
        ownerId: supplier.id,
        ownerType: 'supplier' as const,
        kind: 'debt_charged' as const,
        amount: charged,
        balanceAfter: charged,
        comment: 'Goods received',
        referenceType: 'goods_receipt',
        referenceId: null,
        createdAt: chargedAt.toISOString(),
        createdBy: { id: 'emp-1', name: 'Akhmet Dauletmuratov' },
      },
      {
        id: `wtx-${index + 1}-2`,
        ownerId: supplier.id,
        ownerType: 'supplier' as const,
        kind: 'debt_repaid' as const,
        amount: -payment,
        balanceAfter: supplier.debt,
        comment: 'Bank transfer',
        referenceType: null,
        referenceId: null,
        createdAt: paidAt.toISOString(),
        createdBy: { id: 'emp-1', name: 'Akhmet Dauletmuratov' },
      },
    ]
  })

/**
 * Payroll. A month's salary paid, and for some people a mid-month advance still
 * outstanding — which is the balance the wallet exists to show. Nothing in the
 * app generates these yet; how Fura actually pays is a client question.
 */
const employeeWalletTransactions: WalletTransaction[] = employees
  .filter((employee) => employee.status !== 'archived' && employee.salary !== null)
  .flatMap((employee, index) => {
    const salary = employee.salary!
    const advance = index % 3 === 0 ? Math.round(salary * 0.3) : 0
    const rows: WalletTransaction[] = [
      {
        id: `wtx-emp-${index + 1}-1`,
        ownerId: employee.id,
        ownerType: 'employee' as const,
        kind: 'topup' as const,
        amount: salary,
        balanceAfter: salary,
        comment: 'Salary — previous month',
        referenceType: 'payroll',
        referenceId: null,
        createdAt: new Date(Date.now() - between(32, 40) * 86_400_000).toISOString(),
        createdBy: { id: 'emp-6', name: 'Gulnora Kamilova' },
      },
    ]
    if (advance > 0) {
      rows.push({
        id: `wtx-emp-${index + 1}-2`,
        ownerId: employee.id,
        ownerType: 'employee' as const,
        kind: 'withdrawal' as const,
        amount: -advance,
        balanceAfter: salary - advance,
        comment: 'Advance against this month',
        referenceType: 'payroll',
        referenceId: null,
        createdAt: new Date(Date.now() - between(3, 14) * 86_400_000).toISOString(),
        createdBy: { id: 'emp-6', name: 'Gulnora Kamilova' },
      })
    }
    return rows
  })

export const walletTransactions: WalletTransaction[] = [
  ...supplierWalletTransactions,
  ...employeeWalletTransactions,
]

/**
 * Purchase orders. Their receipts are not linked back, because the receipts
 * above were seeded independently — a seeded order that claimed a delivery it
 * cannot point at would be worse than one honestly still waiting.
 *
 * A spread of states, including one that is late and one only part delivered,
 * because those are the two an order screen exists to surface.
 */
export const orders: PurchaseOrder[] = Array.from({ length: 11 }, (_, index) => {
  const sequence = index + 1
  const status = pick(['draft', 'sent', 'sent', 'confirmed', 'partial', 'received'] as const)
  const supplier = pick(suppliers)
  const location = random() > 0.25 ? locations[0]! : pick(locations)
  const createdAt = new Date(Date.now() - between(3, 70) * 86_400_000)

  const lines = Array.from({ length: between(2, 7) }, (_, lineIndex) => {
    const variation = pick(variations)
    const ordered = between(5, 80)
    // Partly delivered orders are the interesting ones: some lines complete,
    // some short, which is what makes "what is still coming" a real question.
    const receivedQuantity =
      status === 'received'
        ? ordered
        : status === 'partial'
          ? random() > 0.4
            ? ordered
            : between(0, ordered - 1)
          : 0

    return {
      id: `pol-${sequence}-${lineIndex + 1}`,
      variationId: variation.id,
      productId: variation.productId,
      sku: variation.sku,
      name: variation.fullName,
      imageUrl: variation.imageUrl,
      unit: variation.unit,
      orderedQuantity: ordered,
      receivedQuantity,
      unitCost: variation.costPrice,
      costCurrency: variation.costCurrency,
    }
  })

  const sentAt = status === 'draft' ? null : new Date(createdAt.getTime() + 3_600_000).toISOString()
  // Some are promised for a date that has already passed, which is the whole
  // point of tracking one.
  const expectedAt =
    status === 'draft'
      ? null
      : new Date(createdAt.getTime() + between(14, 55) * 86_400_000).toISOString()

  return {
    id: `po-${sequence}`,
    number: `PO-${String(sequence).padStart(5, '0')}`,
    status,
    supplierId: supplier.id,
    supplierName: supplier.name,
    locationId: location.id,
    locationName: location.name,
    expectedAt,
    lines,
    comment: random() > 0.65 ? pick(['Container 4', 'Urgent — air freight', 'Q3 restock']) : null,
    receiptIds: [],
    createdBy: pick(['Akhmet Dauletmuratov', 'Mansurbek']),
    createdAt: createdAt.toISOString(),
    sentAt,
    closedAt:
      status === 'received' ? new Date(createdAt.getTime() + 40 * 86_400_000).toISOString() : null,
    updatedAt: createdAt.toISOString(),
  } satisfies PurchaseOrder
})

/**
 * Reorder schedules.
 *
 * Three, deliberately unlike each other: a fortnightly run that has already
 * produced a draft order, a monthly one whose last run found nothing worth
 * ordering, and a paused one. All three states show on the list, and the middle
 * one is the easiest to get wrong — a run that finds nothing still ran.
 */
export const schedules: ReorderSchedule[] = [
  {
    id: 'sch-1',
    supplierId: 'sup-1',
    supplierName: suppliers[0]!.name,
    locationId: locations[0]!.id,
    locationName: locations[0]!.name,
    daysOfMonth: [1, 15],
    timeOfDay: '09:00',
    settings: { salesWindowDays: 90, leadTimeDays: 45, orderIntervalDays: 14, safetyDays: 10 },
    active: true,
    lastRun: {
      at: new Date(Date.now() - 6 * 86_400_000).toISOString(),
      orderId: 'po-11',
      orderNumber: 'PO-00011',
      products: 23,
      units: 265,
      value: 903_082_222,
      trigger: 'schedule',
    },
    createdBy: 'Akhmet Dauletmuratov',
    createdAt: new Date(Date.now() - 120 * 86_400_000).toISOString(),
    updatedAt: new Date(Date.now() - 6 * 86_400_000).toISOString(),
  },
  {
    id: 'sch-2',
    supplierId: 'sup-2',
    supplierName: suppliers[1]!.name,
    locationId: locations[0]!.id,
    locationName: locations[0]!.name,
    daysOfMonth: [25],
    timeOfDay: '08:30',
    settings: { salesWindowDays: 60, leadTimeDays: 30, orderIntervalDays: 30, safetyDays: 7 },
    active: true,
    lastRun: {
      at: new Date(Date.now() - 13 * 86_400_000).toISOString(),
      orderId: null,
      orderNumber: null,
      products: 0,
      units: 0,
      value: 0,
      trigger: 'schedule',
    },
    createdBy: 'Akhmet Dauletmuratov',
    createdAt: new Date(Date.now() - 90 * 86_400_000).toISOString(),
    updatedAt: new Date(Date.now() - 13 * 86_400_000).toISOString(),
  },
  {
    id: 'sch-3',
    supplierId: 'sup-3',
    supplierName: suppliers[2]!.name,
    locationId: locations[1]?.id ?? locations[0]!.id,
    locationName: locations[1]?.name ?? locations[0]!.name,
    daysOfMonth: [5, 20],
    timeOfDay: '10:00',
    settings: { salesWindowDays: 90, leadTimeDays: 21, orderIntervalDays: 14, safetyDays: 5 },
    active: false,
    lastRun: null,
    createdBy: 'Akhmet Dauletmuratov',
    createdAt: new Date(Date.now() - 40 * 86_400_000).toISOString(),
    updatedAt: new Date(Date.now() - 40 * 86_400_000).toISOString(),
  },
]

/**
 * Starter reports.
 *
 * Six, not OX's seventeen. Seventeen templates over a handful of datasets are
 * seventeen column-combinations, and five of OX's duplicate screens we already
 * have — seller performance lives on Employees, current stock on Products,
 * stock by supplier on Suppliers. These are the ones with no home elsewhere.
 */
export const reports: ReportDefinition[] = (
  [
    [
      'Sales by product',
      'sales',
      ['product'],
      ['revenue', 'units', 'margin', 'marginRatio'],
      'month',
      true,
      'bar',
      'revenue',
    ],
    [
      'Sales by month',
      'sales',
      ['month'],
      ['revenue', 'sales', 'averageCheck'],
      'year',
      true,
      'line',
      'revenue',
    ],
    [
      'How people pay',
      'sales',
      ['paymentMethod'],
      ['revenue', 'sales'],
      'month',
      false,
      'donut',
      'revenue',
    ],
    [
      'Margin by category',
      'sales',
      ['category'],
      ['revenue', 'cost', 'margin', 'marginRatio'],
      'quarter',
      true,
      'bar',
      'margin',
    ],
    [
      'Stock movement by document',
      'movement',
      ['kind', 'month'],
      ['inUnits', 'outUnits', 'netUnits'],
      'quarter',
      false,
      'none',
      null,
    ],
    [
      'Who owes what',
      'money',
      ['partyType', 'party'],
      ['owedToUs', 'owedByUs', 'net'],
      'all',
      false,
      'none',
      null,
    ],
  ] as const
).map(
  ([name, source, dimensions, measures, defaultPeriod, pinned, chart, chartMeasure], index) => ({
    id: `rep-${index + 1}`,
    name,
    source,
    dimensions: [...dimensions],
    measures: [...measures],
    defaultPeriod,
    chart,
    chartMeasure,
    pinned,
    createdBy: index % 2 === 0 ? 'Akhmet Dauletmuratov' : 'Nodira Rasulova',
    createdAt: new Date(Date.now() - between(20, 200) * 86_400_000).toISOString(),
    updatedAt: new Date(Date.now() - between(1, 19) * 86_400_000).toISOString(),
  }),
)

/**
 * Print templates.
 *
 * Three, because three is what a parts business actually prints: a sticker for
 * the part, a priced card for the rack, and a receipt for the customer.
 */
export const printTemplates: PrintTemplate[] = [
  {
    id: 'tpl-1',
    name: 'Part sticker',
    kind: 'label',
    widthMm: 58,
    heightMm: 40,
    code: 'barcode',
    fields: ['productName', 'sku', 'brand', 'oem'],
    headlineField: 'productName',
    createdBy: 'Akhmet Dauletmuratov',
    updatedAt: new Date(Date.now() - 64 * 86_400_000).toISOString(),
  },
  {
    id: 'tpl-2',
    name: 'Shelf card',
    kind: 'shelf',
    widthMm: 80,
    heightMm: 50,
    code: 'qr',
    fields: ['productName', 'price', 'shelf', 'vehicle', 'category'],
    headlineField: 'price',
    createdBy: 'Akhmet Dauletmuratov',
    updatedAt: new Date(Date.now() - 21 * 86_400_000).toISOString(),
  },
  {
    id: 'tpl-3',
    name: 'Counter receipt',
    kind: 'receipt',
    widthMm: 80,
    heightMm: 150,
    code: 'qr',
    fields: ['company', 'productName', 'sku', 'price', 'date'],
    headlineField: 'company',
    createdBy: 'Mansur Karimov',
    updatedAt: new Date(Date.now() - 5 * 86_400_000).toISOString(),
  },
]

/**
 * Drivers.
 *
 * The people who actually turn up at the counter for the haulage companies.
 * Attached to a company client where there is one, and a couple of
 * owner-drivers who buy for themselves.
 */
/**
 * Drivers.
 *
 * Three shapes, because all three walk into the shop: owner-drivers buying for
 * their own truck, company drivers buying on their autopark's contract, and a
 * couple who are both — the case that makes the counter ask which.
 */
export const drivers: Driver[] = (
  [
    // name, phone, autopark index, own trucks, autopark truck, status
    ['Bekzod Normatov', '+998 90 111 22 33', 0, [], ['01 A 123 AA', 'MAN', 'TGX 18.440'], 'active'],
    [
      'Sherzod Qodirov',
      '+998 90 222 33 44',
      0,
      [['01 K 777 AA', 'Kamaz', '5490']],
      ['01 A 456 BB', 'MAN', 'TGX 18.440'],
      'active',
    ],
    ['Ulugbek Toshev', '+998 90 333 44 55', 1, [], ['01 B 789 CC', 'DAF', 'XF 105'], 'active'],
    ['Farrux Ismoilov', '+998 91 444 55 66', 1, [], ['01 B 234 DD', 'DAF', 'XF 105'], 'active'],
    [
      'Jahongir Aliyev',
      '+998 93 555 66 77',
      2,
      [['10 M 555 ZZ', 'Kamaz', '65115']],
      ['10 C 567 EE', 'Howo', 'T7H'],
      'active',
    ],
    ['Ravshan Sobirov', '+998 94 666 77 88', 2, [], ['10 C 890 FF', 'Howo', 'T7H'], 'inactive'],
    [
      'Otabek Yusupov',
      '+998 97 777 88 99',
      3,
      [],
      ['01 D 345 GG', 'Mercedes-Benz', 'Actros 1841'],
      'active',
    ],
    [
      'Shuhrat Nazarov',
      '+998 99 888 99 00',
      null,
      [['40 E 678 HH', 'Scania', 'R450']],
      null,
      'active',
    ],
    // Did well and bought a second lorry — the case that makes the till ask
    // which truck a purchase is for.
    [
      'Doniyor Rahimov',
      '+998 90 999 00 11',
      null,
      [
        ['25 F 901 II', 'Isuzu', 'NPR 75'],
        ['25 G 404 KK', 'Foton', 'Auman'],
      ],
      null,
      'active',
    ],
    ['Aziz Karimov', '+998 91 100 20 30', 4, [], ['01 G 234 JJ', 'Shacman', 'X3000'], 'active'],
  ] as const
).map(([fullName, phone, autoparkIndex, ownTrucks, autoparkTruck, status], index): Driver => {
  // Businesses only: a driver drives for a company, never for a walk-in.
  const companies = clients.filter((client) => client.type === 'business')
  const autopark = autoparkIndex === null ? null : (companies[autoparkIndex] ?? null)
  return {
    id: `driver-${index + 1}`,
    code: `DRV-${String(index + 1).padStart(5, '0')}`,
    fullName,
    phone,
    ownTrucks: ownTrucks.map(([plate, make, model]) => ({ plate, make, model })),
    autoparkId: autopark?.id ?? null,
    autoparkName: autopark?.name ?? null,
    autoparkTruck:
      autopark && autoparkTruck
        ? { plate: autoparkTruck[0], make: autoparkTruck[1], model: autoparkTruck[2] }
        : null,
    comment: null,
    status,
    createdAt: new Date(Date.now() - between(30, 900) * 86_400_000).toISOString(),
    updatedAt: new Date(Date.now() - between(1, 30) * 86_400_000).toISOString(),
  }
})

/**
 * Who collected each sale.
 *
 * Run after the drivers exist, because a sale cannot name one before then.
 * A sale to a haulage company is attributed to one of *their* drivers and
 * their truck — anything else would put a purchase on a truck belonging to a
 * different company, which is exactly the mistake the two apps would surface.
 */
{
  const byAutopark = new Map<string, Driver[]>()
  for (const driver of drivers) {
    if (!driver.autoparkId) continue
    byAutopark.set(driver.autoparkId, [...(byAutopark.get(driver.autoparkId) ?? []), driver])
  }
  const owners = drivers.filter((driver) => driver.ownTrucks.length > 0)

  for (const sale of sales) {
    if (sale.clientId) {
      const fleet = byAutopark.get(sale.clientId)
      // Not every company purchase comes through a driver — somebody from the
      // office collects too, and those sales rightly have no truck.
      if (fleet?.length && random() > 0.25) {
        const driver = pick(fleet)
        sale.driverId = driver.id
        sale.driverName = driver.fullName
        sale.truckPlate = driver.autoparkTruck?.plate ?? null
      }
      continue
    }
    // A walk-in who turns out to be a known owner-driver: scanned at the
    // counter, so the purchase reaches his own app even with no account behind it.
    if (random() > 0.75) {
      const driver = pick(owners)
      sale.driverId = driver.id
      sale.driverName = driver.fullName
      sale.truckPlate = pick(driver.ownTrucks).plate
    }
  }
}

/**
 * Cash registers — one desk per location.
 */
export const cashRegisters: CashRegister[] = locations.map((location, index) => ({
  id: `reg-${index + 1}`,
  name: index === 0 ? 'Main desk' : `${location.name} desk`,
  locationId: location.id,
  locationName: location.name,
  active: true,
}))

/**
 * Cash shifts, built *from* the sales rather than beside them.
 *
 * A shift whose expected cash does not match the sales it contains would make
 * every screen lie, so the day's cash sales are gathered first and the drawer
 * is derived from them. Counted cash is then jittered the way a real day goes:
 * usually exact, sometimes a few thousand out, occasionally properly wrong —
 * because a variance column where nothing ever varies teaches nobody anything.
 */
export const cashShifts: CashShift[] = (() => {
  const shifts: CashShift[] = []
  const startOfDay = (daysAgo: number) => {
    const date = new Date(Date.now() - daysAgo * 86_400_000)
    date.setHours(9, 0, 0, 0)
    return date
  }

  let sequence = 0
  for (let daysAgo = 13; daysAgo >= 0; daysAgo -= 1) {
    for (const register of cashRegisters) {
      const opened = startOfDay(daysAgo)
      const closes = new Date(opened.getTime() + 10 * 3_600_000)
      // The one open drawer: today, at the main desk. Everything else is done.
      const isOpen = daysAgo === 0 && register.id === 'reg-1'

      // Matched by calendar day, not by the 09:00-19:00 window the shift
      // displays: the seeded sales are spread across the clock, and a cash
      // sale that fell outside trading hours belonging to no drawer at all
      // would be a seeding artefact rather than anything a real day does.
      const dayStart = new Date(opened)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(dayStart.getTime() + 86_400_000)
      const daySales = sales.filter(
        (sale) =>
          sale.paymentMethod === 'cash' &&
          // Money in the drawer, not sales on the book: a cash sale still
          // unpaid has put nothing in it.
          sale.paid > 0 &&
          sale.locationId === register.locationId &&
          new Date(sale.createdAt) >= dayStart &&
          new Date(sale.createdAt) < dayEnd,
      )
      if (daySales.length === 0 && !isOpen) continue

      sequence += 1
      const id = `shift-${sequence}`
      for (const sale of daySales) sale.shiftId = id

      const staff =
        employees.find(
          (employee) => employee.locationId === register.locationId && employee.status === 'active',
        ) ?? employees[0]!

      const openingFloat = 200_000
      // The reason decides the direction. Picking them independently produced
      // "Extra float added -90 000", which reads as broken because it is.
      const [movementReason, movementKind] = pick([
        ['float', 'in'],
        ['expense', 'out'],
        ['collection', 'out'],
        ['supplier', 'out'],
      ] as const)
      const movements =
        random() > 0.6
          ? [
              {
                id: `${id}-m1`,
                kind: movementKind as 'in' | 'out',
                reason: movementReason,
                amount: Math.round(between(20_000, 400_000) / 1000) * 1000,
                comment: null,
                at: new Date(opened.getTime() + 4 * 3_600_000).toISOString(),
                by: staff.fullName,
              },
            ]
          : []

      const cashTaken = daySales.reduce((sum, sale) => sum + sale.paid, 0)
      const expected =
        openingFloat +
        cashTaken +
        movements.filter((m) => m.kind === 'in').reduce((sum, m) => sum + m.amount, 0) -
        movements.filter((m) => m.kind === 'out').reduce((sum, m) => sum + m.amount, 0)

      const roll = random()
      const drift =
        roll > 0.75
          ? 0
          : roll > 0.35
            ? Math.round(between(-4, 4)) * 1000
            : Math.round(between(-60, 40)) * 1000

      shifts.push({
        id,
        number: `CS-${String(sequence).padStart(5, '0')}`,
        registerId: register.id,
        registerName: register.name,
        locationId: register.locationId,
        locationName: register.locationName,
        employeeId: staff.id,
        employeeName: staff.fullName,
        status: isOpen ? 'open' : 'closed',
        openedAt: opened.toISOString(),
        closedAt: isOpen ? null : closes.toISOString(),
        openingFloat,
        movements,
        countedCash: isOpen ? null : Math.max(0, expected + drift),
        closingComment: null,
      })
    }
  }

  return shifts.reverse()
})()

/**
 * Company settings.
 *
 * The handful of facts every other screen reads. `usdRate` in particular is
 * the same number as `USD_RATE` above — settings is where a person changes it,
 * the constant is where the seed reads it.
 */
export const companySettings: CompanySettings = {
  name: 'Fura Sentr',
  logoUrl: null,
  industry: 'Auto parts',
  address: 'Ташкент, ул. Амира Темура, 41',
  phone: '+998 71 200 40 40',
  email: 'info@fura.uz',
  usdRate: USD_RATE,
  paymentMethods: ['cash', 'card', 'transfer', 'credit'],
  allowOverCreditLimit: false,
  // Deliberately not `open` or `postponed`: an unfinished sale is not revenue,
  // and counting it would flatter every figure in Analytics.
  revenueStatuses: ['completed', 'delivered', 'processed'],
  updatedAt: new Date(Date.now() - 30 * 86_400_000).toISOString(),
}

/** Brands, with the zone OX records against each. */
export const brandSettings: Brand[] = brands.map((brand, index) => ({
  id: brand.id,
  name: brand.name,
  zone: ['Germany', 'Japan', 'Germany', 'United Kingdom'][index] ?? null,
  active: true,
}))

export const locationSettings: LocationSettings[] = [
  {
    id: 'loc-1',
    name: 'Central warehouse',
    kind: 'warehouse',
    address: 'Ташкент, Сергели, склад 4',
    areaSqm: 1200,
    active: true,
  },
  {
    id: 'loc-2',
    name: 'Shop — Chilonzor',
    kind: 'shop',
    address: 'Ташкент, ул. Чилонзор, 18',
    areaSqm: 240,
    active: true,
  },
  {
    id: 'loc-3',
    name: 'Shop — Yunusobod',
    kind: 'shop',
    address: 'Ташкент, ул. Амира Темура, 108',
    areaSqm: 180,
    active: true,
  },
]

/** Categories, with the parent implied by the path the catalogue already uses. */
export const categorySettings: CategorySettings[] = (() => {
  const parents = [...new Set(categories.map((c) => c.path.split(' > ')[0]!))]
  return [
    ...parents.map((name, index) => ({ id: `catgrp-${index + 1}`, name, parentId: null })),
    ...categories.map((category) => ({
      id: category.id,
      name: category.name,
      parentId: `catgrp-${parents.indexOf(category.path.split(' > ')[0]!) + 1}`,
    })),
  ]
})()

/**
 * Notification preferences.
 *
 * Seeded partly on, because an all-off state cannot show that the shape is
 * (event × channel) rather than one master switch.
 */
export const notificationPreferences: NotificationPreferences = {
  'stock.low': ['inApp', 'telegram'],
  'stock.out': ['inApp', 'email', 'telegram'],
  'order.late': ['inApp', 'email'],
  'schedule.drafted': ['inApp'],
  'sale.overdue': ['inApp', 'email'],
  'client.overLimit': ['inApp'],
  'stocktake.variance': ['inApp'],
}
