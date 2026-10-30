import { describe, expect, it } from 'vitest'
import { formatTRY, parseAmount, toInputString } from './money'

describe('parseAmount', () => {
  it.each([
    ['1.250,50', 125050],
    ['1250,50', 125050],
    ['1250.50', 125050],
    ['1250', 125000],
    ['1.250', 125000],
    ['1.250.000', 125000000],
    ['0,5', 50],
    ['₺ 1.250', 125000],
    [' 12,3 ', 1230],
    ['0', 0],
  ])('%s → %i', (s, v) => expect(parseAmount(s)).toBe(v))

  it.each(['', 'abc', '12,345', '1,250,50', '-5', '1.25.0', '1,2.3', '12.345,6.7'])(
    '%s → null',
    (s) => expect(parseAmount(s)).toBeNull(),
  )
})

describe('format', () => {
  it('formatTRY', () => {
    expect(formatTRY(125050).replace(/\s/g, '')).toBe('₺1.250,50')
  })
  it('toInputString', () => {
    expect(toInputString(125050)).toBe('1250,50')
    expect(toInputString(125000)).toBe('1250')
    expect(toInputString(5)).toBe('0,05')
    expect(toInputString(-1500)).toBe('-15')
  })
  it('round trip', () => {
    for (const v of [1, 99, 100, 123456, 100000001]) expect(parseAmount(toInputString(v))).toBe(v)
  })
})
