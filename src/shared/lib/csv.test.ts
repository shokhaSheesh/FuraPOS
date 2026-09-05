import { describe, expect, it } from 'vitest'
import { toCsv } from './csv'

describe('csv', () => {
  it('quotes cells containing a comma, a quote or a newline', () => {
    const csv = toCsv(
      ['a', 'b'],
      [
        ['plain', 'has,comma'],
        ['has"quote', 'has\nnewline'],
      ],
    )
    expect(csv).toBe('a,b\r\nplain,"has,comma"\r\n"has""quote","has\nnewline"')
  })

  it('renders null and undefined as empty, not as the words', () => {
    expect(toCsv(['a', 'b'], [[null, undefined]])).toBe('a,b\r\n,')
  })
})
