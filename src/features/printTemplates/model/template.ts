import { z } from 'zod'
import type { Id, IsoDate } from '@/shared/types'

/**
 * Print templates — OX's «Шаблоны для печати».
 *
 * What gets stuck on a part, hung on a shelf, or handed to a customer. OX ships
 * a free drag-and-drop canvas: you place every element by hand at any x/y.
 * This is the same job done by choosing, because the hard part of a label is
 * never *where* the SKU sits — it is remembering to put the SKU on at all.
 *
 * So a template is a size, a code, and an ordered list of the fields that
 * print. The preview is rendered to true scale in millimetres, which is the
 * one thing about a label that must be right before anything is printed.
 */
export type TemplateKind = 'label' | 'shelf' | 'receipt'

export const TEMPLATE_KINDS: { value: TemplateKind; label: string; hint: string }[] = [
  { value: 'label', label: 'Product label', hint: 'Goes on the part itself' },
  { value: 'shelf', label: 'Shelf label', hint: 'Goes on the rack, priced' },
  { value: 'receipt', label: 'Receipt', hint: 'Handed to the customer' },
]

export type CodeKind = 'none' | 'barcode' | 'qr'

export const CODE_KINDS: { value: CodeKind; label: string }[] = [
  { value: 'barcode', label: 'Barcode' },
  { value: 'qr', label: 'QR code' },
  { value: 'none', label: 'No code' },
]

/**
 * The fields a template can print. Every one is a real column on a variation —
 * there is no free-text token language to learn, and nothing here can go stale
 * against the catalogue.
 */
export interface TemplateField {
  key: string
  label: string
  /** Which kinds it makes sense on. A price on a part label invites arguments. */
  kinds: TemplateKind[]
  /** Preview text, so the sample label reads like a real one. */
  sample: string
}

export const TEMPLATE_FIELDS: TemplateField[] = [
  {
    key: 'productName',
    label: 'Product name',
    kinds: ['label', 'shelf', 'receipt'],
    sample: 'Brake pad set, front',
  },
  { key: 'sku', label: 'SKU', kinds: ['label', 'shelf', 'receipt'], sample: 'FS-14829' },
  { key: 'oem', label: 'OEM codes', kinds: ['label', 'shelf'], sample: '1K0 698 151 B' },
  { key: 'brand', label: 'Brand', kinds: ['label', 'shelf', 'receipt'], sample: 'Bosch' },
  { key: 'category', label: 'Category', kinds: ['label', 'shelf'], sample: 'Brakes' },
  {
    key: 'vehicle',
    label: 'Make and models',
    kinds: ['label', 'shelf'],
    sample: 'VW Golf V, Audi A3',
  },
  { key: 'shelf', label: 'Shelf address', kinds: ['label', 'shelf'], sample: 'A-04-12' },
  { key: 'price', label: 'Price', kinds: ['shelf', 'receipt'], sample: '420 000' },
  {
    key: 'company',
    label: 'Company name',
    kinds: ['label', 'shelf', 'receipt'],
    sample: 'Fura Sentr',
  },
  { key: 'date', label: 'Date printed', kinds: ['label', 'receipt'], sample: '09.09.2026' },
]

export const fieldsFor = (kind: TemplateKind) =>
  TEMPLATE_FIELDS.filter((field) => field.kinds.includes(kind))

/** Stock label stationery, plus whatever anyone types in. */
export const PRESET_SIZES: { label: string; widthMm: number; heightMm: number }[] = [
  { label: '58 × 40 mm', widthMm: 58, heightMm: 40 },
  { label: '80 × 50 mm', widthMm: 80, heightMm: 50 },
  { label: '80 × 100 mm', widthMm: 80, heightMm: 100 },
  { label: '100 × 150 mm', widthMm: 100, heightMm: 150 },
]

export interface PrintTemplate {
  id: Id
  name: string
  kind: TemplateKind
  widthMm: number
  heightMm: number
  code: CodeKind
  /** Ordered — this is the order they print in. */
  fields: string[]
  /** Bigger than the rest, at the top. Usually the product name. */
  headlineField: string | null
  createdBy: string
  updatedAt: IsoDate
}

export const templateSchema = z.object({
  name: z.string().min(2, 'Give the template a name'),
  kind: z.enum(['label', 'shelf', 'receipt']),
  widthMm: z.number().min(20, 'Nothing readable prints under 20 mm').max(210, 'Wider than A4'),
  heightMm: z.number().min(20, 'Nothing readable prints under 20 mm').max(297, 'Taller than A4'),
  code: z.enum(['none', 'barcode', 'qr']),
  fields: z.array(z.string()).min(1, 'A label with no fields on it prints a blank sticker'),
  headlineField: z.string().nullable(),
})

export type TemplateDraft = z.infer<typeof templateSchema>

export const kindLabel = (kind: TemplateKind) =>
  TEMPLATE_KINDS.find((entry) => entry.value === kind)?.label ?? kind

export const sizeLabel = (template: Pick<PrintTemplate, 'widthMm' | 'heightMm'>) =>
  `${template.widthMm} × ${template.heightMm} mm`

/**
 * How many labels fit across a sheet of A4, allowing 10 mm of margin either
 * side. Printing one sticker per page wastes a roll, and this is the number
 * that stops it.
 */
export const A4_WIDTH_MM = 210
export const A4_HEIGHT_MM = 297
export const SHEET_MARGIN_MM = 10

export function perRow(widthMm: number): number {
  const usable = A4_WIDTH_MM - SHEET_MARGIN_MM * 2
  return Math.max(1, Math.floor(usable / widthMm))
}

/** Rows down the page — a 150 mm receipt fits one, a 40 mm sticker six. */
export function perColumn(heightMm: number): number {
  const usable = A4_HEIGHT_MM - SHEET_MARGIN_MM * 2
  return Math.max(1, Math.floor(usable / heightMm))
}

export const perSheet = (widthMm: number, heightMm: number) => perRow(widthMm) * perColumn(heightMm)

/** "1 label" / "12 labels" — the plural has to follow the number. */
export const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`

/** A one-line summary for the card: "Product label · 4 fields · barcode". */
export function describeTemplate(template: PrintTemplate): string {
  const parts = [kindLabel(template.kind), `${template.fields.length} fields`]
  if (template.code !== 'none') parts.push(template.code === 'qr' ? 'QR code' : 'barcode')
  return parts.join(' · ')
}

/**
 * Dropping the kind can strand fields that only made sense on the old one — a
 * price on a part label. Rather than silently printing them, they are removed
 * here, and the form says how many went.
 */
export function fieldsAfterKindChange(fields: string[], kind: TemplateKind): string[] {
  const allowed = new Set(fieldsFor(kind).map((field) => field.key))
  return fields.filter((field) => allowed.has(field))
}
