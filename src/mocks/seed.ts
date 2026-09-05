/**
 * Deterministic seed data. Shapes here are the contract the real API must
 * meet — when the backend lands, these files are the spec to hand over.
 */
import type { Product } from '@/features/products/model/product'
import type { Sale } from '@/features/sales/model/sale'

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

export const categories = [
  { id: 'cat-1', name: 'Engine parts' },
  { id: 'cat-2', name: 'Brakes' },
  { id: 'cat-3', name: 'Filters' },
  { id: 'cat-4', name: 'Electrics' },
  { id: 'cat-5', name: 'Oils & fluids' },
  { id: 'cat-6', name: 'Accessories' },
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
  const costPrice = between(15_000, 900_000)
  const salePrice = Math.round(costPrice * (1.15 + random() * 0.6))
  const stock = random() > 0.08 ? between(0, 240) : 0
  const createdAt = new Date(Date.now() - between(1, 900) * 86_400_000).toISOString()

  return {
    id: `prd-${index + 1}`,
    sku: `SKU-${String(index + 1).padStart(5, '0')}`,
    barcode: random() > 0.3 ? String(4_600_000_000_000 + index) : null,
    name: `${pick(productNouns)} ${pick(['A', 'B', 'X', 'Pro', 'HD'])}${between(10, 99)}`,
    categoryId: category.id,
    categoryName: category.name,
    brandId: brand?.id ?? null,
    brandName: brand?.name ?? null,
    unit: pick(['pcs', 'pcs', 'pcs', 'l', 'kg'] as const),
    costPrice,
    salePrice,
    stock,
    lowStockThreshold: random() > 0.5 ? between(5, 30) : null,
    status: random() > 0.92 ? 'archived' : 'active',
    imageUrl: null,
    createdAt,
    updatedAt: createdAt,
  }
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
  const status = random() > 0.82 ? 'draft' : 'completed'
  const paid = status === 'completed' ? total : 0

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
    comment: null,
    lines,
    subtotal,
    discount,
    total,
    paid,
    debt: Math.max(0, total - paid),
    createdAt: new Date(Date.now() - between(0, 20) * 86_400_000).toISOString(),
  }
})
