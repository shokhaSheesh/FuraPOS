/**
 * Deterministic seed data. Shapes here are the contract the real API must
 * meet — when the backend lands, these files are the spec to hand over.
 */
import type { Product } from '@/features/products/model/product'

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
