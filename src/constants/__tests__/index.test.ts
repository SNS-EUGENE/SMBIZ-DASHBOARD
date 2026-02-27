import { describe, it, expect } from 'vitest'
import { EQUIPMENT_TYPES, CHART_COLORS, RESERVATION_STATUS, EQUIPMENT_STATUS } from '../index'

describe('EQUIPMENT_TYPES', () => {
  it('contains all 7 equipment types', () => {
    expect(EQUIPMENT_TYPES).toHaveLength(7)
  })

  it('includes known types', () => {
    expect(EQUIPMENT_TYPES).toContain('AS360')
    expect(EQUIPMENT_TYPES).toContain('MICRO')
    expect(EQUIPMENT_TYPES).toContain('XL')
    expect(EQUIPMENT_TYPES).toContain('XXL')
    expect(EQUIPMENT_TYPES).toContain('Compact')
    expect(EQUIPMENT_TYPES).toContain('알파데스크')
    expect(EQUIPMENT_TYPES).toContain('알파테이블')
  })
})

describe('CHART_COLORS', () => {
  it('is a non-empty array', () => {
    expect(CHART_COLORS.length).toBeGreaterThan(0)
  })

  it('contains hex color values', () => {
    CHART_COLORS.forEach((color) => {
      expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/)
    })
  })
})

describe('RESERVATION_STATUS', () => {
  it('has all status entries', () => {
    expect(RESERVATION_STATUS.confirmed).toBeDefined()
    expect(RESERVATION_STATUS.pending).toBeDefined()
    expect(RESERVATION_STATUS.completed).toBeDefined()
    expect(RESERVATION_STATUS.cancelled).toBeDefined()
    expect(RESERVATION_STATUS.no_show).toBeDefined()
  })

  it('each status has label and class', () => {
    Object.values(RESERVATION_STATUS).forEach((status) => {
      expect(status.label).toBeDefined()
      expect(typeof status.label).toBe('string')
      expect(status.class).toBeDefined()
      expect(typeof status.class).toBe('string')
    })
  })
})

describe('EQUIPMENT_STATUS', () => {
  it('has active, maintenance, inactive', () => {
    expect(EQUIPMENT_STATUS.active).toBeDefined()
    expect(EQUIPMENT_STATUS.maintenance).toBeDefined()
    expect(EQUIPMENT_STATUS.inactive).toBeDefined()
  })
})
