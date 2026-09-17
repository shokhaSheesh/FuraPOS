/**
 * Filtering a list by its own fields — the logic behind `FilterSearch`.
 *
 * OX's search bar is a field-by-field filter: click it and every field of the
 * page is there to narrow by, and what is applied sits in the bar as chips.
 * This file is the part that does not care what the page lists. A page
 * describes its fields once (how to read each from a row, what kind of value
 * it is), and the same code filters, summarises and stores the result.
 *
 * Applied filters live in the URL as one JSON parameter, so a filtered list
 * survives a refresh and can be sent to someone, like every other list filter.
 */

export type FilterFieldType = 'text' | 'options' | 'range' | 'boolean'

export type FieldValue = string | number | boolean | null | undefined | (string | null)[]

export interface FilterField<T> {
  id: string
  label: string
  type: FilterFieldType
  /** Reads the field from a row. Arrays match if any entry does. */
  get: (row: T) => FieldValue
  /** The choices, for `options`. */
  options?: { value: string; label: string }[]
  /** Text only: offer "exclude", which keeps the rows that do *not* match. */
  excludable?: boolean
  /** Range only: shown after the numbers, e.g. "kg". */
  unit?: string
}

export type FilterValue =
  | { type: 'text'; text: string; exclude?: boolean }
  | { type: 'options'; values: string[] }
  | { type: 'range'; min: number | null; max: number | null }
  | { type: 'boolean'; value: boolean }

export type FilterValues = Record<string, FilterValue>

/** Whether a value actually narrows anything — an empty box is not a filter. */
export function isActive(value: FilterValue | undefined): value is FilterValue {
  if (!value) return false
  switch (value.type) {
    case 'text':
      return terms(value.text).length > 0
    case 'options':
      return value.values.length > 0
    case 'range':
      return value.min !== null || value.max !== null
    case 'boolean':
      return true
  }
}

/** Only the filters that do something, so the URL and the chips stay honest. */
export const activeOnly = (values: FilterValues): FilterValues =>
  Object.fromEntries(Object.entries(values).filter(([, value]) => isActive(value)))

/**
 * Several values in one text box, split on commas, semicolons or new lines —
 * so a column of barcodes pasted from a spreadsheet finds all of them. Spaces
 * are kept: "Fuel pump" is one term, not two.
 */
export const terms = (text: string) =>
  text
    .split(/[,;\n]+/)
    .map((term) => term.trim().toLowerCase())
    .filter(Boolean)

const asList = (raw: FieldValue): string[] =>
  (Array.isArray(raw) ? raw : [raw])
    .filter((entry): entry is string | number | boolean => entry !== null && entry !== undefined)
    .map((entry) => String(entry))

function matchesOne<T>(row: T, field: FilterField<T>, value: FilterValue): boolean {
  const raw = field.get(row)
  switch (value.type) {
    case 'text': {
      const wanted = terms(value.text)
      const hit = asList(raw).some((entry) =>
        wanted.some((term) => entry.toLowerCase().includes(term)),
      )
      return value.exclude ? !hit : hit
    }
    case 'options': {
      const have = asList(raw)
      return value.values.some((wanted) => have.includes(wanted))
    }
    case 'range': {
      if (typeof raw !== 'number') return false
      if (value.min !== null && raw < value.min) return false
      if (value.max !== null && raw > value.max) return false
      return true
    }
    case 'boolean': {
      const have = Array.isArray(raw) ? raw.length > 0 : Boolean(raw)
      return have === value.value
    }
  }
}

/** Keeps the rows that pass every applied filter. Unknown field ids are ignored. */
export function applyFieldFilters<T>(rows: T[], fields: FilterField<T>[], values: FilterValues) {
  const applied = fields.flatMap((field) => {
    const value = values[field.id]
    return isActive(value) && value.type === field.type ? [[field, value] as const] : []
  })
  if (applied.length === 0) return rows
  return rows.filter((row) => applied.every(([field, value]) => matchesOne(row, field, value)))
}

const number = (n: number, unit?: string) => `${n.toLocaleString('ru-RU')}${unit ? ` ${unit}` : ''}`

/** What a chip in the search bar says, e.g. "Make: DAF, MAN" or "Quantity: 5–10". */
export function describe<T>(field: FilterField<T>, value: FilterValue): string {
  switch (value.type) {
    case 'text':
      return `${field.label}${value.exclude ? ' ≠ ' : ': '}${value.text.trim()}`
    case 'options': {
      const names = value.values.map(
        (v) => field.options?.find((option) => option.value === v)?.label ?? v,
      )
      const shown = names.slice(0, 2).join(', ')
      return `${field.label}: ${shown}${names.length > 2 ? ` +${names.length - 2}` : ''}`
    }
    case 'range':
      if (value.min !== null && value.max !== null) {
        return `${field.label}: ${number(value.min)}–${number(value.max, field.unit)}`
      }
      return value.min !== null
        ? `${field.label} ≥ ${number(value.min, field.unit)}`
        : `${field.label} ≤ ${number(value.max!, field.unit)}`
    case 'boolean':
      return `${field.label}: ${value.value ? 'Yes' : 'No'}`
  }
}

/** For the URL: null when nothing is applied, so the parameter disappears. */
export function encodeFilters(values: FilterValues): string | null {
  const active = activeOnly(values)
  return Object.keys(active).length ? JSON.stringify(active) : null
}

/** From the URL. A hand-edited or stale parameter reads as no filters, never a crash. */
export function decodeFilters(raw: unknown): FilterValues {
  if (typeof raw !== 'string' || !raw) return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return activeOnly(
      Object.fromEntries(
        Object.entries(parsed as Record<string, FilterValue>).filter(
          ([, value]) =>
            value &&
            typeof value === 'object' &&
            ['text', 'options', 'range', 'boolean'].includes(value.type),
        ),
      ),
    )
  } catch {
    return {}
  }
}
