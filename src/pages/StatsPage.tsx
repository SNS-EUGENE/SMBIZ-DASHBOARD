import { useState, useEffect, useMemo, useRef, Fragment, type ReactElement } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  BarChart,
  Bar,
} from 'recharts'
import { api } from '../lib/supabase'
import { useToast } from '../components/Toast'
import {
  getBusinessDaysInMonth,
  getMonthDateBounds,
  getYearDateBounds,
  getYearOptions,
  toMonthKey,
} from '../lib/dateUtils'
import { getOperatingDaysForMonth } from '../lib/holidays'
import { fmtNum, fmtPct, fmtPctDiff } from '../lib/utils'
import { CHART_COLORS } from '../constants'
import {
  computeCategoryDistribution,
  computeEquipmentUsageSummary,
  computeIndustryUsageRows,
  computeMonthlyComparisonRows,
  computeShotStats,
  computeSurveyStats,
  computeTopCompanies,
  filterActiveReservations,
  type UtilizationMode,
} from '../lib/reportMetrics'
import {
  SURVEY_CATEGORY_ORDER,
  STUDIO_REFERRAL_OPTIONS,
  STUDIO_BENEFIT_OPTIONS,
  FEEDBACK_STATUS_OPTIONS,
} from '../constants/survey'
import type {
  ReservationAnalyticsRecord,
  ReservationStatus,
  SatisfactionSurvey,
  SurveyCategoryKey,
  FeedbackStatus,
  TimeSlot,
} from '../types'

// --- Tab definitions ---
type StatsTab = 'overview' | 'yoy' | 'industry' | 'companies' | 'survey'

const STATS_TABS: { id: StatsTab; label: string }[] = [
  { id: 'overview', label: '요약' },
  { id: 'yoy', label: '작년대비' },
  { id: 'industry', label: '업종/촬영' },
  { id: 'companies', label: '주요 업체' },
  { id: 'survey', label: '만족도조사' },
]

// --- Helpers ---
const VALID_RESERVATION_STATUSES = new Set<ReservationStatus>([
  'pending',
  'confirmed',
  'cancelled',
  'completed',
  'no_show',
])

const VALID_TIME_SLOTS = new Set<TimeSlot>(['morning', 'afternoon'])

const toNumber = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const toStringOrEmpty = (value: unknown): string => {
  return typeof value === 'string' ? value : ''
}

const toNullableString = (value: unknown): string | null => {
  if (typeof value === 'string') return value
  return null
}

const normalizeReservations = (rows: unknown[]): ReservationAnalyticsRecord[] => {
  return rows.map((raw) => {
    const item = (raw || {}) as Record<string, unknown>
    const statusRaw = toStringOrEmpty(item.status)
    const timeSlotRaw = toStringOrEmpty(item.time_slot)

    const status: ReservationStatus = VALID_RESERVATION_STATUSES.has(statusRaw as ReservationStatus)
      ? (statusRaw as ReservationStatus)
      : 'pending'

    const time_slot: TimeSlot = VALID_TIME_SLOTS.has(timeSlotRaw as TimeSlot)
      ? (timeSlotRaw as TimeSlot)
      : 'morning'

    const equipment_types = Array.isArray(item.equipment_types)
      ? item.equipment_types.filter((eq): eq is string => typeof eq === 'string')
      : []

    return {
      id: toStringOrEmpty(item.id),
      company_id: toStringOrEmpty(item.company_id),
      reservation_date: toStringOrEmpty(item.reservation_date),
      time_slot,
      status,
      attendees: toNumber(item.attendees),
      is_training: Boolean(item.is_training),
      is_seminar: Boolean(item.is_seminar),
      work_2d: toNumber(item.work_2d),
      work_3d: toNumber(item.work_3d),
      work_video: toNumber(item.work_video),
      notes: toNullableString(item.notes),
      company_name: toStringOrEmpty(item.company_name),
      industry: toStringOrEmpty(item.industry),
      representative: toStringOrEmpty(item.representative),
      contact: toStringOrEmpty(item.contact),
      district: toStringOrEmpty(item.district),
      company_created_at: toNullableString(item.company_created_at),
      equipment_types,
    }
  })
}

const formatPercent = fmtPct

// --- Chart styles (dark theme) ---
const chartTooltipStyle: React.CSSProperties = {
  background: 'rgba(20,20,22,0.96)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: '10px',
  fontSize: '12px',
  color: '#F5F5F5',
  padding: '8px 12px',
  boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
}

const chartTooltipLabelStyle: React.CSSProperties = {
  color: '#A8A8A8',
  fontSize: '11px',
  marginBottom: '4px',
}

const chartTooltipItemStyle: React.CSSProperties = {
  color: '#F0F0F0',
  fontSize: '12px',
}

// --- Report labels for survey tab ---
const SURVEY_REPORT_LABELS: Record<string, string> = {
  facility: '본 시설에 대한 전반적인 만족도',
  staff_kindness: '제작실 직원의 친절도',
  staff_expertise: '제작실 직원의 장비 전문성',
  booking: '예약 과정의 프로세스',
  cleanliness: '제작실 청결 상태',
  supplies: '장비/소품의 구성',
}

// --- Sub-components ---
const SummaryCard = ({ title, value, subText }: { title: string; value: string; subText?: string }) => (
  <div className="card p-3">
    <p className="text-xs text-text-tertiary mb-0.5">{title}</p>
    <p className="text-xl font-bold text-text-primary tabular-nums">{value}</p>
    {subText && <p className="text-[11px] text-text-secondary mt-0.5">{subText}</p>}
  </div>
)

const TIME_SLOT_LABEL: Record<string, string> = { morning: '오전', afternoon: '오후' }

interface ReservationInfo {
  company_name?: string
  reservation_date?: string
  time_slot?: string
  industry?: string
  equipment_types?: string[]
}

