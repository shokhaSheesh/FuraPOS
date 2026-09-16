import { describe, expect, it } from 'vitest'
import { guessField, parseCurrency, parseNumber } from './importFields'

describe('guessing what a supplier’s column holds', () => {
  const guess = (heading: string, sample = '') => guessField(heading, sample)

  it('tells the two prices apart', () => {
    // "Продажная цена" contains "цена", so a naive order reads the sale price
    // as the supplier's and every margin in the system is then wrong.
    expect(guess('Продажная цена')).toBe('salePrice')
    expect(guess('Цена поставщика')).toBe('price')
    expect(guess('Цена')).toBe('price')
  })

  it('ignores the mobile SKU rather than mapping it over the real one', () => {
    // OX exports both; the client cut the mobile one. Mapping both onto SKU
    // would let the last column win and quietly change what rows match on.
    expect(guess('Артикул')).toBe('sku')
    expect(guess('Артикул моб')).toBe('ignore')
  })

  it('tells a supplier from the brand of the product', () => {
    expect(guess('Поставщик')).toBe('supplier')
    expect(guess('Бренд товара')).toBe('manufacturer')
  })

  it('reads the headings in either language', () => {
    expect(guess('Штрих-код')).toBe('barcode')
    expect(guess('Barcode')).toBe('barcode')
    expect(guess('Кол-во')).toBe('quantity')
    expect(guess('Quantity')).toBe('quantity')
    expect(guess('Название продукта')).toBe('productName')
    expect(guess('Название вариации продукта')).toBe('variationName')
  })

  it('guesses nothing from a heading it does not know', () => {
    expect(guess('Сезон')).toBe('ignore')
    expect(guess('Пол')).toBe('ignore')
  })

  it('reads an unlabelled column of digits as a quantity, but never as an identifier', () => {
    expect(guess('', '12')).toBe('quantity')
    expect(guess('', 'Filter')).toBe('ignore')
  })
})

describe('reading numbers and currencies out of cells', () => {
  it('takes a comma or a dot as the decimal point', () => {
    expect(parseNumber('120,50')).toBe(120.5)
    expect(parseNumber('120.50')).toBe(120.5)
    expect(parseNumber('12 500,50')).toBe(12500.5)
    expect(parseNumber('12,500.50')).toBe(12500.5)
  })

  it('is null for a cell that is not a number', () => {
    expect(parseNumber('')).toBeNull()
    expect(parseNumber('n/a')).toBeNull()
  })

  it('reads a currency however it was written', () => {
    expect(parseCurrency('USD')).toBe('USD')
    expect(parseCurrency('$')).toBe('USD')
    expect(parseCurrency('сум')).toBe('UZS')
    expect(parseCurrency('UZS')).toBe('UZS')
    expect(parseCurrency('')).toBeNull()
  })
})
