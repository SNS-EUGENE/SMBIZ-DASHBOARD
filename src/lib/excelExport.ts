/**
 * Excel 통계 보고서 생성 모듈
 *
 * 9개 시트로 구성된 .xlsx 파일을 생성합니다.
 * 동적 import로 로드되어 메인 번들에 포함되지 않습니다.
 */
import ExcelJS from 'exceljs'
import type {
  SatisfactionSurvey,
  FacilityInspection,
  EquipmentInspection,
  SurveyCategoryKey,
} from '../types'
import type {
  EquipmentUsageSummary,
  IndustryUsageRow,
  MonthlyComparisonRow,
  ShotStats,
  SurveyStatsSummary,
  TopCompanyRow,
} from './reportMetrics'
import { REPORT_EQUIPMENT_LABELS } from './reportMetrics'
import {
  SURVEY_CATEGORY_ORDER,
  STUDIO_REFERRAL_OPTIONS,
  STUDIO_BENEFIT_OPTIONS,
  FEEDBACK_STATUS_LABELS,
} from '../constants/survey'
import {
  FACILITY_CHECK_CATEGORIES,
  INSPECTION_EQUIPMENT,
} from '../constants/inspections'
import { getHolidaysForMonth, getCustomHolidays } from './holidays'

// ============================================================
// Types
// ============================================================

export interface ExcelReportParams {
  year: number
  month: number // 1-12 (never 0)
  operatingDays: number
  inspectorName: string

  equipmentSummary: EquipmentUsageSummary
  currentYearRows: MonthlyComparisonRow[]
  prevYearRows: MonthlyComparisonRow[]
  industryRows: IndustryUsageRow[]
  shotStats: ShotStats
  topCompanies: TopCompanyRow[]

  surveys: SatisfactionSurvey[]
  surveyTargetCount: number
  surveySummary: SurveyStatsSummary
  categoryDistribution: Record<string, Record<number, number>>

  facilityInspections: FacilityInspection[]
  equipmentInspections: EquipmentInspection[]
}

// ============================================================
// Common Styles
// ============================================================

const FONT_TITLE: Partial<ExcelJS.Font> = { name: '맑은 고딕', size: 14, bold: true }
const FONT_HEADER: Partial<ExcelJS.Font> = { name: '맑은 고딕', size: 10, bold: true }
const FONT_BODY: Partial<ExcelJS.Font> = { name: '맑은 고딕', size: 10 }
const FONT_SMALL: Partial<ExcelJS.Font> = { name: '맑은 고딕', size: 9 }

const FILL_HEADER: ExcelJS.Fill = {
  type: 'pattern', pattern: 'solid',
  fgColor: { argb: 'FFD9E2F3' },
}
const FILL_SUBTOTAL: ExcelJS.Fill = {
  type: 'pattern', pattern: 'solid',
  fgColor: { argb: 'FFF2F2F2' },
}
const FILL_DIAGONAL: ExcelJS.Fill = {
  type: 'pattern', pattern: 'lightDown',
  fgColor: { argb: 'FFC0C0C0' },
}

const BORDER_THIN: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: 'FF000000' } }
const BORDER_ALL: Partial<ExcelJS.Borders> = {
  top: BORDER_THIN,
  left: BORDER_THIN,
  bottom: BORDER_THIN,
  right: BORDER_THIN,
}

const ALIGN_CENTER: Partial<ExcelJS.Alignment> = { horizontal: 'center', vertical: 'middle', wrapText: true }
const ALIGN_LEFT: Partial<ExcelJS.Alignment> = { horizontal: 'left', vertical: 'middle', wrapText: true }
const ALIGN_RIGHT: Partial<ExcelJS.Alignment> = { horizontal: 'right', vertical: 'middle', wrapText: true }

// ============================================================
// Helpers
// ============================================================

/** 퍼센트 표시 (정수) */
const pct = (v: number): string => `${Math.round(v)}%`

/** 퍼센트 표시 (소수점 1자리) */
const pct1 = (v: number): string => `${v.toFixed(1)}%`

/** 숫자 소수점 반올림 */
const round = (v: number, d = 0): number => {
  const f = Math.pow(10, d)
  return Math.round(v * f) / f
}

/** 셀에 스타일 적용 헬퍼 */
function styleCell(
  cell: ExcelJS.Cell,
  opts: {
    font?: Partial<ExcelJS.Font>
    fill?: ExcelJS.Fill
    alignment?: Partial<ExcelJS.Alignment>
    border?: Partial<ExcelJS.Borders>
    numFmt?: string
  }
) {
  if (opts.font) cell.font = opts.font
  if (opts.fill) cell.fill = opts.fill
  if (opts.alignment) cell.alignment = opts.alignment
  if (opts.border) cell.border = opts.border
  if (opts.numFmt) cell.numFmt = opts.numFmt
}