const FeedbackCard = ({
  survey, saving, reservationInfo, onStatusChange, onNoteSave,
}: {
  survey: SatisfactionSurvey
  saving: boolean
  reservationInfo?: ReservationInfo
  onStatusChange: (id: string, status: FeedbackStatus) => void
  onNoteSave: (id: string, note: string) => void
}) => {
  const [noteText, setNoteText] = useState(survey.feedback_note || '')
  const [showNote, setShowNote] = useState(false)
  const status = survey.feedback_status || 'unreviewed'

  const statusColor: Record<string, string> = {
    unreviewed: 'bg-warning/20 text-warning border-warning/30',
    reviewed: 'bg-primary/20 text-primary border-primary/30',
    action_taken: 'bg-success/20 text-success border-success/30',
  }

  return (
    <div className="p-3 rounded-lg border border-border bg-bg-tertiary/20 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs text-text-tertiary">
          <span>제출일 : {survey.submitted_at ? new Date(survey.submitted_at).toLocaleDateString('ko-KR') : '-'}</span>
          {reservationInfo && (
            <span className="relative group">
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-text-tertiary/20 text-[10px] font-semibold text-text-secondary cursor-help">i</span>
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-3 py-2 rounded-lg bg-bg-primary border border-border shadow-lg text-xs text-text-primary whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                {reservationInfo.company_name && <span className="block font-medium">{reservationInfo.company_name}</span>}
                {reservationInfo.reservation_date && (
                  <span className="block text-text-secondary">
                    {reservationInfo.reservation_date}{reservationInfo.time_slot ? ` ${TIME_SLOT_LABEL[reservationInfo.time_slot] || reservationInfo.time_slot}` : ''}
                  </span>
                )}
                {reservationInfo.industry && <span className="block text-text-tertiary">{reservationInfo.industry}</span>}
                {reservationInfo.equipment_types && reservationInfo.equipment_types.length > 0 && (
                  <span className="block text-text-tertiary">장비 : {reservationInfo.equipment_types.join(', ')}</span>
                )}
              </span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <select value={status} onChange={(e) => onStatusChange(survey.id, e.target.value as FeedbackStatus)} disabled={saving}
            className={`text-[11px] px-2 py-0.5 rounded-md border ${statusColor[status] || ''}`}>
            {FEEDBACK_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <button type="button" onClick={() => setShowNote(!showNote)} className="text-[11px] text-text-tertiary hover:text-text-primary transition-colors">
            {showNote ? '메모 닫기' : '메모'}
          </button>
        </div>
      </div>
      {survey.comment && <p className="text-sm text-text-primary">{survey.comment}</p>}
      {showNote && (
        <div className="pt-2 border-t border-border/50 space-y-2">
          <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="조치 내용, 메모 등" className="input w-full text-xs resize-y min-h-[48px]" rows={2} disabled={saving} />
          <button type="button" onClick={() => onNoteSave(survey.id, noteText)} disabled={saving} className="btn btn-primary text-xs py-1 px-3">
            {saving ? '저장 중...' : '메모 저장'}
          </button>
        </div>
      )}
    </div>
  )
}

const StatsPage = (): ReactElement => {
  const toast = useToast()
  const currentDate = new Date()
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth() + 1)
  const [utilizationMode, setUtilizationMode] = useState<UtilizationMode>('report')
  const [includeNoShow, setIncludeNoShow] = useState<boolean>(false)
  const [activeTab, setActiveTab] = useState<StatsTab>('overview')
  const [excelLoading, setExcelLoading] = useState<boolean>(false)

  const [yearReservations, setYearReservations] = useState<ReservationAnalyticsRecord[]>([])
  const [prevYearReservations, setPrevYearReservations] = useState<ReservationAnalyticsRecord[]>([])
  const [operatingDaysMap, setOperatingDaysMap] = useState<Map<string, number>>(new Map())

  const [loading, setLoading] = useState<boolean>(true)
  const hasLoadedOnce = useRef(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Survey data (for survey tab)
  const [surveyData, setSurveyData] = useState<SatisfactionSurvey[]>([])
  const [surveyLoading, setSurveyLoading] = useState(false)
  const [savingFeedback, setSavingFeedback] = useState<string | null>(null)

  // 공휴일 API 연동 → 전체 운영일수 맵 (YoY 포함 24개월)
  useEffect(() => {
    let cancelled = false
    const loadAllOperatingDays = async () => {
      const map = new Map<string, number>()
      const promises: Promise<void>[] = []
      for (const year of [selectedYear, selectedYear - 1]) {
        for (let month = 1; month <= 12; month++) {
          promises.push(
            getOperatingDaysForMonth(year, month).then((days) => {
              map.set(`${year}-${String(month).padStart(2, '0')}`, days)
            })
          )
        }
      }
      await Promise.all(promises)
      if (!cancelled) setOperatingDaysMap(map)
    }
    loadAllOperatingDays()
    return () => { cancelled = true }
  }, [selectedYear])

  const operatingDays = useMemo(() => {
    if (selectedMonth === 0) {
      let total = 0
      for (let m = 1; m <= 12; m++) {
        const key = `${selectedYear}-${String(m).padStart(2, '0')}`
        total += operatingDaysMap.get(key) ?? getBusinessDaysInMonth(selectedYear, m)
      }
      return total
    }
    const key = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`
    return operatingDaysMap.get(key) ?? getBusinessDaysInMonth(selectedYear, selectedMonth)
  }, [operatingDaysMap, selectedYear, selectedMonth])

  // 연간 데이터 fetch (연도 변경 시에만 재조회)
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setErrorMessage(null)

    const fetchYearData = async () => {
      const [yearResult, prevYearResult] = await Promise.all([
        api.reservations.getAll(getYearDateBounds(selectedYear)),
        api.reservations.getAll(getYearDateBounds(selectedYear - 1)),
      ])
      if (cancelled) return

      const firstError = yearResult.error || prevYearResult.error
      if (firstError) {
        setErrorMessage(`예약 데이터 조회 실패 : ${firstError.message}`)
        setYearReservations([])
        setPrevYearReservations([])
        setLoading(false)
        return
      }

      setYearReservations(normalizeReservations(yearResult.data || []))
      setPrevYearReservations(normalizeReservations(prevYearResult.data || []))
      hasLoadedOnce.current = true
      setLoading(false)
    }

    fetchYearData()
    return () => { cancelled = true }
  }, [selectedYear])

  // 월간 데이터는 연간에서 파생 (월 변경 시 API 호출 없이 즉시 업데이트)
  const monthlyReservations = useMemo(() => {
    if (selectedMonth === 0) return yearReservations
    const key = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`
    return yearReservations.filter((r) => toMonthKey(r.reservation_date) === key)
  }, [yearReservations, selectedYear, selectedMonth])

  // --- Computed data ---
  const activeMonthlyReservations = useMemo(
    () => filterActiveReservations(monthlyReservations, includeNoShow),
    [monthlyReservations, includeNoShow]
  )

  const activeYearReservations = useMemo(
    () => filterActiveReservations(yearReservations, includeNoShow),
    [yearReservations, includeNoShow]
  )

  const ytdReservations = useMemo(
    () => selectedMonth === 0
      ? activeYearReservations
      : activeYearReservations.filter((r) => Number(r.reservation_date.slice(5, 7)) <= selectedMonth),
    [activeYearReservations, selectedMonth]
  )

  const equipmentSummary = useMemo(
    () => computeEquipmentUsageSummary(activeMonthlyReservations, operatingDays, utilizationMode),
    [activeMonthlyReservations, operatingDays, utilizationMode]
  )

  const industryRows = useMemo(
    () => computeIndustryUsageRows(activeMonthlyReservations, ytdReservations),
    [activeMonthlyReservations, ytdReservations]
  )

  const shotStats = useMemo(
    () => computeShotStats(activeMonthlyReservations, ytdReservations),
    [activeMonthlyReservations, ytdReservations]
  )

  const allKnownReservations = useMemo(
    () => [...yearReservations, ...prevYearReservations],
    [yearReservations, prevYearReservations]
  )

  const topCompanies = useMemo(
    () => computeTopCompanies(activeMonthlyReservations, allKnownReservations, selectedYear, selectedMonth || 1),
    [activeMonthlyReservations, allKnownReservations, selectedYear, selectedMonth]
  )

  const monthlyComparisonRows = useMemo(
    () => computeMonthlyComparisonRows(yearReservations, selectedYear, 'report', includeNoShow, operatingDaysMap),
    [yearReservations, selectedYear, includeNoShow, operatingDaysMap]
  )

  const prevYearComparisonRows = useMemo(
    () => computeMonthlyComparisonRows(prevYearReservations, selectedYear - 1, 'report', includeNoShow, operatingDaysMap),
    [prevYearReservations, selectedYear, includeNoShow, operatingDaysMap]
  )

  const selectedMonthCurrent = monthlyComparisonRows[selectedMonth - 1]
  const selectedMonthPrevious = prevYearComparisonRows[selectedMonth - 1]

  const trendData = useMemo(
    () => Array.from({ length: 12 }, (_, index) => {
      const current = monthlyComparisonRows[index]
      const previous = prevYearComparisonRows[index]
      const month = index + 1

      return {
        month: `${month}월`,
        currentUtilization: current?.utilizationRate || 0,
        previousUtilization: previous?.utilizationRate || 0,
        currentReservations: current?.activeBookings || 0,
        previousReservations: previous?.activeBookings || 0,
      }
    }),
    [monthlyComparisonRows, prevYearComparisonRows]
  )

  // Year-level aggregation for "전체" mode (YoY tab)
  const yearCurrentAgg = useMemo(() => {
    const activeMonths = monthlyComparisonRows.filter((r) => r.activeBookings > 0)
    const utilSum = monthlyComparisonRows.reduce((s, r) => s + r.utilizationRate, 0)
    return {
      activeBookings: monthlyComparisonRows.reduce((s, r) => s + r.activeBookings, 0),
      utilizationRate: activeMonths.length > 0 ? utilSum / activeMonths.length : 0,
    }
  }, [monthlyComparisonRows])

  const yearPrevAgg = useMemo(() => {
    const activeMonths = prevYearComparisonRows.filter((r) => r.activeBookings > 0)
    const utilSum = prevYearComparisonRows.reduce((s, r) => s + r.utilizationRate, 0)
    return {
      activeBookings: prevYearComparisonRows.reduce((s, r) => s + r.activeBookings, 0),
      utilizationRate: activeMonths.length > 0 ? utilSum / activeMonths.length : 0,
    }
  }, [prevYearComparisonRows])

  const yoyCurrentUtil = selectedMonth === 0 ? yearCurrentAgg.utilizationRate : (selectedMonthCurrent?.utilizationRate || 0)
  const yoyPrevUtil = selectedMonth === 0 ? yearPrevAgg.utilizationRate : (selectedMonthPrevious?.utilizationRate || 0)
  const utilizationDifference = yoyCurrentUtil - yoyPrevUtil

  const yoyCurrentBookings = selectedMonth === 0 ? yearCurrentAgg.activeBookings : (selectedMonthCurrent?.activeBookings || 0)
  const yoyPrevBookings = selectedMonth === 0 ? yearPrevAgg.activeBookings : (selectedMonthPrevious?.activeBookings || 0)
  const reservationDifference = yoyCurrentBookings - yoyPrevBookings

  const formulaTooltip = utilizationMode === 'legacy'
    ? '장비별 : 가동시간 / (워킹데이 × 8h)\n전체 : (시간합 / 워킹데이×8) / 사용장비수\n시간 = 2D/12 + 3D/2 + 동영상/2'
    : '장비별 : 예약횟수 / 운영일수\n전체 : 가동일 / 운영일'

  // --- Survey tab: fetch surveys ---
  useEffect(() => {
    if (activeTab !== 'survey' || loading) return

    const targetReservations = selectedMonth === 0 ? activeYearReservations : activeMonthlyReservations
    const ids = targetReservations.map((r) => r.id).filter(Boolean)

    if (ids.length === 0) { setSurveyData([]); return }

    let cancelled = false
    setSurveyLoading(true)

    api.surveys.getByReservationIds(ids).then((result) => {
      if (cancelled) return
      setSurveyData(result.data || [])
      setSurveyLoading(false)
    })

    return () => { cancelled = true }
  }, [activeTab, activeMonthlyReservations, activeYearReservations, selectedMonth, loading])

  // Survey computations
  const surveyTargetCount = selectedMonth === 0
    ? activeYearReservations.length
    : activeMonthlyReservations.length

  const surveySummary = useMemo(
    () => computeSurveyStats(surveyData, surveyTargetCount),
    [surveyData, surveyTargetCount]
  )

  // Per-category rating distribution (for report table)
  const categoryDistribution = useMemo(
    () => computeCategoryDistribution(surveyData),
    [surveyData]
  )

  // Feedback items
  const feedbackItems = useMemo(() => {
    return surveyData
      .filter((s) => s.submitted_at && s.comment && s.comment.trim())
      .sort((a, b) => (b.submitted_at || '').localeCompare(a.submitted_at || ''))
  }, [surveyData])

  const feedbackCounts = useMemo(() => {
    const counts = { unreviewed: 0, reviewed: 0, action_taken: 0 }
    feedbackItems.forEach((s) => {
      const status = s.feedback_status || 'unreviewed'
      if (status in counts) counts[status as keyof typeof counts]++
    })
    return counts
  }, [feedbackItems])

  // reservation_id → 예약 정보 lookup map
  const reservationInfoMap = useMemo(() => {
    const map = new Map<string, ReservationInfo>()
    const all = selectedMonth === 0 ? activeYearReservations : activeMonthlyReservations
    all.forEach((r) => {
      map.set(r.id, {
        company_name: r.company_name,
        reservation_date: r.reservation_date,
        time_slot: r.time_slot,
        industry: r.industry,
        equipment_types: r.equipment_types,
      })
    })
    return map
  }, [activeYearReservations, activeMonthlyReservations, selectedMonth])

  const handleFeedbackStatusChange = async (surveyId: string, newStatus: FeedbackStatus) => {
    setSavingFeedback(surveyId)
    const current = surveyData.find((s) => s.id === surveyId)
    const result = await api.surveys.updateFeedback(surveyId, newStatus, current?.feedback_note || null)
    if (!result.error) {
      setSurveyData((prev) =>
        prev.map((s) => s.id === surveyId ? { ...s, feedback_status: newStatus } : s)
      )
    }
    setSavingFeedback(null)
  }

  const handleFeedbackNoteSave = async (surveyId: string, note: string) => {
    setSavingFeedback(surveyId)
    const current = surveyData.find((s) => s.id === surveyId)
    const status = current?.feedback_status || 'reviewed'
    const result = await api.surveys.updateFeedback(surveyId, status, note || null)
    if (!result.error) {
      setSurveyData((prev) =>
        prev.map((s) => s.id === surveyId ? { ...s, feedback_status: status, feedback_note: note || null } : s)
      )
    }
    setSavingFeedback(null)
  }

  // --- Excel Download ---
  const handleExcelDownload = async () => {
    if (selectedMonth === 0) return
    setExcelLoading(true)
    try {
      const inspectorName = localStorage.getItem('smbiz_inspector_name') || ''
      const { startDate, endDate } = getMonthDateBounds(selectedYear, selectedMonth)

      // 점검 데이터 + 설문 데이터 병렬 fetch
      const [facilityResult, equipmentResult, surveyResult] = await Promise.all([
        api.inspections.getFacilityByDateRange(startDate, endDate),
        api.inspections.getEquipmentByMonth(selectedYear, selectedMonth),
        (async () => {
          const ids = activeMonthlyReservations.map((r) => r.id).filter(Boolean)
          return ids.length > 0
            ? api.surveys.getByReservationIds(ids)
            : { data: [] as SatisfactionSurvey[], error: null }
        })(),
      ])

      const surveys = surveyResult.data || []
      const surveyStats = computeSurveyStats(surveys, activeMonthlyReservations.length)
      const catDist = computeCategoryDistribution(surveys)

      // 동적 import (코드 스플리팅)
      const { generateExcelReport } = await import('../lib/excelExport')

      const blob = await generateExcelReport({
        year: selectedYear,
        month: selectedMonth,
        operatingDays,
        inspectorName,
        equipmentSummary,
        currentYearRows: monthlyComparisonRows,
        prevYearRows: prevYearComparisonRows,
        industryRows,
        shotStats,
        topCompanies,
        surveys,
        surveyTargetCount: activeMonthlyReservations.length,
        surveySummary: surveyStats,
        categoryDistribution: catDist,
        facilityInspections: facilityResult.data || [],
        equipmentInspections: equipmentResult.data || [],
      })

      // 다운로드 트리거
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `통계_산출_${selectedYear}년_${selectedMonth}월.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('엑셀 파일이 다운로드되었습니다.')
    } catch (err) {
      console.error('Excel export failed:', err)
      toast.error('엑셀 생성 중 오류가 발생했습니다.')
    } finally {
      setExcelLoading(false)
    }
  }

  // --- Render ---
  return (
    <div className="h-full flex flex-col bg-bg-primary overflow-hidden">
      {/* Header */}
      <header className="border-b border-border bg-bg-secondary/60 backdrop-blur-xl flex-shrink-0 z-10">
        <div className="px-4 py-3 md:px-6 md:py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-lg md:text-xl font-bold text-text-primary">통합 대시보드</h1>
              <p className="text-xs text-text-tertiary mt-0.5 hidden md:block">연도별/월별 이용 통계 분석</p>
            </div>

            <div className="flex items-center gap-2 md:gap-3 flex-wrap justify-end flex-shrink-0">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="input text-xs md:text-sm py-1 md:py-1.5 px-2"
              >
                {getYearOptions().map((year) => (
                  <option key={year} value={year}>{year}년</option>
                ))}
              </select>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="input text-xs md:text-sm py-1 md:py-1.5 px-2"
              >
                <option value={0}>전체</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                  <option key={month} value={month}>{month}월</option>
                ))}
              </select>

              {/* Mode toggle - desktop (요약 탭에서만) */}
              {activeTab === 'overview' && (
                <div className="relative group hidden md:inline-flex rounded-md border border-border bg-bg-tertiary p-0.5">
                  <button
                    type="button"
                    onClick={() => setUtilizationMode('report')}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded transition-all ${
                      utilizationMode === 'report'
                        ? 'bg-primary/20 text-primary border border-primary/30'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    결과보고
                  </button>
                  <button
                    type="button"
                    onClick={() => setUtilizationMode('legacy')}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded transition-all ${
                      utilizationMode === 'legacy'
                        ? 'bg-primary/20 text-primary border border-primary/30'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    기존 방식
                  </button>
                  <div className="absolute top-full left-0 mt-1 hidden group-hover:block z-50 whitespace-pre-line px-3 py-2 rounded-lg bg-bg-elevated border border-border shadow-xl text-[11px] text-text-secondary min-w-[280px]">
                    {formulaTooltip}
                  </div>
                </div>
              )}

              <label className="hidden md:inline-flex items-center gap-1.5 text-xs text-text-secondary">
                <input
                  type="checkbox"
                  checked={includeNoShow}
                  onChange={(e) => setIncludeNoShow(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-border bg-bg-tertiary"
                />
                노쇼 포함
              </label>

              <span className="hidden md:inline text-xs text-text-tertiary tabular-nums">
                운영일 {operatingDays}일
              </span>

              {selectedMonth > 0 && (
                <button
                  type="button"
                  onClick={handleExcelDownload}
                  disabled={excelLoading || loading}
                  className="hidden md:inline-flex items-center gap-1.5 btn btn-primary text-xs py-1.5 px-3"
                >
                  {excelLoading ? (
                    <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="31 31" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="7 10 12 15 17 10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                  )}
                  엑셀 다운로드
                </button>
              )}
            </div>
          </div>

          {/* Mobile-only controls */}
          <div className="mt-2 flex items-center gap-2 flex-wrap md:hidden">
            {activeTab === 'overview' && (
              <div className="inline-flex rounded-md border border-border bg-bg-tertiary p-0.5">
                <button
                  type="button"
                  onClick={() => setUtilizationMode('report')}
                  className={`px-2 py-1 text-[10px] font-medium rounded transition-all ${
                    utilizationMode === 'report'
                      ? 'bg-primary/20 text-primary border border-primary/30'
                      : 'text-text-secondary'
                  }`}
                >
                  결과보고
                </button>
                <button
                  type="button"
                  onClick={() => setUtilizationMode('legacy')}
                  className={`px-2 py-1 text-[10px] font-medium rounded transition-all ${
                    utilizationMode === 'legacy'
                      ? 'bg-primary/20 text-primary border border-primary/30'
                      : 'text-text-secondary'
                  }`}
                >
                  기존 방식
                </button>
              </div>
            )}
            <label className="inline-flex items-center gap-1 text-[10px] text-text-secondary">
              <input
                type="checkbox"
                checked={includeNoShow}
                onChange={(e) => setIncludeNoShow(e.target.checked)}
                className="w-3 h-3 rounded border-border bg-bg-tertiary"
              />
              노쇼
            </label>
            <span className="text-[10px] text-text-tertiary tabular-nums">
              운영일 {operatingDays}일
            </span>
            {selectedMonth > 0 && (
              <button
                type="button"
                onClick={handleExcelDownload}
                disabled={excelLoading || loading}
                className="inline-flex items-center gap-1 btn btn-primary text-[10px] py-1 px-2"
              >
                {excelLoading ? (
                  <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="31 31" />
                  </svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                )}
                엑셀
              </button>
            )}
          </div>
        </div>

        {/* Tab bar */}
        <div className="px-4 md:px-6 flex items-center gap-0.5 md:gap-1 border-t border-border/50 overflow-x-auto">
          {STATS_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 md:px-4 py-2.5 md:py-3 text-xs md:text-sm font-medium whitespace-nowrap transition-all border-b-2 ${
                activeTab === tab.id
                  ? 'border-primary text-primary font-semibold'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              {tab.label}
            </button>
          ))}
          <div className="ml-auto hidden md:block">
            <a
              href="/survey"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost text-xs py-1.5 px-3 flex items-center gap-1.5 text-text-secondary hover:text-primary"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/>
                <line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
              <span>만족도조사 페이지</span>
            </a>
          </div>
        </div>
      </header>

      {/* Content area */}
      <div className="flex-1 overflow-auto p-3 md:p-6 flex flex-col">
        {loading && !hasLoadedOnce.current ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[...Array(8)].map((_, index) => (
              <div key={index} className="skeleton h-20" />
            ))}
          </div>
        ) : (
          <div className={`flex flex-col flex-1 min-h-0 transition-opacity duration-200 ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
            {errorMessage && (
              <div className="card p-3 border-danger/40 bg-danger/10 mb-4">
                <p className="text-sm text-danger font-medium">{errorMessage}</p>
              </div>
            )}

            {/* === Overview tab === */}
            {activeTab === 'overview' && (
              <div className="flex flex-col gap-4 flex-1 min-h-0">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <SummaryCard
                    title={selectedMonth === 0 ? '연간 예약 건수' : '당월 예약 건수'}
                    value={fmtNum(activeMonthlyReservations.length, 0)}
                    subText="상태 필터 적용"
                  />
                  <SummaryCard
                    title={selectedMonth === 0 ? '연간 이용 기업 수' : '당월 이용 기업 수'}
                    value={fmtNum(new Set(activeMonthlyReservations.map((r) => r.company_id)).size, 0)}
                    subText="중복 제외"
                  />
                  <SummaryCard
                    title="전체 가동률"
                    value={formatPercent(equipmentSummary.overallUtilizationRate)}
                    subText={
                      utilizationMode === 'report'
                        ? `가동일 ${fmtNum(equipmentSummary.workingDays, 0)}일 / 운영일 ${fmtNum(operatingDays, 0)}일`
                        : `시간합 ${fmtNum(equipmentSummary.totalOperationHours)}h / ${fmtNum(equipmentSummary.workingDays, 0)}일×8h / ${fmtNum(equipmentSummary.usedEquipmentCount, 0)}장비`
                    }
                  />
                  <SummaryCard
                    title={selectedMonth === 0 ? '연간 총 가동시간' : '당월 총 가동시간'}
                    value={`${fmtNum(equipmentSummary.totalOperationHours)}h`}
                    subText={`워킹데이 ${fmtNum(equipmentSummary.workingDays, 0)}일`}
                  />
                </div>

                <section className="card p-4 flex-1 flex flex-col min-h-0">
                  <h3 className="text-sm font-semibold text-text-primary mb-3">이용 현황</h3>
                  <div className="flex-1 overflow-auto min-h-0">
                    <table className="table text-sm w-full">
                      <thead className="sticky top-0 z-10 bg-bg-secondary">
                        <tr>
                          <th className="col-left">항목</th>
                          <th className="col-right">예약횟수</th>
                          <th className="col-right">이용기업수</th>
                          <th className="col-right">가동일</th>
                          <th className="col-right">가동률</th>
                          <th className="col-right">가동시간</th>
                        </tr>
                      </thead>
                      <tbody>
                        {equipmentSummary.rows.map((row) => (
                          <tr key={row.equipmentType}>
                            <td className="col-left font-medium">{row.equipmentLabel}</td>
                            <td className="col-right">{fmtNum(row.reservationCount, 0)}</td>
                            <td className="col-right">{fmtNum(row.uniqueCompanies, 0)}</td>
                            <td className="col-right">{fmtNum(row.activeDays, 0)}</td>
                            <td className="col-right">{formatPercent(row.utilizationRate)}</td>
                            <td className="col-right">{fmtNum(row.operationHours)}</td>
                          </tr>
                        ))}
                        <tr className="bg-bg-tertiary/40 font-semibold">
                          <td className="col-left">평균/합계</td>
                          <td className="col-right">{fmtNum(equipmentSummary.averageRow.reservationCount, 1)}</td>
                          <td className="col-right">{fmtNum(equipmentSummary.averageRow.uniqueCompanies, 1)}</td>
                          <td className="col-right">{fmtNum(equipmentSummary.averageRow.activeDays, 1)}</td>
                          <td className="col-right">{formatPercent(equipmentSummary.averageRow.utilizationRate)}</td>
                          <td className="col-right">{fmtNum(equipmentSummary.averageRow.operationHours)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            )}

            {/* === YoY Comparison tab === */}
            {activeTab === 'yoy' && (
              <div className="flex flex-col gap-4 flex-1 min-h-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <SummaryCard
                    title={selectedMonth === 0
                      ? `${selectedYear - 1}년 대비 가동률`
                      : `${selectedYear - 1}년 동월 대비 가동률`}
                    value={fmtPctDiff(utilizationDifference)}
                    subText={`${fmtPct(yoyCurrentUtil)} vs ${fmtPct(yoyPrevUtil)}`}
                  />
                  <SummaryCard
                    title={selectedMonth === 0
                      ? `${selectedYear - 1}년 대비 예약횟수`
                      : `${selectedYear - 1}년 동월 대비 예약횟수`}
                    value={`${reservationDifference >= 0 ? '+' : ''}${fmtNum(reservationDifference, 0)}회`}
                    subText={`${fmtNum(yoyCurrentBookings, 0)}회 vs ${fmtNum(yoyPrevBookings, 0)}회`}
                  />
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 flex-1 min-h-0">
                  <div className="card p-4 flex flex-col min-h-0">
                    <h3 className="text-sm font-semibold text-text-primary mb-3 flex-shrink-0">가동률 비교</h3>
                    <div className="flex-1 min-h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={trendData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                          <XAxis dataKey="month" stroke="#6B6B6B" tick={{ fill: '#A8A8A8', fontSize: 11 }} />
                          <YAxis stroke="#6B6B6B" tick={{ fill: '#A8A8A8', fontSize: 11 }} />
                          <Tooltip
                            cursor={{ stroke: 'rgba(255,255,255,0.15)', strokeWidth: 1 }}
                            contentStyle={chartTooltipStyle}
                            labelStyle={chartTooltipLabelStyle}
                            itemStyle={chartTooltipItemStyle}
                            formatter={(value: number) => [fmtPct(value), '가동률']}
                          />
                          <Legend />
                          <Line
                            type="monotone"
                            dataKey="currentUtilization"
                            name={`${selectedYear}년`}
                            stroke="#10B981"
                            strokeWidth={2}
                            dot={{ r: 3 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="previousUtilization"
                            name={`${selectedYear - 1}년`}
                            stroke="#6366F1"
                            strokeWidth={2}
                            strokeDasharray="5 5"
                            dot={{ r: 3 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="card p-4 flex flex-col min-h-0">
                    <h3 className="text-sm font-semibold text-text-primary mb-3 flex-shrink-0">예약횟수 비교</h3>
                    <div className="flex-1 min-h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={trendData} barCategoryGap="20%" barGap={4}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                          <XAxis dataKey="month" stroke="#6B6B6B" tick={{ fill: '#A8A8A8', fontSize: 11 }} />
                          <YAxis stroke="#6B6B6B" tick={{ fill: '#A8A8A8', fontSize: 11 }} />
                          <Tooltip
                            cursor={false}
                            contentStyle={chartTooltipStyle}
                            labelStyle={chartTooltipLabelStyle}
                            itemStyle={chartTooltipItemStyle}
                          />
                          <Legend />
                          <Bar
                            dataKey="currentReservations"
                            name={`${selectedYear}년`}
                            fill={CHART_COLORS[2]}
                            radius={[4, 4, 0, 0]}
                            fillOpacity={0.8}
                            activeBar={{ stroke: 'rgba(255,255,255,0.6)', strokeWidth: 2, fillOpacity: 1, filter: 'brightness(1.3)' }}
                          />
                          <Bar
                            dataKey="previousReservations"
                            name={`${selectedYear - 1}년`}
                            fill={CHART_COLORS[1]}
                            radius={[4, 4, 0, 0]}
                            fillOpacity={0.8}
                            activeBar={{ stroke: 'rgba(255,255,255,0.6)', strokeWidth: 2, fillOpacity: 1, filter: 'brightness(1.3)' }}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* === Industry / Shot stats tab === */}
            {activeTab === 'industry' && (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 flex-1 min-h-0">
                <section className="card p-4 flex flex-col min-h-0">
                  <h3 className="text-sm font-semibold text-text-primary mb-3">5대 업종별 이용 현황</h3>
                  <div className="flex-1 overflow-auto min-h-0">
                    <table className="table text-sm w-full">
                      <thead className="sticky top-0 z-10 bg-bg-secondary">
                        <tr>
                          <th className="col-left">업종</th>
                          <th className="col-right">{selectedMonth === 0 ? '연간' : '당월'} 이용건수</th>
                          <th className="col-right">누적 이용건수</th>
                          <th className="col-right">비중</th>
                        </tr>
                      </thead>
                      <tbody>
                        {industryRows.map((row) => (
                          <tr key={row.industry}>
                            <td className="col-left font-medium">{row.industry}</td>
                            <td className="col-right">{fmtNum(row.monthlyUsageCount, 0)}</td>
                            <td className="col-right">{fmtNum(row.cumulativeUsageCount, 0)}</td>
                            <td className="col-right">{formatPercent(row.shareRate)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="card p-4 flex flex-col min-h-0">
                  <h3 className="text-sm font-semibold text-text-primary mb-3">사용 기업 1인당 촬영 컷수</h3>
                  <div className="flex-1 overflow-auto min-h-0">
                    <table className="table text-sm w-full">
                      <thead className="sticky top-0 z-10 bg-bg-secondary">
                        <tr>
                          <th className="col-left">구분</th>
                          <th className="col-right">{selectedMonth === 0 ? '연간' : '당월'} 촬영 컷수</th>
                          <th className="col-right">누적</th>
                          <th className="col-right">기업당 평균</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="col-left font-medium">2D 스케치</td>
                          <td className="col-right">{fmtNum(shotStats.monthly2d, 0)}</td>
                          <td className="col-right">{fmtNum(shotStats.ytd2d, 0)}</td>
                          <td className="col-right">{fmtNum(shotStats.monthly2dPerCompany)}</td>
                        </tr>
                        <tr>
                          <td className="col-left font-medium">3D 스캔</td>
                          <td className="col-right">{fmtNum(shotStats.monthly3d, 0)}</td>
                          <td className="col-right">{fmtNum(shotStats.ytd3d, 0)}</td>
                          <td className="col-right">{fmtNum(shotStats.monthly3dPerCompany)}</td>
                        </tr>
                        <tr>
                          <td className="col-left font-medium">영상 촬영</td>
                          <td className="col-right">{fmtNum(shotStats.monthlyVideo, 0)}</td>
                          <td className="col-right">{fmtNum(shotStats.ytdVideo, 0)}</td>
                          <td className="col-right">{fmtNum(shotStats.monthlyVideoPerCompany)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-text-tertiary mt-2">
                    {selectedMonth === 0 ? '연간' : '당월'} 기준 이용 기업 {fmtNum(shotStats.monthlyCompanies, 0)}개사, 누적 이용 기업 {fmtNum(shotStats.ytdCompanies, 0)}개사
                  </p>
                </section>
              </div>
            )}

            {/* === Top Companies tab === */}
            {activeTab === 'companies' && (
              <section className="card p-4 flex flex-col min-h-0 flex-1">
                <h3 className="text-sm font-semibold text-text-primary mb-3">
                  {selectedMonth === 0 ? '연간' : `${selectedMonth}월`} 주요 스튜디오 이용 업체
                </h3>
                <div className="flex-1 overflow-auto min-h-0">
                  <table className="table text-sm w-full">
                    <thead className="sticky top-0 z-10 bg-bg-secondary">
                      <tr>
                        <th className="col-center">순번</th>
                        <th className="col-left">업체명</th>
                        <th className="col-left">분류</th>
                        <th className="col-right">이용횟수</th>
                        <th className="col-center">신규기업</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topCompanies.length > 0 ? (
                        topCompanies.map((row) => (
                          <tr key={row.companyId}>
                            <td className="col-center">{row.rank}</td>
                            <td className="col-left font-medium">{row.companyName}</td>
                            <td className="col-left">{row.industry}</td>
                            <td className="col-right">{fmtNum(row.reservationCount, 0)}</td>
                            <td>
                              <span className={`badge ${row.newcomer === '신규' ? 'badge-warning' : 'badge-primary'}`}>
                                {row.newcomer}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="text-center text-text-tertiary py-6">
                            {selectedMonth === 0 ? '연간' : '당월'} 이용 업체 데이터가 없습니다.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* === Survey tab (좌: 설문결과+기타의견, 우: 설문내용) === */}
            {activeTab === 'survey' && (
              <div className="flex-1 min-h-0">
                {surveyLoading ? (
                  <div className="skeleton h-64 w-full" />
                ) : surveySummary.totalResponses === 0 ? (
                  <div className="text-center py-16 text-text-tertiary">
                    {selectedMonth === 0 ? '연간' : '해당 월'} 만족도조사 응답 데이터가 없습니다.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
                    {/* 좌측: 설문결과 + 기타의견 */}
                    <div className="space-y-4">
                      {/* 설문 결과 요약 */}
                      <section className="card p-4">
                        <h3 className="text-sm font-semibold text-text-primary mb-3">
                          {selectedYear}년 {selectedMonth === 0 ? '' : `${selectedMonth}월 `}만족도 조사 설문 결과
                        </h3>
                        <table className="table text-sm w-full">
                          <thead>
                            <tr>
                              <th className="col-center">구분</th>
                              <th className="col-center">이용 횟수</th>
                              <th className="col-center">설문 참여(참여율)</th>
                              <th className="col-center">비고</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td className="col-center font-medium">만족도 조사</td>
                              <td className="col-center tabular-nums">{fmtNum(surveySummary.totalTargets, 0)}</td>
                              <td className="col-center tabular-nums">
                                {fmtNum(surveySummary.totalResponses, 0)}({fmtPct(surveySummary.responseRate)})
                              </td>
                              <td className="col-center text-text-secondary text-xs">(일일 중복 기업 제외)</td>
                            </tr>
                          </tbody>
                        </table>
                      </section>

                      {/* 기타 의견 관리 */}
                      <section className="card p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-semibold text-text-primary">설문 조사 기타 의견</h3>
                          <div className="flex flex-wrap gap-1.5 text-xs">
                            <span className="px-2 py-0.5 rounded-full bg-warning/20 text-warning">미확인 {feedbackCounts.unreviewed}</span>
                            <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary">확인완료 {feedbackCounts.reviewed}</span>
                            <span className="px-2 py-0.5 rounded-full bg-success/20 text-success">조치완료 {feedbackCounts.action_taken}</span>
                          </div>
                        </div>
                        {feedbackItems.length > 0 ? (
                          <div className="space-y-3">
                            {feedbackItems.map((item) => (
                              <FeedbackCard
                                key={item.id}
                                survey={item}
                                saving={savingFeedback === item.id}
                                reservationInfo={item.reservation_id ? reservationInfoMap.get(item.reservation_id) : undefined}
                                onStatusChange={handleFeedbackStatusChange}
                                onNoteSave={handleFeedbackNoteSave}
                              />
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8 text-text-tertiary text-sm">
                            기타 의견이 없습니다.
                          </div>
                        )}
                      </section>
                    </div>

                    {/* 우측: 설문 내용 (테이블들) */}
                    <section className="card p-4">
                      <h3 className="text-sm font-semibold text-text-primary mb-3">설문 내용</h3>

                      {/* 항목별 만족도 분포 */}
                      <div className="overflow-x-auto">
                        <table className="table text-sm w-full">
                          <thead>
                            <tr>
                              <th className="col-left min-w-[180px]">설문 내용</th>
                              <th className="col-center">매우 만족</th>
                              <th className="col-center">만족</th>
                              <th className="col-center">보통</th>
                              <th className="col-center">불만족</th>
                              <th className="col-center">매우 불만족</th>
                            </tr>
                          </thead>
                          <tbody>
                            {SURVEY_CATEGORY_ORDER.map((key) => {
                              const dist = categoryDistribution[key] || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
                              const total = surveySummary.totalResponses
                              return (
                                <tr key={key}>
                                  <td className="col-left font-medium">{SURVEY_REPORT_LABELS[key] || key}</td>
                                  {[5, 4, 3, 2, 1].map((score) => (
                                    <td key={score} className="col-center tabular-nums">
                                      <div>{fmtNum(dist[score], 0)}</div>
                                      <div className="text-[10px] text-text-tertiary">
                                        ({total > 0 ? fmtPct((dist[score] / total) * 100) : '0%'})
                                      </div>
                                    </td>
                                  ))}
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* 스튜디오 경로 분포 */}
                      <div className="overflow-x-auto mt-4 pt-4 border-t border-border/30">
                        <table className="table text-sm w-full">
                          <thead>
                            <tr>
                              <th className="col-left min-w-[180px]">설문 내용</th>
                              {STUDIO_REFERRAL_OPTIONS.map((opt) => (
                                <th key={opt.value} className="col-center text-xs">{opt.label}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td className="col-left font-medium">제작실을 알게 된 경로</td>
                              {STUDIO_REFERRAL_OPTIONS.map((opt) => {
                                const count = surveySummary.referralDistribution[opt.value] || 0
                                const total = Object.values(surveySummary.referralDistribution).reduce((s, v) => s + v, 0)
                                return (
                                  <td key={opt.value} className="col-center tabular-nums">
                                    <div>{fmtNum(count, 0)}</div>
                                    <div className="text-[10px] text-text-tertiary">
                                      ({total > 0 ? fmtPct((count / total) * 100) : '0%'})
                                    </div>
                                  </td>
                                )
                              })}
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* 도움이 된 부분 분포 */}
                      <div className="overflow-x-auto mt-4 pt-4 border-t border-border/30">
                        <table className="table text-sm w-full">
                          <thead>
                            <tr>
                              <th className="col-left min-w-[180px]">설문 내용</th>
                              {STUDIO_BENEFIT_OPTIONS.map((opt) => (
                                <th key={opt.value} className="col-center text-xs">{opt.label}</th>
                              ))}
                              <th className="col-center">-</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td className="col-left font-medium">제작실 이용을 통해 도움이 된 부분</td>
                              {STUDIO_BENEFIT_OPTIONS.map((opt) => {
                                const count = surveySummary.benefitsDistribution[opt.value] || 0
                                const total = Object.values(surveySummary.benefitsDistribution).reduce((s, v) => s + v, 0)
                                return (
                                  <td key={opt.value} className="col-center tabular-nums">
                                    <div>{fmtNum(count, 0)}</div>
                                    <div className="text-[10px] text-text-tertiary">
                                      ({total > 0 ? fmtPct((count / total) * 100) : '0%'})
                                    </div>
                                  </td>
                                )
                              })}
                              <td className="col-center text-text-tertiary">-</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </section>
                  </div>
                )}
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  )
}


export default StatsPage
