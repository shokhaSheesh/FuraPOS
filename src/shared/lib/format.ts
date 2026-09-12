/**
 * Locale/currency are placeholders until the target market is confirmed.
 * Every screen must format through these helpers so switching is one edit.
 */
export const LOCALE = 'ru-RU'
export const CURRENCY = 'UZS'

const money = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: CURRENCY,
  maximumFractionDigits: 0,
})

const compactMoney = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: CURRENCY,
  notation: 'compact',
  maximumFractionDigits: 1,
})

const number = new Intl.NumberFormat(LOCALE)
const percent = new Intl.NumberFormat(LOCALE, {
  style: 'percent',
  maximumFractionDigits: 1,
})

const compactNumber = new Intl.NumberFormat(LOCALE, {
  notation: 'compact',
  maximumFractionDigits: 1,
})

export const formatMoney = (value: number) => money.format(value)

/*
 * The same thing in a stated currency. `formatMoney` is the house currency and
 * stays the default everywhere; this exists because a supplier's own catalogue
 * is priced in theirs, and rendering a USD price through the UZS formatter
 * would read as a plausible number that is wrong by four orders of magnitude.
 */
const moneyIn = new Map<string, Intl.NumberFormat>()

export const formatMoneyIn = (value: number, currency: string) => {
  if (currency === CURRENCY) return money.format(value)
  let formatter = moneyIn.get(currency)
  if (!formatter) {
    formatter = new Intl.NumberFormat(LOCALE, {
      style: 'currency',
      currency,
      // Foreign prices are quoted to the cent; ours are whole sums.
      maximumFractionDigits: 2,
    })
    moneyIn.set(currency, formatter)
  }
  return formatter.format(value)
}
/** Axis ticks: the unit is stated once on the chart, never on every tick. */
export const formatNumberCompact = (value: number) => compactNumber.format(value)
export const formatMoneyCompact = (value: number) => compactMoney.format(value)
export const formatNumber = (value: number) => number.format(value)
/** Takes a ratio: 0.125 -> "12,5 %" */
export const formatPercent = (value: number) => percent.format(value)

const dateFmt = new Intl.DateTimeFormat(LOCALE, { dateStyle: 'medium' })
const dateTimeFmt = new Intl.DateTimeFormat(LOCALE, {
  dateStyle: 'medium',
  timeStyle: 'short',
})

export const formatDate = (value: string | Date) => dateFmt.format(new Date(value))
export const formatDateTime = (value: string | Date) => dateTimeFmt.format(new Date(value))
