import { describe, expect, it } from 'vitest'
import { generateBarcode, generateSku } from './codes'

describe('generateSku', () => {
  it('carries on from the highest number in the catalogue', () => {
    expect(generateSku(['SKU-00001', 'SKU-00042', 'AKC-9'])).toBe('SKU-00043')
  })

  it('starts at one when nothing is numbered that way', () => {
    expect(generateSku([])).toBe('SKU-00001')
  })

  it('appends the side, so a left and a right never share a code', () => {
    expect(generateSku(['SKU-00007'], 'Left')).toBe('SKU-00008-L')
    expect(generateSku(['SKU-00007'], 'Right')).toBe('SKU-00008-R')
  })

  it('skips a code somebody has already typed by hand', () => {
    expect(generateSku(['SKU-00002', 'sku-00003'])).toBe('SKU-00004')
  })
})

describe('generateBarcode', () => {
  const checkDigit = (barcode: string) => {
    const sum = [...barcode.slice(0, 12)].reduce(
      (total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 1 : 3),
      0,
    )
    return String((10 - (sum % 10)) % 10)
  }

  it('is a valid EAN-13 in the range shops are given for their own use', () => {
    const barcode = generateBarcode([], 123_456_789)
    expect(barcode).toHaveLength(13)
    expect(barcode.startsWith('200')).toBe(true)
    expect(barcode.at(-1)).toBe(checkDigit(barcode))
  })

  it('never hands out one the catalogue already holds', () => {
    const first = generateBarcode([], 123_456_789)
    expect(generateBarcode([first], 123_456_789)).not.toBe(first)
  })
})
