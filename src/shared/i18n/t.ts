import { currentLanguage } from './language'
import { ru } from './ru'

/** A translation: one form, or the three Russian plural forms. */
export type Phrase = string | [one: string, few: string, many: string]
export type Dictionary = Record<string, Phrase>

/** English is the source: the key *is* the English text, so it needs no file. */
const DICTIONARIES: Record<string, Dictionary> = { ru }

/**
 * Which of the three Russian forms a number takes: 1 товар, 2 товара,
 * 5 товаров — and 11 товаров, which is why the teens are excluded.
 */
function ruPluralIndex(count: number): 0 | 1 | 2 {
  const n = Math.abs(Math.round(count))
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 0
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 1
  return 2
}

/** A value a sentence leaves a hole for. Nothing renders as nothing. */
export type Param = string | number | null | undefined

const fill = (text: string, params?: Record<string, Param>) =>
  params
    ? text.replace(/\{(\w+)\}/g, (whole, name: string) =>
        name in params ? String(params[name] ?? '') : whole,
      )
    : text

/**
 * The English text, translated into the language on screen.
 *
 * The key is the English sentence itself rather than a made-up id: a string
 * that has not been translated yet still renders as readable English instead
 * of `orders.list.emptyState.title`, and nothing has to be invented to add a
 * new one. Placeholders are named — `t('Only {count} here', { count })`.
 */
export function t(key: string, params?: Record<string, Param>): string {
  const entry = DICTIONARIES[currentLanguage()]?.[key]
  if (entry === undefined) return fill(key, params)
  if (Array.isArray(entry)) {
    const count = Number(params?.count ?? 1)
    return fill(entry[ruPluralIndex(count)] ?? entry[2] ?? key, params)
  }
  return fill(entry, params)
}

/**
 * A noun that agrees with a number: `tn(n, 'product', 'products')`.
 *
 * English picks between the two forms given here; Russian looks the plural up
 * by its English plural — the dictionary holds all three of its forms. The
 * number itself is not included, because it is nearly always formatted
 * separately.
 */
export function tn(count: number, one: string, many: string): string {
  const entry = DICTIONARIES[currentLanguage()]?.[many]
  if (Array.isArray(entry)) return entry[ruPluralIndex(count)] ?? entry[2] ?? many
  if (typeof entry === 'string') return entry
  return count === 1 ? one : many
}
