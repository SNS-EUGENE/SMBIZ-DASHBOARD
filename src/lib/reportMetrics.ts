import { EQUIPMENT_TYPES } from '../constants'
import { SURVEY_CATEGORY_ORDER } from '../constants/survey'
import { getBusinessDaysInMonth, toMonthKey } from './dateUtils'
import type {
  EquipmentType,
  ReservationAnalyticsRecord,
  ReservationStatus,
  SatisfactionSurvey,
  SurveyCategoryKey,
} from '../types'

export type UtilizationMode = 'report' | 'legacy'

export const REPORT_EQUIPMENT_ORDER: EquipmentType[] = [
  'XXL',
  'XL',
  '알파테이블',
  '알파데스크',
  'AS360',
  'MICRO',
  'Compact',
]

export const REPORT_EQUIPMENT_LABELS: Record<EquipmentType, string> = {
  XXL: '알파스튜디오 XXL',
  XL: '알파샷 XL PRO',
  알파테이블: '알파 테이블',
  알파데스크: '알파 데스크',
  AS360: '알파샷 360',
  MICRO: '알파샷 MICRO',
  Compact: '알파스튜디오 COMPACT',
}

export const REPORT_INDUSTRY_ORDER = ['주얼리', '수제화', '기계금속', '의류봉제', '인쇄', '기타'] as const

export interface EquipmentUsageRow {
  equipmentType: EquipmentType
  equipmentLabel: string
  reservationCount: number
  uniqueCompanies: number
  activeDays: number
  utilizationRate: number
  operationHours: number
}

export interface EquipmentUsageSummary {
  rows: EquipmentUsageRow[]
  averageRow: {
    reservationCount: number
    uniqueCompanies: number
    activeDays: number
    utilizationRate: number
    operationHours: number
  }
  workingDays: number
  usedEquipmentCount: number
  totalOperationHours: number
  totalEquipmentReservations: number
  overallUtilizationRate: number
}

export interface IndustryUsageRow {
  industry: (typeof REPORT_INDUSTRY_ORDER)[number]
  monthlyCompanies: number
  cumulativeCompanies: number
  shareRate: number
  /** 중복 포함 이용 건수 (예약 건수 기준) */
  monthlyUsageCount: number
  cumulativeUsageCount: number
}

export interface ShotStats {
  monthly2d: number
  monthly3d: number
  monthlyVideo: number
  ytd2d: number
  ytd3d: number
  ytdVideo: number
  monthlyCompanies: number
  ytdCompanies: number
  monthly2dPerCompany: number
  monthly3dPerCompany: number
  monthlyVideoPerCompany: number
  ytd2dPerCompany: number
  ytd3dPerCompany: number
  ytdVideoPerCompany: number
}

export interface TopCompanyRow {
  rank: number
  companyId: string
  companyName: string
  industry: string
  reservationCount: number
  newcomer: '신규' | '기존'
}

export interface SurveyStatsSummary {
  totalTargets: number
  totalResponses: number
  responseRate: number
  averageRating: number
  categoryAverages: Partial<Record<SurveyCategoryKey, number>>
  ratingDistribution: Record<number, number>
  referralDistribution: Record<string, number>
  benefitsDistribution: Record<string, number>
  recentFeedbacks: Array<{
    id: string
    submittedAt: string | null
    comment: string | null
    improvement: string | null
    feedbackStatus: string | null
  }>
}

export interface MonthlyComparisonRow {
  monthKey: string
  totalBookings: number
  activeBookings: number
  confirmedBookings: number
  cancelledBookings: number
  uniqueCompanies: number
  businessDays: number
  usageDays: number
  utilizationRate: number
  operationHours: number
  equipmentReservationCount: number
}

const BASE_ACTIVE_STATUSES: ReservationStatus[] = ['pending', 'confirmed', 'completed']

const safeRate = (numerator: number, denominator: number): number => {
  if (denominator <= 0) return 0
  return (numerator / denominator) * 100
}

const normalizeIndustry = (industry?: string): (typeof REPORT_INDUSTRY_ORDER)[number] => {
  const value = (industry || '').trim()
  if (!value) return '기타'
  if (value.includes('주얼')) return '주얼리'
  if (value.includes('수제화')) return '수제화'
  if (value.includes('기계') || value.includes('금속')) return '기계금속'
  if (value.includes('의류') || value.includes('봉제')) return '의류봉제'
  if (value.includes('인쇄')) return '인쇄'
  return '기타'
}