/** 범위 내 모든 셀에 스타일 적용 */
function styleRange(
  ws: ExcelJS.Worksheet,
  rowStart: number, colStart: number,
  rowEnd: number, colEnd: number,
  opts: Parameters<typeof styleCell>[1]
) {
  for (let r = rowStart; r <= rowEnd; r++) {
    for (let c = colStart; c <= colEnd; c++) {
      styleCell(ws.getCell(r, c), opts)
    }
  }
}

/** 제목행 추가 (병합 + 스타일) */
function addTitle(ws: ExcelJS.Worksheet, row: number, colEnd: number, text: string) {
  ws.mergeCells(row, 1, row, colEnd)
  const cell = ws.getCell(row, 1)
  cell.value = text
  styleCell(cell, { font: FONT_TITLE, alignment: { ...ALIGN_CENTER, wrapText: false } })
}

/** 헤더 행 추가 */
function addHeaderRow(ws: ExcelJS.Worksheet, row: number, headers: string[]) {
  headers.forEach((h, i) => {
    const cell = ws.getCell(row, i + 1)
    cell.value = h
    styleCell(cell, { font: FONT_HEADER, fill: FILL_HEADER, alignment: ALIGN_CENTER, border: BORDER_ALL })
  })
}

/** 데이터 행 추가 */
function addDataRow(
  ws: ExcelJS.Worksheet, row: number,
  values: (string | number)[],
  opts?: { font?: Partial<ExcelJS.Font>, fill?: ExcelJS.Fill, alignments?: (Partial<ExcelJS.Alignment> | undefined)[] }
) {
  values.forEach((v, i) => {
    const cell = ws.getCell(row, i + 1)
    cell.value = v
    styleCell(cell, {
      font: opts?.font || FONT_BODY,
      fill: opts?.fill,
      alignment: opts?.alignments?.[i] || ALIGN_CENTER,
      border: BORDER_ALL,
    })
  })
}

// ============================================================
// Week Grid Builder (시트 6-1 용)
// ============================================================

interface WeekDay {
  date: string | null  // YYYY-MM-DD or null if not in month
  dayOfMonth: number | null
  isHoliday: boolean
  isWeekend: boolean
}

interface WeekGrid {
  weeks: WeekDay[][]  // weeks[weekIdx][dayIdx(0=월~4=금)]
  weekCount: number
}

