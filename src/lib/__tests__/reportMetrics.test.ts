import { describe, it, expect } from 'vitest'
import {
  filterActiveReservations,
  computeEquipmentUsageSummary,
  computeShotStats,
  computeSurveyStats,
  computeTopCompanies,
} from '../reportMetrics'
import type { ReservationAnalyticsRecord, SatisfactionSurvey } from '../../types'

const makeReservation = (
  overrides: Partial<ReservationAnalyticsRecord> = {}
): ReservationAnalyticsRecord => ({
  id: 'r1',
  company_id: 'c1',
  reservation_date: '2026-01-15',
  time_slot: 'morning',
  status: 'confirmed',
  attendees: 2,
  is_training: false,
  is_seminar: false,
  work_2d: 120,
  work_3d: 60,
  work_video: 0,
  notes: null,
  equipment_types: ['XL'],
  ...overrides,
})

describe('filterActiveReservations', () => {
  const reservations = [
    makeReservation({ id: '1', status: 'confirmed' }),
    makeReservation({ id: '2', status: 'cancelled' }),
    makeReservation({ id: '3', status: 'completed' }),
    makeReservation({ id: '4', status: 'no_show' }),
    makeReservation({ id: '5', status: 'pending' }),
  ]

  it('excludes cancelled and no_show by default', () => {
    const result = filterActiveReservations(reservations, false)
    expect(result).toHaveLength(3)
    const statuses = result.map((r) => r.status)
    expect(statuses).toContain('confirmed')
    expect(statuses).toContain('completed')
    expect(statuses).toContain('pending')
    expect(statuses).not.toContain('cancelled')
    expect(statuses).not.toContain('no_show')
  })

  it('includes no_show when flag is true', () => {
    const result = filterActiveReservations(reservations, true)
    expect(result).toHaveLength(4)
    expect(result.map((r) => r.status)).toContain('no_show')
  })

  it('always excludes cancelled', () => {
    const result = filterActiveReservations(reservations, true)
    expect(result.map((r) => r.status)).not.toContain('cancelled')
  })

  it('handles empty array', () => {
    expect(filterActiveReservations([], false)).toEqual([])
  })
})

describe('computeEquipmentUsageSummary', () => {
  it('returns zero utilization for empty reservations', () => {
    const result = computeEquipmentUsageSummary([], 20, 'report')
    expect(result.totalOperationHours).toBe(0)
    expect(result.overallUtilizationRate).toBe(0)
    expect(result.totalEquipmentReservations).toBe(0)
  })

  it('calculates utilization for report mode', () => {
    const reservations = [
      makeReservation({ equipment_types: ['XL'] }),
      makeReservation({ id: 'r2', equipment_types: ['XXL'], reservation_date: '2026-01-16' }),
    ]
    const result = computeEquipmentUsageSummary(reservations, 20, 'report')
    expect(result.totalEquipmentReservations).toBe(2)
    expect(result.totalOperationHours).toBe(8)
    expect(result.overallUtilizationRate).toBeGreaterThan(0)
  })

  it('handles division by zero (operatingDays=0)', () => {
    const reservations = [makeReservation()]
    const result = computeEquipmentUsageSummary(reservations, 0, 'report')
    expect(result.overallUtilizationRate).toBe(0)
  })

  it('handles legacy mode calculation', () => {
    const reservations = [
      makeReservation({ equipment_types: ['XL'] }),
    ]
    const result = computeEquipmentUsageSummary(reservations, 20, 'legacy')
    // Legacy: operationHours / (operatingDays * 8)
    expect(result.overallUtilizationRate).toBeGreaterThan(0)
  })
})

describe('computeShotStats', () => {
  it('sums 2D, 3D, video work separately', () => {
    const monthly = [
      makeReservation({ work_2d: 100, work_3d: 50, work_video: 30 }),
      makeReservation({ id: 'r2', company_id: 'c2', work_2d: 200, work_3d: 0, work_video: 60 }),
    ]
    const result = computeShotStats(monthly, monthly)
    expect(result.monthly2d).toBe(300)
    expect(result.monthly3d).toBe(50)
    expect(result.monthlyVideo).toBe(90)
    expect(result.monthlyCompanies).toBe(2)
    expect(result.monthly2dPerCompany).toBe(150)
    expect(result.monthly3dPerCompany).toBe(25)
    expect(result.monthlyVideoPerCompany).toBe(45)
  })

  it('handles zero companies', () => {
    const result = computeShotStats([], [])
    expect(result.monthly2dPerCompany).toBe(0)
    expect(result.monthly3dPerCompany).toBe(0)
    expect(result.monthlyVideoPerCompany).toBe(0)
  })
})

describe('computeSurveyStats', () => {
  it('returns zeros for empty surveys', () => {
    const result = computeSurveyStats([], 10)
    expect(result.totalTargets).toBe(10)
    expect(result.totalResponses).toBe(0)
    expect(result.responseRate).toBe(0)
    expect(result.averageRating).toBe(0)
  })

  it('calculates response rate correctly', () => {
    const surveys: SatisfactionSurvey[] = [
      {
        id: 's1',
        reservation_id: 'r1',
        submitted_at: '2026-01-15',
        overall_rating: 4,
        category_ratings: {},
        comment: null,
        improvement_request: null,
        privacy_consent: 'Y',
      },
      {
        id: 's2',
        reservation_id: 'r2',
        submitted_at: '2026-01-16',
        overall_rating: 5,
        category_ratings: {},
        comment: 'Great',
        improvement_request: null,
        privacy_consent: 'Y',
      },
    ]
    const result = computeSurveyStats(surveys, 5)
    expect(result.totalResponses).toBe(2)
    expect(result.responseRate).toBe(40)
  })

  it('handles zero totalTargets', () => {
    const result = computeSurveyStats([], 0)
    expect(result.responseRate).toBe(0)
  })
})

describe('computeTopCompanies', () => {
  it('ranks companies by reservation count', () => {
    const monthly = [
      makeReservation({ id: 'r1', company_id: 'c1', company_name: 'A사', reservation_date: '2026-03-05' }),
      makeReservation({ id: 'r2', company_id: 'c1', company_name: 'A사', reservation_date: '2026-03-06' }),
      makeReservation({ id: 'r3', company_id: 'c2', company_name: 'B사', reservation_date: '2026-03-07' }),
    ]
    const result = computeTopCompanies(monthly, monthly, 2026, 3)
    expect(result[0].companyName).toBe('A사')
    expect(result[0].reservationCount).toBe(2)
    expect(result[0].rank).toBe(1)
  })

  it('identifies newcomers by first reservation in month', () => {
    const prevMonth = [
      makeReservation({ id: 'r0', company_id: 'c2', company_name: 'Old사', reservation_date: '2026-02-10' }),
    ]
    const monthly = [
      makeReservation({ id: 'r1', company_id: 'c1', company_name: 'New사', reservation_date: '2026-03-05' }),
      makeReservation({ id: 'r2', company_id: 'c2', company_name: 'Old사', reservation_date: '2026-03-15' }),
    ]
    const allKnown = [...prevMonth, ...monthly]
    const result = computeTopCompanies(monthly, allKnown, 2026, 3)
    const newCompany = result.find((r) => r.companyName === 'New사')
    const oldCompany = result.find((r) => r.companyName === 'Old사')
    expect(newCompany?.newcomer).toBe('신규')
    expect(oldCompany?.newcomer).toBe('기존')
  })

  it('returns empty for no reservations', () => {
    expect(computeTopCompanies([], [], 2026, 1)).toEqual([])
  })
})
