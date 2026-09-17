/**
 * The columns a spreadsheet can be mapped onto.
 *
 * Deliberately the product list's own fields and nothing else, for the same
 * reason the documents show the product list's columns: a supplier's file is
 * describing products, and if it can carry a field we hold, it should be able
 * to land in it. Anything OX offers that the client has cut from our products
 * — season, gender, analogue, weighable — is absent here too, because there is
 * no field for it to reach.
 */
export type ImportField =
  | 'ignore'
  // identity
  | 'barcode'
  | 'sku'
  | 'productName'
  | 'variationName'
  // what the document is asking for
  | 'quantity'
  | 'price'
  | 'currency'
  // the catalogue's own
  | 'salePrice'
  | 'supplier'
  | 'category'
  | 'partSide'
  | 'oem'
  | 'make'
  | 'model'
  | 'manufacturer'
  | 'cargoWeightKg'
  | 'cargoSize'
  | 'shelfAddress'
  | 'unit'
  | 'description'

export interface ImportFieldSpec {
  value: ImportField
  label: string
  /** One of these has to be mapped, or a row cannot be matched to anything. */
  identifies?: boolean
  /** Only meaningful when a row creates a product rather than matching one. */
  creationOnly?: boolean
}

export const IMPORT_FIELDS: ImportFieldSpec[] = [
  { value: 'ignore', label: 'Ignore this column' },
  { value: 'barcode', label: 'Barcode', identifies: true },
  { value: 'sku', label: 'SKU', identifies: true },
  { value: 'productName', label: 'Product name' },
  { value: 'variationName', label: 'Variation name', creationOnly: true },
  { value: 'quantity', label: 'Quantity' },
  { value: 'price', label: 'Supplier price' },
  { value: 'currency', label: 'Currency' },
  { value: 'salePrice', label: 'Sale price', creationOnly: true },
  { value: 'supplier', label: 'Supplier', creationOnly: true },
  { value: 'category', label: 'Category', creationOnly: true },
  { value: 'partSide', label: 'Part', creationOnly: true },
  { value: 'oem', label: 'OEM', creationOnly: true },
  { value: 'make', label: 'Make', creationOnly: true },
  { value: 'model', label: 'Model', creationOnly: true },
  { value: 'manufacturer', label: 'Product brand', creationOnly: true },
  { value: 'cargoWeightKg', label: 'Cargo weight', creationOnly: true },
  { value: 'cargoSize', label: 'Cargo size', creationOnly: true },
  { value: 'shelfAddress', label: 'Storage address', creationOnly: true },
  { value: 'unit', label: 'Unit', creationOnly: true },
  { value: 'description', label: 'Description', creationOnly: true },
]

/**
 * Guesses what a column is from its heading, in either language.
 *
 * A supplier's file is written in their words, and asking somebody to map
 * twenty columns by hand every time is how a feature like this stops being
 * used. Every guess stays a select the user can correct.
 *
 * Order matters: the more specific headings are tested first, because
 * "Продажная цена" contains "цена" and would otherwise be read as the
 * supplier's price.
 */
export function guessField(heading: string, sample: string): ImportField {
  const text = heading.toLowerCase().trim()
  const has = (...words: string[]) => words.some((word) => text.includes(word))

  if (!text) return /^\d+$/.test(sample) ? 'quantity' : 'ignore'

  if (has('штрих', 'barcode', 'ean')) return 'barcode'
  // "Артикул моб" is OX's mobile SKU, a field the client cut — ignore it
  // rather than map two columns onto one and let the last one win.
  if (has('артикул моб', 'sku моб')) return 'ignore'
  if (has('артикул', 'sku')) return 'sku'

  /*
    Prices before brands, brands before names. Each pair overlaps in a way that
    bites: "Цена поставщика" contains "поставщик", so testing the supplier
    first reads the supplier's *price* as the supplier; and "Бренд товара"
    contains "товар", so testing the product name first reads the manufacturer
    as the product's name.
  */
  if (has('продажная цена', 'цена продажи', 'sale price', 'retail')) return 'salePrice'
  if (has('цена поставщика', 'закуп', 'supplier price', 'cost')) return 'price'
  if (has('цена', 'price')) return 'price'
  if (has('валюта', 'currency')) return 'currency'

  if (has('кол-во', 'колво', 'количество', 'qty', 'quantity')) return 'quantity'

  if (has('бренд товара', 'производитель', 'manufacturer', 'product brand')) return 'manufacturer'
  if (has('поставщик', 'supplier', 'бренд')) return 'supplier'

  // Before the names, for the same reason as the brands: "Адрес товара"
  // contains "товар", and would otherwise name every product after its bin.
  if (has('адрес', 'address', 'ячейка')) return 'shelfAddress'

  if (has('название вариации', 'вариация', 'variation')) return 'variationName'
  if (has('название продукта', 'наименование', 'product name', 'товар')) return 'productName'

  if (has('категория', 'category')) return 'category'
  if (has('часть', 'сторона', 'part', 'side')) return 'partSide'
  if (has('oem', 'оем')) return 'oem'
  if (has('марка', 'make')) return 'make'
  if (has('модель', 'model')) return 'model'
  if (has('вес карго', 'вес', 'weight')) return 'cargoWeightKg'
  if (has('размер карго', 'размер', 'size')) return 'cargoSize'
  if (has('единица', 'unit', 'ед.изм')) return 'unit'
  if (has('описание', 'description')) return 'description'

  return 'ignore'
}

/** "12 500,50" and "12,500.50" are the same number written two ways. */
export function parseNumber(value: string): number | null {
  const cleaned = value
    .replace(/\s/g, '')
    .replace(/,(\d{1,2})$/, '.$1')
    .replace(/,/g, '')
  if (!cleaned) return null
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

/** What a currency cell means, whichever way it was written. */
export function parseCurrency(value: string): 'USD' | 'UZS' | null {
  const text = value.toUpperCase()
  if (text.includes('USD') || text.includes('$')) return 'USD'
  if (text.includes('UZS') || text.includes('СУМ') || text.includes('SO')) return 'UZS'
  return null
}
