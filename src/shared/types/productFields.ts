import { z } from 'zod'
import type { Id, IsoDate } from './common'

/**
 * A column the business adds to its own product catalogue — «Настройка полей»
 * in OX, where a tenant adds «пользовательские колонки» of its own.
 *
 * The built-in columns cover what every truck-parts catalogue needs; this is
 * for what only this business tracks — a material, a warranty, a country of
 * origin. Once added, the column shows on the product list and is asked for on
 * the create and edit form, in the right place for its level.
 */
export interface ProductField {
  id: Id
  name: string
  type: ProductFieldType
  /** The choices, for `select`. Empty for every other type. */
  options: string[]
  /**
   * Whether one answer covers the whole product, or each variation has its
   * own. A material is the product's; a warranty can differ left to right.
   */
  level: ProductFieldLevel
  createdAt: IsoDate
}

export type ProductFieldType = 'text' | 'number' | 'select' | 'yesno'
export type ProductFieldLevel = 'product' | 'variation'

/** One value per field id. A missing key and `null` both mean "not filled in". */
export type CustomFieldValues = Record<string, string | number | boolean | null>

export const PRODUCT_FIELD_TYPES: { value: ProductFieldType; label: string; hint: string }[] = [
  { value: 'text', label: 'Text', hint: 'Anything typed — a code, a note' },
  { value: 'number', label: 'Number', hint: 'A quantity or a measurement' },
  { value: 'select', label: 'List', hint: 'One of the choices you set' },
  { value: 'yesno', label: 'Yes / no', hint: 'A switch' },
]

export const PRODUCT_FIELD_LEVELS: { value: ProductFieldLevel; label: string; hint: string }[] = [
  { value: 'product', label: 'Product', hint: 'One answer for the whole product' },
  { value: 'variation', label: 'Each variation', hint: 'Left and right can differ' },
]

export const productFieldTypeLabel = (type: ProductFieldType) =>
  PRODUCT_FIELD_TYPES.find((entry) => entry.value === type)!.label

export const productFieldLevelLabel = (level: ProductFieldLevel) =>
  PRODUCT_FIELD_LEVELS.find((entry) => entry.value === level)!.label

export const isFilled = (value: CustomFieldValues[string] | undefined) =>
  value !== null && value !== undefined && value !== ''

/** How a stored value reads in a table or on a detail page. Null when empty. */
export function displayFieldValue(
  field: Pick<ProductField, 'type'>,
  value: CustomFieldValues[string] | undefined,
): string | null {
  if (!isFilled(value)) return null
  if (field.type === 'yesno') return value ? 'Yes' : 'No'
  if (field.type === 'number' && typeof value === 'number') {
    return new Intl.NumberFormat('ru-RU').format(value)
  }
  return String(value)
}

export const customFieldValuesSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean(), z.null()]),
)

export const productFieldSchema = z
  .object({
    name: z.string().trim().min(1, 'Name the column'),
    type: z.enum(['text', 'number', 'select', 'yesno']),
    options: z.array(z.string()),
    level: z.enum(['product', 'variation']),
  })
  .superRefine((values, ctx) => {
    if (values.type === 'select' && values.options.length < 2) {
      ctx.addIssue({
        code: 'custom',
        path: ['options'],
        message: 'A list needs at least two choices',
      })
    }
  })

export type ProductFieldInput = z.infer<typeof productFieldSchema>

/** Two columns with the same heading cannot be told apart in the list. */
export const isFieldNameTaken = (
  fields: Pick<ProductField, 'id' | 'name'>[],
  name: string,
  exceptId?: string,
) => {
  const wanted = name.trim().toLowerCase()
  return fields.some((f) => f.id !== exceptId && f.name.trim().toLowerCase() === wanted)
}