export const filterActiveReservations = (
  reservations: ReservationAnalyticsRecord[],
  includeNoShow: boolean
): ReservationAnalyticsRecord[] => {
  const statuses = includeNoShow
    ? [...BASE_ACTIVE_STATUSES, 'no_show' as ReservationStatus]
    : BASE_ACTIVE_STATUSES
  const set = new Set<ReservationStatus>(statuses)
  return reservations.filter((r) => set.has(r.status))
}

/** 촬영 실적 → 가동시간 환산 (기존 방식 엑셀 공식) */
const computeLegacyHours = (r: ReservationAnalyticsRecord): number =>
  (r.work_2d || 0) / 12 + (r.work_3d || 0) / 2 + (r.work_video || 0) / 2

export const computeEquipmentUsageSummary = (
  reservations: ReservationAnalyticsRecord[],
  operatingDays: number,
  mode: UtilizationMode
): EquipmentUsageSummary => {
  // 가동일 = 장비가 실제 가동된 유니크 날짜 수
  const workingDays = new Set(
    reservations
      .filter((r) => r.equipment_types && r.equipment_types.length > 0)
      .map((r) => r.reservation_date)
  ).size

  const rows = REPORT_EQUIPMENT_ORDER.map<EquipmentUsageRow>((equipment) => {
    const matched = reservations.filter((r) => r.equipment_types?.includes(equipment))
    const reservationCount = matched.length
    const uniqueCompanies = new Set(matched.map((r) => r.company_id)).size
    const activeDays = new Set(matched.map((r) => r.reservation_date)).size

    // 가동시간: 결과보고=슬롯×4h, 기존방식=촬영실적 환산
    const operationHours = mode === 'report'
      ? reservationCount * 4
      : matched.reduce((sum, r) => sum + computeLegacyHours(r), 0)

    // 장비별 가동률: 결과보고=예약횟수/운영일, 기존방식=가동시간/(워킹데이×8)
    const utilizationRate =
      mode === 'report'
        ? safeRate(reservationCount, operatingDays)
        : safeRate(operationHours, workingDays * 8)

    return {
      equipmentType: equipment,
      equipmentLabel: REPORT_EQUIPMENT_LABELS[equipment],
      reservationCount,
      uniqueCompanies,
      activeDays,
      utilizationRate,
      operationHours,
    }
  })

  const rowCount = rows.length || 1
  // 결과보고: 장비별 합산 (장비마다 4h씩 독립 가동)
  // 기존방식: 전체 촬영수를 먼저 합산 후 환산 (Σ2D/12 + Σ3D/2 + Σ동영상/2)
  const withEquipment = reservations.filter((r) => r.equipment_types && r.equipment_types.length > 0)
  const totalOperationHours = mode === 'report'
    ? rows.reduce((sum, row) => sum + row.operationHours, 0)
    : (() => {
        const sum2d = withEquipment.reduce((s, r) => s + (r.work_2d || 0), 0)
        const sum3d = withEquipment.reduce((s, r) => s + (r.work_3d || 0), 0)
        const sumVideo = withEquipment.reduce((s, r) => s + (r.work_video || 0), 0)
        return sum2d / 12 + sum3d / 2 + sumVideo / 2
      })()
  const totalEquipmentReservations = rows.reduce((sum, row) => sum + row.reservationCount, 0)
  const usedEquipmentCount = rows.filter((row) => row.reservationCount > 0).length

  const averageRow = {
    reservationCount: rows.reduce((sum, row) => sum + row.reservationCount, 0) / rowCount,
    uniqueCompanies: rows.reduce((sum, row) => sum + row.uniqueCompanies, 0) / rowCount,
    activeDays: rows.reduce((sum, row) => sum + row.activeDays, 0) / rowCount,
    utilizationRate: rows.reduce((sum, row) => sum + row.utilizationRate, 0) / rowCount,
    operationHours: rows.reduce((sum, row) => sum + row.operationHours, 0) / rowCount,
  }

  // 전체 가동률
  const overallUtilizationRate =
    mode === 'report'
      // 결과보고: 가동일 / 운영일 × 100
      ? safeRate(workingDays, operatingDays)
      // 기존방식: (가동시간합 / (워킹데이 × 8)) / 사용장비수 × 100
      : usedEquipmentCount > 0
        ? safeRate(totalOperationHours, workingDays * 8) / usedEquipmentCount
        : 0

  return {
    rows,
    averageRow,
    workingDays,
    usedEquipmentCount,
    totalOperationHours,
    totalEquipmentReservations,
    overallUtilizationRate,
  }
}