function buildWeekGrid(year: number, month: number, holidaySet: Set<string>): WeekGrid {
  const firstDay = new Date(year, month - 1, 1)
  const lastDay = new Date(year, month, 0).getDate()

  // 해당 월의 첫 날이 속한 주의 월요일 찾기
  let dow = firstDay.getDay() // 0=일, 1=월, ..., 6=토
  if (dow === 0) dow = 7 // 일요일 → 7로 변환 (ISO 기준)
  const mondayOffset = 1 - dow // 1일 기준 그 주 월요일까지의 offset

  const weeks: WeekDay[][] = []
  let currentMonday = new Date(year, month - 1, 1 + mondayOffset)

  for (let w = 0; w < 6; w++) {
    const week: WeekDay[] = []
    let hasValidDay = false

    for (let d = 0; d < 5; d++) { // 월~금
      const dt = new Date(currentMonday.getTime() + d * 86400000)
      const dtMonth = dt.getMonth() + 1
      const dtDate = dt.getDate()
      const dtYear = dt.getFullYear()

      if (dtYear === year && dtMonth === month) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(dtDate).padStart(2, '0')}`
        const isHoliday = holidaySet.has(dateStr)
        week.push({ date: dateStr, dayOfMonth: dtDate, isHoliday, isWeekend: false })
        hasValidDay = true
      } else {
        week.push({ date: null, dayOfMonth: null, isHoliday: false, isWeekend: false })
      }
    }

    if (hasValidDay || weeks.length > 0) {
      weeks.push(week)
    }

    // 다음 주 월요일
    currentMonday = new Date(currentMonday.getTime() + 7 * 86400000)

    // 다음 주 월요일이 다음 달 이후면 중단 (단, 이미 이번 달의 마지막 날이 포함된 경우)
    if (currentMonday.getMonth() + 1 !== month && currentMonday.getFullYear() === year && currentMonday.getDate() > lastDay) {
      break
    }
    if (currentMonday.getFullYear() > year || (currentMonday.getFullYear() === year && currentMonday.getMonth() + 1 > month)) {
      // 마지막 달 날짜가 아직 금요일 전이면 이미 포함되었을 수 있으므로 중단
      break
    }
  }

  // 최대 5주로 제한
  while (weeks.length > 5) weeks.pop()
  // 최소 4주 보장
  while (weeks.length < 4) {
    weeks.push(Array.from({ length: 5 }, () => ({ date: null, dayOfMonth: null, isHoliday: false, isWeekend: false })))
  }

  return { weeks, weekCount: weeks.length }
}

// ============================================================
// Sheet Builders
// ============================================================

/** 시트 1 : 이용 현황 */
function buildSheet1(wb: ExcelJS.Workbook, p: ExcelReportParams) {
  const ws = wb.addWorksheet('1. 이용 현황')
  ws.columns = [
    { width: 22 }, { width: 14 }, { width: 14 }, { width: 12 }, { width: 12 }, { width: 14 }, { width: 20 },
  ]

  const title = `${p.year}년 ${p.month}월 스마트비즈 디지털콘텐츠제작실 이용 현황`
  addTitle(ws, 1, 7, title)

  ws.getRow(2).height = 6 // spacer

  addHeaderRow(ws, 3, ['항목', '예약횟수', '이용기업수', '가동일', '가동률', '가동시간', '비고'])

  let row = 4
  for (const r of p.equipmentSummary.rows) {
    addDataRow(ws, row, [
      r.equipmentLabel,
      `${r.reservationCount}회`,
      `${r.uniqueCompanies}개`,
      `${r.activeDays}일`,
      pct(r.utilizationRate),
      `${round(r.operationHours, 1)}h`,
      '',
    ], { alignments: [ALIGN_LEFT, ALIGN_RIGHT, ALIGN_RIGHT, ALIGN_RIGHT, ALIGN_RIGHT, ALIGN_RIGHT, ALIGN_CENTER] })
    row++
  }

  // 평균/합계 행
  const avg = p.equipmentSummary.averageRow
  addDataRow(ws, row, [
    '평균/합계',
    `${round(avg.reservationCount, 1)}회`,
    `${round(avg.uniqueCompanies, 1)}개`,
    `${round(avg.activeDays, 1)}일`,
    pct(avg.utilizationRate),
    `${round(avg.operationHours, 1)}h`,
    '',
  ], {
    font: { ...FONT_BODY, bold: true },
    fill: FILL_SUBTOTAL,
    alignments: [ALIGN_LEFT, ALIGN_RIGHT, ALIGN_RIGHT, ALIGN_RIGHT, ALIGN_RIGHT, ALIGN_RIGHT, ALIGN_CENTER],
  })
  row++

  // 추가 정보
  row++
  const infoCell = ws.getCell(row, 1)
  infoCell.value = `운영일수 : ${p.operatingDays}일`
  styleCell(infoCell, { font: FONT_SMALL })
}

/** 시트 2 : 가동률 및 이용 횟수 비교 */
function buildSheet2(wb: ExcelJS.Workbook, p: ExcelReportParams) {
  const ws = wb.addWorksheet('2. 가동률 및 이용 횟수 비교')
  ws.columns = [
    { width: 14 },
    ...Array.from({ length: 12 }, () => ({ width: 10 })),
  ]

  addTitle(ws, 1, 13, `${p.year}년 가동률 및 이용 횟수 비교`)
  ws.getRow(2).height = 6

  // 가동률 섹션
  const headers = ['구분', ...Array.from({ length: 12 }, (_, i) => `${i + 1}월`)]
  addHeaderRow(ws, 3, headers)

  // 올해 가동률
  const curUtil = p.currentYearRows.map((r) => pct1(r.utilizationRate))
  addDataRow(ws, 4, [`${p.year}년 가동률`, ...curUtil], {
    alignments: [ALIGN_LEFT, ...curUtil.map(() => ALIGN_RIGHT)],
  })

  // 작년 가동률
  const prevUtil = p.prevYearRows.map((r) => pct1(r.utilizationRate))
  addDataRow(ws, 5, [`${p.year - 1}년 가동률`, ...prevUtil], {
    alignments: [ALIGN_LEFT, ...prevUtil.map(() => ALIGN_RIGHT)],
  })

  // 빈 행
  ws.getRow(6).height = 6

  // 이용 횟수 섹션
  addHeaderRow(ws, 7, headers)

  const curBookings = p.currentYearRows.map((r) => `${r.activeBookings}회`)
  addDataRow(ws, 8, [`${p.year}년 이용횟수`, ...curBookings], {
    alignments: [ALIGN_LEFT, ...curBookings.map(() => ALIGN_RIGHT)],
  })

  const prevBookings = p.prevYearRows.map((r) => `${r.activeBookings}회`)
  addDataRow(ws, 9, [`${p.year - 1}년 이용횟수`, ...prevBookings], {
    alignments: [ALIGN_LEFT, ...prevBookings.map(() => ALIGN_RIGHT)],
  })
}

/** 시트 3 : 업종별 이용 현황 */
function buildSheet3(wb: ExcelJS.Workbook, p: ExcelReportParams) {
  const ws = wb.addWorksheet('3. 업종별 이용 현황')
  ws.columns = [
    { width: 14 }, { width: 16 }, { width: 16 }, { width: 12 },
  ]

  addTitle(ws, 1, 4, `${p.year}년 ${p.month}월 업종별 이용 현황`)
  ws.getRow(2).height = 6

  addHeaderRow(ws, 3, ['업종', `${p.month}월 이용건수`, '누적 이용건수', '비중'])

  let row = 4
  for (const r of p.industryRows) {
    addDataRow(ws, row, [
      r.industry,
      `${r.monthlyUsageCount}건`,
      `${r.cumulativeUsageCount}건`,
      pct1(r.shareRate),
    ], { alignments: [ALIGN_LEFT, ALIGN_RIGHT, ALIGN_RIGHT, ALIGN_RIGHT] })
    row++
  }

  // 촬영 컷수 섹션
  row += 2
  ws.mergeCells(row, 1, row, 4)
  const shotTitle = ws.getCell(row, 1)
  shotTitle.value = '사용 기업 1인당 촬영 컷수'
  styleCell(shotTitle, { font: { ...FONT_HEADER, size: 12 }, alignment: ALIGN_CENTER })
  row++

  addHeaderRow(ws, row, ['구분', `${p.month}월 촬영 컷수`, '누적', '기업당 평균'])
  row++

  const shotData = [
    ['2D 스케치', p.shotStats.monthly2d, p.shotStats.ytd2d, p.shotStats.monthly2dPerCompany],
    ['3D 스캔', p.shotStats.monthly3d, p.shotStats.ytd3d, p.shotStats.monthly3dPerCompany],
    ['영상 촬영', p.shotStats.monthlyVideo, p.shotStats.ytdVideo, p.shotStats.monthlyVideoPerCompany],
  ] as const

  for (const [label, monthly, ytd, avg] of shotData) {
    addDataRow(ws, row, [
      label,
      `${monthly}컷`,
      `${ytd}컷`,
      `${round(avg, 1)}컷`,
    ], { alignments: [ALIGN_LEFT, ALIGN_RIGHT, ALIGN_RIGHT, ALIGN_RIGHT] })
    row++
  }

  row++
  const noteCell = ws.getCell(row, 1)
  noteCell.value = `${p.month}월 기준 이용 기업 ${p.shotStats.monthlyCompanies}개사, 누적 이용 기업 ${p.shotStats.ytdCompanies}개사`
  ws.mergeCells(row, 1, row, 4)
  styleCell(noteCell, { font: FONT_SMALL })
}

/** 시트 4 : 주요 이용 업체 */
function buildSheet4(wb: ExcelJS.Workbook, p: ExcelReportParams) {
  const ws = wb.addWorksheet('4. 주요 이용 업체')
  ws.columns = [
    { width: 8 }, { width: 24 }, { width: 14 }, { width: 12 }, { width: 12 },
  ]

  addTitle(ws, 1, 5, `${p.year}년 ${p.month}월 주요 스튜디오 이용 업체`)
  ws.getRow(2).height = 6

  addHeaderRow(ws, 3, ['순번', '업체명', '분류', '이용횟수', '신규기업'])

  let row = 4
  for (const c of p.topCompanies) {
    addDataRow(ws, row, [
      c.rank,
      c.companyName,
      c.industry,
      `${c.reservationCount}회`,
      c.newcomer,
    ], { alignments: [ALIGN_CENTER, ALIGN_LEFT, ALIGN_LEFT, ALIGN_RIGHT, ALIGN_CENTER] })
    row++
  }

  if (p.topCompanies.length === 0) {
    ws.mergeCells(row, 1, row, 5)
    const emptyCell = ws.getCell(row, 1)
    emptyCell.value = '이용 업체 데이터가 없습니다.'
    styleCell(emptyCell, { font: FONT_BODY, alignment: ALIGN_CENTER, border: BORDER_ALL })
  }
}

/** 시트 5-1 : 만족도 조사 결과 */
function buildSheet5_1(wb: ExcelJS.Workbook, p: ExcelReportParams) {
  const ws = wb.addWorksheet('5-1. 만족도 조사 결과')
  ws.columns = [
    { width: 24 }, { width: 14 }, { width: 20 }, { width: 20 },
  ]

  addTitle(ws, 1, 4, `${p.year}년 ${p.month}월 만족도 조사 결과`)
  ws.getRow(2).height = 6

  // 요약 테이블
  addHeaderRow(ws, 3, ['구분', '이용 횟수', '설문 참여(참여율)', '비고'])

  addDataRow(ws, 4, [
    '만족도 조사',
    `${p.surveySummary.totalTargets}건`,
    `${p.surveySummary.totalResponses}건(${pct(p.surveySummary.responseRate)})`,
    '(일일 중복 기업 제외)',
  ], { alignments: [ALIGN_LEFT, ALIGN_RIGHT, ALIGN_CENTER, ALIGN_CENTER] })

  // 항목별 평균
  const row = 7
  addHeaderRow(ws, row, ['항목', '평균 점수', '', ''])
  ws.mergeCells(row, 2, row, 4)

  const SURVEY_REPORT_LABELS: Record<string, string> = {
    facility: '본 시설에 대한 전반적인 만족도',
    staff_kindness: '제작실 직원의 친절도',
    staff_expertise: '제작실 직원의 장비 전문성',
    booking: '예약 과정의 프로세스',
    cleanliness: '제작실 청결 상태',
    supplies: '장비/소품의 구성',
  }

  let r = row + 1
  for (const key of SURVEY_CATEGORY_ORDER) {
    const avg = p.surveySummary.categoryAverages[key as SurveyCategoryKey]
    ws.mergeCells(r, 2, r, 4)
    addDataRow(ws, r, [
      SURVEY_REPORT_LABELS[key] || key,
      avg != null ? `${avg.toFixed(2)}점` : '-',
      '', '',
    ], { alignments: [ALIGN_LEFT, ALIGN_CENTER, undefined, undefined] })
    r++
  }

  // 전체 평균
  ws.mergeCells(r, 2, r, 4)
  addDataRow(ws, r, [
    '전체 평균',
    `${p.surveySummary.averageRating.toFixed(2)}점`,
    '', '',
  ], {
    font: { ...FONT_BODY, bold: true },
    fill: FILL_SUBTOTAL,
    alignments: [ALIGN_LEFT, ALIGN_CENTER, undefined, undefined],
  })
}

/** 시트 5-2 : 만족도 조사 내용 */
function buildSheet5_2(wb: ExcelJS.Workbook, p: ExcelReportParams) {
  const ws = wb.addWorksheet('5-2. 만족도 조사 내용')

  // 항목별 만족도 분포
  const scoreHeaders = ['설문 내용', '매우 만족', '만족', '보통', '불만족', '매우 불만족']
  ws.columns = scoreHeaders.map((_, i) => ({ width: i === 0 ? 30 : 14 }))

  addTitle(ws, 1, 6, `${p.year}년 ${p.month}월 만족도 조사 내용`)
  ws.getRow(2).height = 6

  addHeaderRow(ws, 3, scoreHeaders)

  const SURVEY_REPORT_LABELS: Record<string, string> = {
    facility: '본 시설에 대한 전반적인 만족도',
    staff_kindness: '제작실 직원의 친절도',
    staff_expertise: '제작실 직원의 장비 전문성',
    booking: '예약 과정의 프로세스',
    cleanliness: '제작실 청결 상태',
    supplies: '장비/소품의 구성',
  }

  let row = 4
  const total = p.surveySummary.totalResponses
  for (const key of SURVEY_CATEGORY_ORDER) {
    const dist = p.categoryDistribution[key] || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    const values: string[] = [5, 4, 3, 2, 1].map((score) => {
      const count = dist[score] || 0
      const pctVal = total > 0 ? round((count / total) * 100, 1) : 0
      return `${count}명(${pctVal}%)`
    })
    addDataRow(ws, row, [SURVEY_REPORT_LABELS[key] || key, ...values], {
      alignments: [ALIGN_LEFT, ...values.map(() => ALIGN_CENTER)],
    })
    row++
  }

  // 스튜디오 경로 분포
  row += 2
  const refHeaders = ['설문 내용', ...STUDIO_REFERRAL_OPTIONS.map((o) => o.label)]
  addHeaderRow(ws, row, refHeaders)
  row++

  const refTotal = Object.values(p.surveySummary.referralDistribution).reduce((s, v) => s + v, 0)
  const refValues: string[] = STUDIO_REFERRAL_OPTIONS.map((opt) => {
    const count = p.surveySummary.referralDistribution[opt.value] || 0
    const pctVal = refTotal > 0 ? round((count / refTotal) * 100, 1) : 0
    return `${count}명(${pctVal}%)`
  })
  addDataRow(ws, row, ['제작실을 알게 된 경로', ...refValues], {
    alignments: [ALIGN_LEFT, ...refValues.map(() => ALIGN_CENTER)],
  })
  row++

  // 도움이 된 부분 분포
  row += 2
  const benHeaders = ['설문 내용', ...STUDIO_BENEFIT_OPTIONS.map((o) => o.label)]
  addHeaderRow(ws, row, benHeaders)
  row++

  const benTotal = Object.values(p.surveySummary.benefitsDistribution).reduce((s, v) => s + v, 0)
  const benValues: string[] = STUDIO_BENEFIT_OPTIONS.map((opt) => {
    const count = p.surveySummary.benefitsDistribution[opt.value] || 0
    const pctVal = benTotal > 0 ? round((count / benTotal) * 100, 1) : 0
    return `${count}명(${pctVal}%)`
  })
  addDataRow(ws, row, ['제작실 이용을 통해 도움이 된 부분', ...benValues], {
    alignments: [ALIGN_LEFT, ...benValues.map(() => ALIGN_CENTER)],
  })
}

/** 시트 5-3 : 만족도 조사 의견 */
function buildSheet5_3(wb: ExcelJS.Workbook, p: ExcelReportParams) {
  const ws = wb.addWorksheet('5-3. 만족도 조사 의견')
  ws.columns = [
    { width: 8 }, { width: 14 }, { width: 50 }, { width: 14 }, { width: 30 },
  ]

  addTitle(ws, 1, 5, `${p.year}년 ${p.month}월 만족도 조사 의견`)
  ws.getRow(2).height = 6

  addHeaderRow(ws, 3, ['번호', '제출일', '의견 내용', '상태', '조치 메모'])

  const feedbacks = p.surveys
    .filter((s) => s.submitted_at && s.comment && s.comment.trim())
    .sort((a, b) => (b.submitted_at || '').localeCompare(a.submitted_at || ''))

  let row = 4
  feedbacks.forEach((s, i) => {
    const statusLabel = FEEDBACK_STATUS_LABELS[s.feedback_status || 'unreviewed'] || '미확인'
    addDataRow(ws, row, [
      i + 1,
      s.submitted_at ? new Date(s.submitted_at).toLocaleDateString('ko-KR') : '-',
      s.comment || '',
      statusLabel,
      s.feedback_note || '',
    ], { alignments: [ALIGN_CENTER, ALIGN_CENTER, ALIGN_LEFT, ALIGN_CENTER, ALIGN_LEFT] })
    row++
  })

  if (feedbacks.length === 0) {
    ws.mergeCells(row, 1, row, 5)
    const cell = ws.getCell(row, 1)
    cell.value = '기타 의견이 없습니다.'
    styleCell(cell, { font: FONT_BODY, alignment: ALIGN_CENTER, border: BORDER_ALL })
  }
}

/** 시트 6-1 : 관리 일지 - 시설 */
async function buildSheet6_1(wb: ExcelJS.Workbook, p: ExcelReportParams) {
  const ws = wb.addWorksheet('6-1. 관리 일지 - 시설')

  // 공휴일 목록 구성
  const apiHolidays = await getHolidaysForMonth(p.year, p.month)
  const customHolidays = getCustomHolidays()
  const prefix = `${p.year}-${String(p.month).padStart(2, '0')}`
  const monthCustom = customHolidays.filter((d) => d.startsWith(prefix))
  const holidaySet = new Set([...apiHolidays, ...monthCustom])

  const grid = buildWeekGrid(p.year, p.month, holidaySet)
  const weekCount = grid.weekCount

  // 점검 항목 목록
  const allItems = FACILITY_CHECK_CATEGORIES.flatMap((cat) => cat.items)
  const categoryBounds: { label: string; startIdx: number; count: number }[] = []
  let idx = 0
  for (const cat of FACILITY_CHECK_CATEGORIES) {
    categoryBounds.push({ label: cat.label, startIdx: idx, count: cat.items.length })
    idx += cat.items.length
  }

  // 열 구성: [카테고리 | 점검항목 | 주1(월화수목금) | 주2(...) | ... | 비고]
  const dayLabels = ['월', '화', '수', '목', '금']
  const dataCols = weekCount * 5
  const totalCols = 2 + dataCols + 1 // 카테고리 + 항목 + 날짜들 + 비고

  // 열 너비 설정
  const columns: Partial<ExcelJS.Column>[] = [
    { width: 16 }, // 카테고리
    { width: 18 }, // 점검항목
  ]
  for (let w = 0; w < weekCount; w++) {
    for (let d = 0; d < 5; d++) {
      columns.push({ width: 5.5 })
    }
  }
  columns.push({ width: 20 }) // 비고
  ws.columns = columns

  // 제목
  addTitle(ws, 1, totalCols, `${p.year}년 ${p.month}월 시설 일일 점검 일지`)
  ws.getRow(2).height = 6

  // 헤더 행 1: 카테고리 | 점검항목 | 1주차 | 2주차 | ... | 비고
  const hRow1 = 3
  const hCell1 = ws.getCell(hRow1, 1)
  hCell1.value = '구분'
  styleCell(hCell1, { font: FONT_HEADER, fill: FILL_HEADER, alignment: ALIGN_CENTER, border: BORDER_ALL })
  ws.mergeCells(hRow1, 1, hRow1 + 1, 1) // 2행 병합

  const hCell2 = ws.getCell(hRow1, 2)
  hCell2.value = '점검 항목'
  styleCell(hCell2, { font: FONT_HEADER, fill: FILL_HEADER, alignment: ALIGN_CENTER, border: BORDER_ALL })
  ws.mergeCells(hRow1, 2, hRow1 + 1, 2)

  for (let w = 0; w < weekCount; w++) {
    const startCol = 3 + w * 5
    const endCol = startCol + 4
    ws.mergeCells(hRow1, startCol, hRow1, endCol)
    const weekCell = ws.getCell(hRow1, startCol)
    weekCell.value = `${w + 1}주차`
    styleCell(weekCell, { font: FONT_HEADER, fill: FILL_HEADER, alignment: ALIGN_CENTER, border: BORDER_ALL })
  }

  const remarkCol = 3 + dataCols
  const remarkCell = ws.getCell(hRow1, remarkCol)
  remarkCell.value = '비고'
  styleCell(remarkCell, { font: FONT_HEADER, fill: FILL_HEADER, alignment: ALIGN_CENTER, border: BORDER_ALL })
  ws.mergeCells(hRow1, remarkCol, hRow1 + 1, remarkCol)

  // 헤더 행 2: 요일 라벨 (월화수목금 반복)
  const hRow2 = 4
  for (let w = 0; w < weekCount; w++) {
    for (let d = 0; d < 5; d++) {
      const col = 3 + w * 5 + d
      const cell = ws.getCell(hRow2, col)
      const weekDay = grid.weeks[w]?.[d]
      cell.value = weekDay?.dayOfMonth ? `${weekDay.dayOfMonth}` : dayLabels[d]
      styleCell(cell, { font: FONT_SMALL, fill: FILL_HEADER, alignment: ALIGN_CENTER, border: BORDER_ALL })
    }
  }

  // Inspection lookup map: date → FacilityInspection
  const inspMap = new Map<string, FacilityInspection>()
  for (const insp of p.facilityInspections) {
    inspMap.set(insp.inspection_date, insp)
  }

  // 데이터 행: 점검 항목별
  let dataRow = 5
  for (const catBound of categoryBounds) {
    const catStartRow = dataRow
    for (let itemIdx = 0; itemIdx < catBound.count; itemIdx++) {
      const item = allItems[catBound.startIdx + itemIdx]
      const row = ws.getRow(dataRow)

      // 점검항목명
      const itemCell = ws.getCell(dataRow, 2)
      itemCell.value = item.label
      styleCell(itemCell, { font: FONT_BODY, alignment: ALIGN_LEFT, border: BORDER_ALL })

      // 각 날짜 셀
      for (let w = 0; w < weekCount; w++) {
        for (let d = 0; d < 5; d++) {
          const col = 3 + w * 5 + d
          const cell = ws.getCell(dataRow, col)
          const weekDay = grid.weeks[w]?.[d]

          if (!weekDay || weekDay.date === null) {
            // 비유효일 (해당 월에 속하지 않음)
            styleCell(cell, { fill: FILL_DIAGONAL, border: BORDER_ALL, font: FONT_SMALL })
          } else if (weekDay.isHoliday) {
            // 공휴일
            styleCell(cell, { fill: FILL_DIAGONAL, border: BORDER_ALL, font: FONT_SMALL })
          } else {
            // 유효한 날짜
            const insp = weekDay.date ? inspMap.get(weekDay.date) : null
            const checked = insp?.checks?.[item.key] === true
            cell.value = checked ? 'O' : ''
            styleCell(cell, { font: FONT_SMALL, alignment: ALIGN_CENTER, border: BORDER_ALL })
          }
        }
      }

      // 비고 (해당 날짜의 notes — 행별로는 빈칸)
      const remarkC = ws.getCell(dataRow, remarkCol)
      styleCell(remarkC, { font: FONT_SMALL, border: BORDER_ALL })

      dataRow++
    }

    // 카테고리 셀 병합
    if (catBound.count > 1) {
      ws.mergeCells(catStartRow, 1, catStartRow + catBound.count - 1, 1)
    }
    const catCell = ws.getCell(catStartRow, 1)
    catCell.value = catBound.label
    styleCell(catCell, { font: FONT_HEADER, fill: FILL_HEADER, alignment: ALIGN_CENTER, border: BORDER_ALL })
  }

  // 하단: 확인자
  dataRow++
  const inspCell = ws.getCell(dataRow, 1)
  inspCell.value = '확인자'
  styleCell(inspCell, { font: FONT_HEADER })
  const nameCell = ws.getCell(dataRow, 2)
  nameCell.value = p.inspectorName
  styleCell(nameCell, { font: FONT_BODY })

  // 비고란: 날짜별 notes 수집
  dataRow += 2
  const noteTitle = ws.getCell(dataRow, 1)
  noteTitle.value = '비고'
  styleCell(noteTitle, { font: FONT_HEADER })
  dataRow++

  for (const insp of p.facilityInspections) {
    if (insp.notes && insp.notes.trim()) {
      const cell = ws.getCell(dataRow, 1)
      cell.value = `${insp.inspection_date} : ${insp.notes}`
      ws.mergeCells(dataRow, 1, dataRow, totalCols)
      styleCell(cell, { font: FONT_SMALL })
      dataRow++
    }
  }
}

/** 시트 6-2 : 관리 일지 - 장비 */
function buildSheet6_2(wb: ExcelJS.Workbook, p: ExcelReportParams) {
  const ws = wb.addWorksheet('6-2. 관리 일지 - 장비')

  // 주차 수 결정 (장비 점검은 week_number 기준)
  const weekNumbers = [...new Set(p.equipmentInspections.map((e) => e.week_number))].sort()
  const maxWeek = Math.max(4, ...weekNumbers)
  const weekCount = Math.min(maxWeek, 5)

  // 열 구성: [장비명 | 점검 항목 | 점검 기준 | 1주 | 2주 | 3주 | 4주 | (5주) | 비고]
  const totalCols = 3 + weekCount + 1
  ws.columns = [
    { width: 18 }, // 장비명
    { width: 18 }, // 점검 항목
    { width: 14 }, // 점검 기준
    ...Array.from({ length: weekCount }, () => ({ width: 8 })),
    { width: 20 }, // 비고
  ]

  addTitle(ws, 1, totalCols, `${p.year}년 ${p.month}월 장비 주간 점검 일지`)
  ws.getRow(2).height = 6

  // 헤더
  const headers = ['장비명', '점검 항목', '점검 기준', ...Array.from({ length: weekCount }, (_, i) => `${i + 1}주`), '비고']
  addHeaderRow(ws, 3, headers)

  // Inspection lookup: week_number → EquipmentInspection
  const inspByWeek = new Map<number, EquipmentInspection>()
  for (const insp of p.equipmentInspections) {
    inspByWeek.set(insp.week_number, insp)
  }

  let dataRow = 4
  for (const equip of INSPECTION_EQUIPMENT) {
    const equipStartRow = dataRow

    for (const comp of equip.components) {
      // 점검항목
      const compCell = ws.getCell(dataRow, 2)
      compCell.value = comp.label
      styleCell(compCell, { font: FONT_BODY, alignment: ALIGN_LEFT, border: BORDER_ALL })

      // 점검 기준
      const criteriaCell = ws.getCell(dataRow, 3)
      criteriaCell.value = '수량 및 작동 확인'
      styleCell(criteriaCell, { font: FONT_SMALL, alignment: ALIGN_CENTER, border: BORDER_ALL })

      // 주차별 데이터
      for (let w = 1; w <= weekCount; w++) {
        const col = 3 + w
        const cell = ws.getCell(dataRow, col)
        const insp = inspByWeek.get(w)
        const checkKey = `${equip.key}/${comp.key}`
        const checked = insp?.checks?.[checkKey] === true
        cell.value = checked ? 'O' : ''
        styleCell(cell, { font: FONT_SMALL, alignment: ALIGN_CENTER, border: BORDER_ALL })
      }

      // 비고
      const remarkCell = ws.getCell(dataRow, totalCols)
      styleCell(remarkCell, { font: FONT_SMALL, border: BORDER_ALL })

      dataRow++
    }

    // 장비명 셀 병합
    if (equip.components.length > 1) {
      ws.mergeCells(equipStartRow, 1, equipStartRow + equip.components.length - 1, 1)
    }
    const equipCell = ws.getCell(equipStartRow, 1)
    equipCell.value = equip.label
    styleCell(equipCell, { font: FONT_HEADER, fill: FILL_HEADER, alignment: ALIGN_CENTER, border: BORDER_ALL })
  }

  // 하단: 확인자
  dataRow++
  const inspCell = ws.getCell(dataRow, 1)
  inspCell.value = '확인자'
  styleCell(inspCell, { font: FONT_HEADER })
  const nameCell = ws.getCell(dataRow, 2)
  nameCell.value = p.inspectorName
  styleCell(nameCell, { font: FONT_BODY })

  // 비고란: 주차별 notes 수집
  dataRow += 2
  const noteTitle = ws.getCell(dataRow, 1)
  noteTitle.value = '비고'
  styleCell(noteTitle, { font: FONT_HEADER })
  dataRow++

  for (const insp of p.equipmentInspections.sort((a, b) => a.week_number - b.week_number)) {
    if (insp.notes && insp.notes.trim()) {
      const cell = ws.getCell(dataRow, 1)
      cell.value = `${insp.week_number}주차 : ${insp.notes}`
      ws.mergeCells(dataRow, 1, dataRow, totalCols)
      styleCell(cell, { font: FONT_SMALL })
      dataRow++
    }
  }
}

// ============================================================
// Main Export Function
// ============================================================

export async function generateExcelReport(params: ExcelReportParams): Promise<Blob> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'SMBIZ Dashboard'
  wb.created = new Date()

  // 시트 1~4, 5-1~5-3 은 동기
  buildSheet1(wb, params)
  buildSheet2(wb, params)
  buildSheet3(wb, params)
  buildSheet4(wb, params)
  buildSheet5_1(wb, params)
  buildSheet5_2(wb, params)
  buildSheet5_3(wb, params)

  // 시트 6-1은 비동기 (공휴일 API)
  await buildSheet6_1(wb, params)
  buildSheet6_2(wb, params)

  const buffer = await wb.xlsx.writeBuffer()
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}
