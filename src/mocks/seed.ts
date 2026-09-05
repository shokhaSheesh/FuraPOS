/**
 * Deterministic seed data. Shapes here are the contract the real API must
 * meet — when the backend lands, these files are the spec to hand over.
 */
import type { Product } from '@/features/products/model/product'
import type { Sale } from '@/features/sales/model/sale'

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

export const products: Product[] = Array.from({ length: 137 }, (_, index) => {
  const category = pick(categories)
  const brand = random() > 0.15 ? pick(brands) : null
  // Suppliers invoice in USD, customers pay in UZS.
  const costCurrency = random() > 0.35 ? 'USD' : 'UZS'
  const costPrice = costCurrency === 'USD' ? between(5, 900) : between(15_000, 900_000)
  const costInUzs = costCurrency === 'USD' ? costPrice * USD_RATE : costPrice
  const salePrice = Math.round(costInUzs * (1.15 + random() * 0.6))
  const vehicle = pick(vehicleMakes)
  const createdAt = new Date(Date.now() - between(1, 900) * 86_400_000).toISOString()

  const stockByLocation = locations
    .filter(() => random() > 0.35)
    .map((location) => ({
      locationId: location.id,
      locationName: location.name,
      quantity: between(0, 90),
    }))
  const stock = stockByLocation.reduce((sum, row) => sum + row.quantity, 0)

  return {
    id: `prd-${index + 1}`,
    sku: `SKU-${String(index + 1).padStart(5, '0')}`,
    barcode: random() > 0.3 ? String(4_600_000_000_000 + index) : null,
    name: `${pick(productNouns)} ${pick(['A', 'B', 'X', 'Pro', 'HD'])}${between(10, 99)}`,
    // The reference data keeps the OEM number here.
    description: random() > 0.4 ? String(between(1_000_000, 9_999_999)) : null,
    categoryId: category.id,
    categoryName: category.name,
    categoryPath: category.path,
    brandId: brand?.id ?? null,
    brandName: brand?.name ?? null,
    tags: random() > 0.6 ? [pick(['bestseller', 'import', 'oem', 'clearance'])] : [],
    unit: pick(['pcs', 'pcs', 'pcs', 'l', 'kg'] as const),
    moq: random() > 0.7 ? between(2, 12) : null,
    costPrice,
    costCurrency: costCurrency as Product['costCurrency'],
    salePrice,
    discountPrice: random() > 0.85 ? Math.round(salePrice * 0.9) : null,
    stock,
    stockByLocation,
    lowStockThreshold: random() > 0.5 ? between(5, 30) : null,
    shelfAddress:
      random() > 0.4 ? `${pick(['A', 'B', 'C'])}-${between(1, 20)}-${between(1, 9)}` : null,
    vehicleMake: vehicle.make,
    vehicleModels: [...vehicle.models].slice(0, between(1, vehicle.models.length)),
    partSide: pick(['left', 'right', 'both', null] as const),
    cargoWeightKg: random() > 0.5 ? between(1, 60) : null,
    cargoSize: random() > 0.5 ? `${between(20, 160)}*${between(20, 90)}*${between(10, 60)}` : null,
    isShippable: random() > 0.15,
    showOnline: random() > 0.35,
    status: random() > 0.92 ? 'archived' : 'active',
    imageUrl: null,
    createdAt,
    updatedAt: createdAt,
  } satisfies Product
})

const clientNames = [
  'Автосервис "Дилшод"',
  'ООО "Транс Логистик"',
  'Бекзод Рахимов',
  'Гулнора Каримова',
  'ИП "Мотор Плюс"',
  'Санжар Умаров',
  'ООО "Фура Парк"',
  'Азиз Тошматов',
]

export const clients = clientNames.map((name, index) => ({
  id: `cli-${index + 1}`,
  name,
  phone: `+998 9${between(0, 9)} ${between(100, 999)} ${between(10, 99)} ${between(10, 99)}`,
  debt: random() > 0.6 ? between(0, 4_000_000) : 0,
}))

/** Sales accumulate at runtime as the New sale screen posts them. */
export const sales: Sale[] = Array.from({ length: 18 }, (_, index) => {
  const location = pick(locations)
  const client = random() > 0.35 ? pick(clients) : null
  const lineCount = between(1, 4)
  const lines = Array.from({ length: lineCount }, (__, lineIndex) => {
    const product = pick(products)
    const quantity = between(1, 6)
    return {
      id: `line-${index}-${lineIndex}`,
      productId: product.id,
      sku: product.sku,
      name: product.name,
      brandName: product.brandName,
      categoryName: product.categoryName,
      imageUrl: product.imageUrl,
      unit: product.unit,
      quantity,
      unitPrice: product.salePrice,
      discountPercent: random() > 0.75 ? between(1, 10) : 0,
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
  const createdAt = new Date(Date.now() - between(0, 20) * 86_400_000)

  return {
    id: `sale-${index + 1}`,
    number: `S-${String(index + 1).padStart(5, '0')}`,
    status: status as Sale['status'],
    clientId: client?.id ?? null,
    clientName: client?.name ?? null,
    locationId: location.id,
    locationName: location.name,
    sellerName: pick(['Akhmet Dauletmuratov', 'Mansurbek Akchaev', 'Dilshod Yusupov']),
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