export const computeIndustryUsageRows = (
  monthlyReservations: ReservationAnalyticsRecord[],
  ytdReservations: ReservationAnalyticsRecord[]
): IndustryUsageRow[] => {
  const monthlyUniqueMap = new Map<string, Set<string>>()
  const ytdUniqueMap = new Map<string, Set<string>>()
  const monthlyCountMap = new Map<string, number>()
  const ytdCountMap = new Map<string, number>()
  for (const industry of REPORT_INDUSTRY_ORDER) {
    monthlyUniqueMap.set(industry, new Set())
    ytdUniqueMap.set(industry, new Set())
    monthlyCountMap.set(industry, 0)
    ytdCountMap.set(industry, 0)
  }

  monthlyReservations.forEach((r) => {
    const ind = normalizeIndustry(r.industry)
    monthlyUniqueMap.get(ind)?.add(r.company_id)
    monthlyCountMap.set(ind, (monthlyCountMap.get(ind) || 0) + 1)
  })
  ytdReservations.forEach((r) => {
    const ind = normalizeIndustry(r.industry)
    ytdUniqueMap.get(ind)?.add(r.company_id)
    ytdCountMap.set(ind, (ytdCountMap.get(ind) || 0) + 1)
  })

  const totalMonthlyUsage = monthlyReservations.length

  return REPORT_INDUSTRY_ORDER.map((industry) => {
    const monthlyCompanies = monthlyUniqueMap.get(industry)?.size || 0
    const cumulativeCompanies = ytdUniqueMap.get(industry)?.size || 0
    const monthlyUsageCount = monthlyCountMap.get(industry) || 0
    const cumulativeUsageCount = ytdCountMap.get(industry) || 0
    return {
      industry,
      monthlyCompanies,
      cumulativeCompanies,
      monthlyUsageCount,
      cumulativeUsageCount,
      shareRate: safeRate(monthlyUsageCount, totalMonthlyUsage),
    }
  })
}

export const computeShotStats = (
  monthlyReservations: ReservationAnalyticsRecord[],
  ytdReservations: ReservationAnalyticsRecord[]
): ShotStats => {
  const monthly2d = monthlyReservations.reduce((sum, r) => sum + (r.work_2d || 0), 0)
  const monthly3d = monthlyReservations.reduce((sum, r) => sum + (r.work_3d || 0), 0)
  const monthlyVideo = monthlyReservations.reduce((sum, r) => sum + (r.work_video || 0), 0)
  const ytd2d = ytdReservations.reduce((sum, r) => sum + (r.work_2d || 0), 0)
  const ytd3d = ytdReservations.reduce((sum, r) => sum + (r.work_3d || 0), 0)
  const ytdVideo = ytdReservations.reduce((sum, r) => sum + (r.work_video || 0), 0)

  const monthlyCompanies = new Set(monthlyReservations.map((r) => r.company_id)).size
  const ytdCompanies = new Set(ytdReservations.map((r) => r.company_id)).size

  return {
    monthly2d,
    monthly3d,
    monthlyVideo,
    ytd2d,
    ytd3d,
    ytdVideo,
    monthlyCompanies,
    ytdCompanies,
    monthly2dPerCompany: monthlyCompanies > 0 ? monthly2d / monthlyCompanies : 0,
    monthly3dPerCompany: monthlyCompanies > 0 ? monthly3d / monthlyCompanies : 0,
    monthlyVideoPerCompany: monthlyCompanies > 0 ? monthlyVideo / monthlyCompanies : 0,
    ytd2dPerCompany: ytdCompanies > 0 ? ytd2d / ytdCompanies : 0,
    ytd3dPerCompany: ytdCompanies > 0 ? ytd3d / ytdCompanies : 0,
    ytdVideoPerCompany: ytdCompanies > 0 ? ytdVideo / ytdCompanies : 0,
  }
}

