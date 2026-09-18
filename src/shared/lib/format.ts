import { currentLanguage } from '@/shared/i18n/language'

/**
 * Money, numbers and dates, formatted the way the language on screen writes
 * them. Every screen must format through these helpers.
 *
 * The **currency does not follow the language** — the business keeps its books
 * in UZS whichever language somebody reads the screen in. Only the separators,
 * the month names and the order of a date change.
 */
export const CURRENCY = 'UZS'

const LOCALES: Record<string, string> = { ru: 'ru-RU', en: 'en-GB' }

/** The locale of the language on screen. */
export const locale = () => LOCALES[currentLanguage()] ?? 'ru-RU'

/*
  Formatters are built once per locale and kept, rather than once per module:
  building an `Intl.NumberFormat` is expensive enough to matter in a table of a
  thousand cells, and the language can change while the app is open.
*/
const cache = new Map<string, Intl.NumberFormat | Intl.DateTimeFormat>()

function numberFormat(id: string, options: Intl.NumberFormatOptions) {
  const key = `${locale()}:${id}`
  let formatter = cache.get(key) as Intl.NumberFormat | undefined
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale(), options)
    cache.set(key, formatter)
  }
  return formatter
}

function dateFormat(id: string, options: Intl.DateTimeFormatOptions) {
  const key = `${locale()}:${id}`
  let formatter = cache.get(key) as Intl.DateTimeFormat | undefined
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale(), options)
    cache.set(key, formatter)
  }
  return formatter
}

const MONEY: Intl.NumberFormatOptions = {
  style: 'currency',
  currency: CURRENCY,
  maximumFractionDigits: 0,
}

export const formatMoney = (value: number) => numberFormat('money', MONEY).format(value)

/*
 * The same thing in a stated currency. `formatMoney` is the house currency and
 * stays the default everywhere; this exists because a supplier's own catalogue
 * is priced in theirs, and rendering a USD price through the UZS formatter
 * would read as a plausible number that is wrong by four orders of magnitude.
 */
export const formatMoneyIn = (value: number, currency: string) =>
  currency === CURRENCY
    ? formatMoney(value)
    : numberFormat(`money:${currency}`, {
        style: 'currency',
        currency,
        // Foreign prices are quoted to the cent; ours are whole sums.
        maximumFractionDigits: 2,
      }).format(value)

/** Axis ticks: the unit is stated once on the chart, never on every tick. */
export const formatNumberCompact = (value: number) =>
  numberFormat('compact', { notation: 'compact', maximumFractionDigits: 1 }).format(value)

export const formatMoneyCompact = (value: number) =>
  numberFormat('moneyCompact', { ...MONEY, notation: 'compact', maximumFractionDigits: 1 }).format(
    value,
  )

export const formatNumber = (value: number) => numberFormat('number', {}).format(value)

/** Takes a ratio: 0.125 -> "12,5 %" */
export const formatPercent = (value: number) =>
  numberFormat('percent', { style: 'percent', maximumFractionDigits: 1 }).format(value)

export const formatDate = (value: string | Date) =>
  dateFormat('date', { dateStyle: 'medium' }).format(new Date(value))

export const formatDateTime = (value: string | Date) =>
  dateFormat('dateTime', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
