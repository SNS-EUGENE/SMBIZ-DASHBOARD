/**
 * 월간 날짜 범위 계산 헬퍼
 * Supabase 쿼리용 startDate, endDate 반환
 */
export function getMonthDateRange(year: number, month: number): { startDate: string; endDate: string } {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endDate = month === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(month + 1).padStart(2, '0')}-01`
  return { startDate, endDate }
}

/**
 * 월간 날짜 범위(포함) 계산
 * getMonthDateRange와 달리 endDate는 말일입니다.
 */
export function getMonthDateBounds(year: number, month: number): { startDate: string; endDate: string } {
  const endDay = new Date(year, month, 0).getDate()
  return {
    startDate: `${year}-${String(month).padStart(2, '0')}-01`,
    endDate: `${year}-${String(month).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`,
  }
}

/** 연간 날짜 범위(포함) */
export function getYearDateBounds(year: number): { startDate: string; endDate: string } {
  return {
    startDate: `${year}-01-01`,
    endDate: `${year}-12-31`,
  }
}

/** YYYY-MM-DD 문자열에서 YYYY-MM 추출 */
export function toMonthKey(date: string): string {
  return date.slice(0, 7)
}

/**
 * 월 영업일 계산 (주말 제외, 공휴일 선택적 제외)
 * holidays: ['YYYY-MM-DD', ...]
 */
export function getBusinessDaysInMonth(year: number, month: number, holidays: string[] = []): number {
  const endDay = new Date(year, month, 0).getDate()
  const holidaySet = new Set(holidays)
  let count = 0

  for (let day = 1; day <= endDay; day++) {
    const date = new Date(year, month - 1, day)
    const dow = date.getDay()
    if (dow === 0 || dow === 6) continue

    const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    if (holidaySet.has(key)) continue

    count++
  }

  return count
}

/**
 * 연도 선택지 동적 생성
 * 현재 연도 기준 -2 ~ +1년
 */
export function getYearOptions(): number[] {
  const currentYear = new Date().getFullYear()
  const years: number[] = []
  for (let y = currentYear - 2; y <= currentYear + 1; y++) {
    years.push(y)
  }
  return years
}

/**
 * 월 내 주차별 평일(월~금) 날짜 배열 반환
 * weekNumber는 1부터 시작
 */
export function getWeekdaysForWeek(year: number, month: number, weekNumber: number): string[] {
  const endDay = new Date(year, month, 0).getDate()
  const weeks: string[][] = []
  let currentWeek: string[] = []

  for (let day = 1; day <= endDay; day++) {
    const date = new Date(year, month - 1, day)
    const dow = date.getDay()
    if (dow === 0 || dow === 6) continue

    if (dow === 1 && currentWeek.length > 0) {
      weeks.push(currentWeek)
      currentWeek = []
    }
    const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    currentWeek.push(key)
  }
  if (currentWeek.length > 0) weeks.push(currentWeek)

  return weeks[weekNumber - 1] || []
}

/**
 * 해당 월의 주 수 (월~금 기준 그룹)
 */
export function getWeekCountInMonth(year: number, month: number): number {
  const endDay = new Date(year, month, 0).getDate()
  let weekCount = 0
  let hasCurrentWeek = false

  for (let day = 1; day <= endDay; day++) {
    const date = new Date(year, month - 1, day)
    const dow = date.getDay()
    if (dow === 0 || dow === 6) continue

    if (dow === 1) {
      if (hasCurrentWeek) weekCount++
      hasCurrentWeek = true
    }
    if (!hasCurrentWeek) hasCurrentWeek = true
  }
  if (hasCurrentWeek) weekCount++

  return weekCount
}

/**
 * 오늘 기준 ±N일 범위의 YYYY-MM-DD 문자열 반환
 * 기본값: ±14일 (약 1개월)
 */
export function getDefaultDateRange(offsetDays = 14): { startDate: string; endDate: string } {
  const today = new Date()
  const start = new Date(today)
  start.setDate(today.getDate() - offsetDays)
  const end = new Date(today)
  end.setDate(today.getDate() + offsetDays)

  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  return { startDate: fmt(start), endDate: fmt(end) }
}