export const computeTopCompanies = (
  monthlyReservations: ReservationAnalyticsRecord[],
  allKnownReservations: ReservationAnalyticsRecord[],
  selectedYear: number,
  selectedMonth: number,
  limit = 5
): TopCompanyRow[] => {
  // 신규기업 판정: 해당 월이 최초 예약인 기업
  const firstDateMap = new Map<string, string>()
  allKnownReservations.forEach((r) => {
    const existing = firstDateMap.get(r.company_id)
    if (!existing || r.reservation_date < existing) {
      firstDateMap.set(r.company_id, r.reservation_date)
    }
  })
  const selectedMonthKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`

  const map = new Map<string, Omit<TopCompanyRow, 'rank'>>()
  monthlyReservations.forEach((r) => {
    const existing = map.get(r.company_id)
    if (existing) {
      existing.reservationCount += 1
      return
    }
    const first = firstDateMap.get(r.company_id)
    const isNew = first ? first.slice(0, 7) === selectedMonthKey : false
    map.set(r.company_id, {
      companyId: r.company_id,
      companyName: r.company_name || '미지정',
      industry: normalizeIndustry(r.industry),
      reservationCount: 1,
      newcomer: isNew ? '신규' : '기존',
    })
  })

  return [...map.values()]
    .sort((a, b) => b.reservationCount - a.reservationCount)
    .slice(0, limit)
    .map((item, index) => ({
      rank: index + 1,
      ...item,
    }))
}

export const computeSurveyStats = (
  surveys: SatisfactionSurvey[],
  totalTargets: number
): SurveyStatsSummary => {
  const submitted = surveys.filter((s) => !!s.submitted_at)

  // 카테고리 평균: 현재 설문 키 우선, 데이터 없으면 레거시 키 fallback
  const categoryAverages: Partial<Record<SurveyCategoryKey, number>> = {}
  SURVEY_CATEGORY_ORDER.forEach((key) => {
    const values = submitted
      .map((s) => s.category_ratings?.[key])
      .filter((v): v is number => typeof v === 'number')
    if (values.length > 0) {
      categoryAverages[key] = values.reduce((sum, value) => sum + value, 0) / values.length
    }
  })

  // 현재 키로 데이터 없으면 레거시 키 자동 탐지
  if (Object.keys(categoryAverages).length === 0) {
    const allKeys = new Set<string>()
    submitted.forEach((s) => {
      if (s.category_ratings) {
        Object.keys(s.category_ratings).forEach((k) => allKeys.add(k))
      }
    })
    allKeys.forEach((key) => {
      const values = submitted
        .map((s) => s.category_ratings?.[key as SurveyCategoryKey])
        .filter((v): v is number => typeof v === 'number')
      if (values.length > 0) {
        categoryAverages[key as SurveyCategoryKey] =
          values.reduce((sum, v) => sum + v, 0) / values.length
      }
    })
  }

  let scoreSum = 0
  let scoreCount = 0
  submitted.forEach((s) => {
    if (s.category_ratings) {
      SURVEY_CATEGORY_ORDER.forEach((key) => {
        const value = s.category_ratings?.[key]
        if (typeof value === 'number') {
          scoreSum += value
          scoreCount += 1
        }
      })
    } else if (typeof s.overall_rating === 'number') {
      scoreSum += s.overall_rating
      scoreCount += 1
    }
  })
  const averageRating = scoreCount > 0 ? scoreSum / scoreCount : 0

  const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  submitted.forEach((s) => {
    const value = s.overall_rating
    if (typeof value === 'number' && value >= 1 && value <= 5) {
      ratingDistribution[Math.round(value)] += 1
    }
  })

  // 스튜디오 경로 / 도움 부분 분포 (improvement_request JSON 파싱, string|string[] 하위호환)
  const referralDistribution: Record<string, number> = {}
  const benefitsDistribution: Record<string, number> = {}
  submitted.forEach((s) => {
    if (!s.improvement_request) return
    try {
      const parsed = JSON.parse(s.improvement_request) as Record<string, unknown>
      const referrals = Array.isArray(parsed.studio_referral)
        ? parsed.studio_referral as string[]
        : parsed.studio_referral ? [parsed.studio_referral as string] : []
      referrals.forEach((r) => {
        referralDistribution[r] = (referralDistribution[r] || 0) + 1
      })
      const benefitsList = Array.isArray(parsed.benefits)
        ? parsed.benefits as string[]
        : parsed.benefits ? [parsed.benefits as string] : []
      benefitsList.forEach((b) => {
        benefitsDistribution[b] = (benefitsDistribution[b] || 0) + 1
      })
    } catch {
      // 레거시 JSON 무시
    }
  })

  const recentFeedbacks = [...submitted]
    .filter((s) => !!s.comment || !!s.improvement_request)
    .sort((a, b) => (b.submitted_at || '').localeCompare(a.submitted_at || ''))
    .slice(0, 8)
    .map((s) => ({
      id: s.id,
      submittedAt: s.submitted_at,
      comment: s.comment,
      improvement: s.improvement_request,
      feedbackStatus: s.feedback_status,
    }))

  return {
    totalTargets,
    totalResponses: submitted.length,
    responseRate: safeRate(submitted.length, totalTargets),
    averageRating,
    categoryAverages,
    ratingDistribution,
    referralDistribution,
    benefitsDistribution,
    recentFeedbacks,
  }
}

// improvement_request JSON → 사람이 읽을 수 있는 텍스트로 변환
const IMPROVEMENT_LABELS: Record<string, string> = {
  studio_referral: '스튜디오 경로',
  studio_referral_other: '기타 경로',
  benefits: '도움이 된 부분',
  overall_reason: '만족도 이유',
  equipment_improvement: '시설/장비 보완',
  booking_improvement: '예약 프로세스 개선',
  recommendation: '추천 의향',
  recommendation_reason: '추천 이유',
  reuse_intention: '재이용 의향',
}

export const computeCategoryDistribution = (
  surveys: SatisfactionSurvey[]
): Record<string, Record<number, number>> => {
  const submitted = surveys.filter((s) => !!s.submitted_at)
  const dist: Record<string, Record<number, number>> = {}
  SURVEY_CATEGORY_ORDER.forEach((key) => {
    dist[key] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  })
  submitted.forEach((s) => {
    if (!s.category_ratings) return
    SURVEY_CATEGORY_ORDER.forEach((key) => {
      const v = s.category_ratings?.[key]
      if (typeof v === 'number' && v >= 1 && v <= 5) {
        dist[key][Math.round(v)]++
      }
    })
  })
  return dist
}

export const parseImprovementText = (value: string | null): string | null => {
  if (!value) return null

  try {
    const parsed = JSON.parse(value) as Record<string, unknown>
    if (parsed && typeof parsed === 'object') {
      const segments = Object.entries(parsed)
        .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '' &&
          !(Array.isArray(v) && v.length === 0))
        .map(([k, v]) => {
          const label = IMPROVEMENT_LABELS[k] || k
          const display = (k === 'recommendation' || k === 'reuse_intention')
            ? (v === 'yes' ? '있다' : '없다')
            : Array.isArray(v) ? v.join(', ') : String(v)
          return `${label} : ${display}`
        })
      if (segments.length > 0) return segments.join(' / ')
    }
  } catch {
    // JSON 형식이 아니면 원문 그대로 사용
  }

  return value
}

export const computeMonthlyComparisonRows = (
  allYearReservations: ReservationAnalyticsRecord[],
  year: number,
  mode: UtilizationMode,
  includeNoShow: boolean,
  operatingDaysMap?: Map<string, number>
): MonthlyComparisonRow[] => {
  const rows: MonthlyComparisonRow[] = []

  for (let month = 1; month <= 12; month++) {
    const key = `${year}-${String(month).padStart(2, '0')}`
    const monthAll = allYearReservations.filter((r) => toMonthKey(r.reservation_date) === key)
    const monthActive = filterActiveReservations(monthAll, includeNoShow)
    const operatingDays = operatingDaysMap?.get(key) ?? getBusinessDaysInMonth(year, month)
    const summary = computeEquipmentUsageSummary(monthActive, operatingDays, mode)

    rows.push({
      monthKey: key,
      totalBookings: monthAll.length,
      activeBookings: monthActive.length,
      confirmedBookings: monthAll.filter((r) => r.status === 'confirmed' || r.status === 'completed').length,
      cancelledBookings: monthAll.filter((r) => r.status === 'cancelled').length,
      uniqueCompanies: new Set(monthActive.map((r) => r.company_id)).size,
      businessDays: operatingDays,
      usageDays: summary.workingDays,
      utilizationRate: summary.overallUtilizationRate,
      operationHours: summary.totalOperationHours,
      equipmentReservationCount: summary.totalEquipmentReservations,
    })
  }

  return rows
}
