import { describe, expect, it } from 'vitest'
import { addMonths, daysInMonth, formatMonthTR, monthRange, shiftMonth, formatDayTR, daysBetween } from './dates'

describe('dates', () => {
  it('daysInMonth', () => {
    expect(daysInMonth(2026, 2)).toBe(28)
    expect(daysInMonth(2028, 2)).toBe(29)
    expect(daysInMonth(2026, 12)).toBe(31)
  })
  it('addMonths son güne sabitler', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2026-01-31', 2)).toBe('2026-03-31')
    expect(addMonths('2026-11-15', 3)).toBe('2027-02-15')
    expect(addMonths('2026-03-15', -3)).toBe('2025-12-15')
    expect(addMonths('2026-02-28', 1, 31)).toBe('2026-03-31')
  })
  it('monthRange / shiftMonth', () => {
    expect(monthRange('2026-02')).toEqual(['2026-02-01', '2026-02-28'])
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
  })
  it('formatMonthTR', () => {
    expect(formatMonthTR('2026-10')).toBe('Ekim 2026')
  })
})

describe('formatDayTR', () => {
  it('omits the year in the current year and adds it otherwise', () => {
    expect(formatDayTR('2026-10-30', 2026)).not.toContain('2026')
    expect(formatDayTR('2025-03-05', 2026)).toContain('2025')
    expect(formatDayTR('2025-03-05')).not.toContain('2025')
  })
})

describe('daysBetween', () => {
  it('gün farkını ay ve yıl geçişinde de doğru sayar', () => {
    expect(daysBetween('2026-11-10', '2026-11-24')).toBe(14)
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1)
    expect(daysBetween('2026-11-10', '2026-11-10')).toBe(0)
    expect(daysBetween('2026-11-10', '2026-11-01')).toBe(-9)
  })
})
