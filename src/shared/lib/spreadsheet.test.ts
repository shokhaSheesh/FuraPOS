import { describe, expect, it } from 'vitest'
import { columnIndex, detectEncoding, parseCsv, sniffDelimiter } from './spreadsheet'

describe('reading a CSV a supplier sent', () => {
  it('keeps a comma that is inside a product name', () => {
    // The failure this guards against is quiet: an unquoted split turns one
    // column into three and shifts every column after it, which reads as a
    // mapping mistake rather than a parsing one.
    expect(parseCsv('sku,name,qty\nA1,"Filter, oil, HD",5')).toEqual([
      ['sku', 'name', 'qty'],
      ['A1', 'Filter, oil, HD', '5'],
    ])
  })

  it('reads a doubled quote as one quote', () => {
    expect(parseCsv('name\n"Bolt 3"" long"')).toEqual([['name'], ['Bolt 3" long']])
  })

  it('takes either line ending, and counts CRLF once', () => {
    expect(parseCsv('a,b\r\nc,d\re,f\n')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
      ['e', 'f'],
    ])
  })

  it('drops rows that are entirely empty', () => {
    expect(parseCsv('a,b\n,\nc,d')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ])
  })

  it('finds the semicolon a Russian Excel writes', () => {
    // On a locale where the comma is the decimal separator, Excel writes CSV
    // with semicolons. Guessing comma puts the whole row in one column.
    expect(sniffDelimiter('sku;name;price\nA1;Filter;12,50')).toBe(';')
    expect(sniffDelimiter('sku,name,price\nA1,Filter,12.50')).toBe(',')
    expect(sniffDelimiter('sku\tname\tprice')).toBe('\t')
  })
})

describe('spreadsheet cell references', () => {
  it('reads the column letters as base-26 with no zero', () => {
    expect(columnIndex('A1')).toBe(0)
    expect(columnIndex('Z9')).toBe(25)
    // The one everybody gets wrong: Z is 26th, so AA is 27th, not 28th.
    expect(columnIndex('AA1')).toBe(26)
    expect(columnIndex('AB12')).toBe(27)
    expect(columnIndex('BA100')).toBe(52)
  })
})

describe('guessing a CSV’s encoding', () => {
  const bytes = (...values: number[]) => new Uint8Array(values)

  it('trusts a BOM outright', () => {
    expect(detectEncoding(bytes(0xef, 0xbb, 0xbf, 0x61))).toEqual({
      encoding: 'utf-8',
      confidence: 1,
    })
    expect(detectEncoding(bytes(0xff, 0xfe, 0x61, 0x00))).toEqual({
      encoding: 'utf-16le',
      confidence: 1,
    })
  })

  it('reads clean UTF-8 as UTF-8', () => {
    expect(detectEncoding(new TextEncoder().encode('Штрих-код;Артикул')).encoding).toBe('utf-8')
  })

  it('spots the windows-1251 an Excel on a Russian Windows writes', () => {
    // Cyrillic in windows-1251 is single bytes from 0xC0 up. Decoded as UTF-8
    // that is a column of question marks, which reads as a broken export
    // rather than a setting somebody can change.
    const cyrillic = bytes(0xd8, 0xf2, 0xf0, 0xe8, 0xf5, 0x2d, 0xea, 0xee, 0xe4)
    expect(detectEncoding(cyrillic).encoding).toBe('windows-1251')
  })
})
