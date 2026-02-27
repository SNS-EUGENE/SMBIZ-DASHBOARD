import { describe, it, expect } from 'vitest'
import {
  getBusinessDaysInMonth,
  getMonthDateRange,
  getMonthDateBounds,
  getYearDateBounds,
  getYearOptions,
  toMonthKey,
} from '../dateUtils'

describe('getBusinessDaysInMonth', () => {
  it('returns correct business days for January 2026', () => {
    const result = getBusinessDaysInMonth(2026, 1)
    expect(result).toBe(22)
  })

  it('returns correct business days for February 2026', () => {
    const result = getBusinessDaysInMonth(2026, 2)
    expect(result).toBe(20)
  })

  it('excludes holidays when provided', () => {
    const holidays = ['2026-01-01', '2026-01-02']
    const withHolidays = getBusinessDaysInMonth(2026, 1, holidays)
    const without = getBusinessDaysInMonth(2026, 1)
    expect(withHolidays).toBe(without - 2)
  })

  it('does not double-count weekend holidays', () => {
    // 2026-01-03 is Saturday
    const holidays = ['2026-01-03']
    const withHoliday = getBusinessDaysInMonth(2026, 1, holidays)
    const without = getBusinessDaysInMonth(2026, 1)
    expect(withHoliday).toBe(without) // Saturday already excluded
  })
})

describe('getMonthDateRange', () => {
  it('returns correct start and end for March', () => {
    const { startDate, endDate } = getMonthDateRange(2026, 3)
    expect(startDate).toBe('2026-03-01')
    expect(endDate).toBe('2026-04-01')
  })

  it('handles December correctly (year rollover)', () => {
    const { startDate, endDate } = getMonthDateRange(2026, 12)
    expect(startDate).toBe('2026-12-01')
    expect(endDate).toBe('2027-01-01')
  })
})

describe('getMonthDateBounds', () => {
  it('returns inclusive start and end for January', () => {
    const { startDate, endDate } = getMonthDateBounds(2026, 1)
    expect(startDate).toBe('2026-01-01')
    expect(endDate).toBe('2026-01-31')
  })

  it('handles February in non-leap year', () => {
    const { endDate } = getMonthDateBounds(2026, 2)
    expect(endDate).toBe('2026-02-28')
  })

  it('handles February in leap year', () => {
    const { endDate } = getMonthDateBounds(2024, 2)
    expect(endDate).toBe('2024-02-29')
  })
})

describe('getYearDateBounds', () => {
  it('returns Jan 1 to Dec 31', () => {
    const { startDate, endDate } = getYearDateBounds(2026)
    expect(startDate).toBe('2026-01-01')
    expect(endDate).toBe('2026-12-31')
  })
})

describe('toMonthKey', () => {
  it('extracts YYYY-MM from date string', () => {
    expect(toMonthKey('2026-03-15')).toBe('2026-03')
  })

  it('handles single digit months', () => {
    expect(toMonthKey('2026-01-01')).toBe('2026-01')
  })
})

describe('getYearOptions', () => {
  it('returns an array of years', () => {
    const options = getYearOptions()
    expect(Array.isArray(options)).toBe(true)
    expect(options.length).toBe(4) // currentYear-2 to currentYear+1
  })

  it('includes current year', () => {
    const currentYear = new Date().getFullYear()
    expect(getYearOptions()).toContain(currentYear)
  })
})
