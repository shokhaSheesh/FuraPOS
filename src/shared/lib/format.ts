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

export const formatMoney = (value: number) => money.format(value)
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
