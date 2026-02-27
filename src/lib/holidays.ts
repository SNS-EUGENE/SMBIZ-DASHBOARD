/**
 * 공휴일 API (data.go.kr 특일정보 - 15012690)
 *
 * API 엔드포인트: http://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo
 * 필수 파라미터: serviceKey, solYear
 * 선택 파라미터: solMonth, _type, numOfRows
 *
 * 응답 예시 (JSON):
 * {
 *   "response": {
 *     "body": {
 *       "items": {
 *         "item": [
 *           { "dateKind": "01", "dateName": "설날", "isHoliday": "Y", "locdate": 20260101, "seq": 1 }
 *         ]
 *       },
 *       "totalCount": 18
 *     }
 *   }
 * }
 */

const HOLIDAY_API_BASE =
  'https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo'

// env variable for API key
const SERVICE_KEY = import.meta.env.VITE_DATA_GO_KR_API_KEY || ''

// localStorage cache key prefix
const CACHE_PREFIX = 'smbiz_holidays_'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24시간

interface HolidayApiItem {
  dateKind: string
  dateName: string
  isHoliday: string
  locdate: number
  seq: number
}

interface HolidayApiResponse {
  response: {
    header: { resultCode: string; resultMsg: string }
    body: {
      items: { item: HolidayApiItem | HolidayApiItem[] } | ''
      totalCount: number
    }
  }
}

export interface HolidayEntry {
  date: string // YYYY-MM-DD
  name: string
}

interface CachedHolidays {
  holidays: HolidayEntry[]
  fetchedAt: number
}

/**
 * locdate (20260101) → 'YYYY-MM-DD' 변환
 */
function locdateToString(locdate: number): string {
  const s = String(locdate)
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
}

/**
 * 연도별 공휴일 조회 (API 호출 + 캐시)
 */
export async function fetchHolidaysForYear(year: number): Promise<HolidayEntry[]> {
  // 1) 캐시 확인
  const cacheKey = `${CACHE_PREFIX}${year}`
  try {
    const cached = localStorage.getItem(cacheKey)
    if (cached) {
      const parsed: CachedHolidays = JSON.parse(cached)
      if (Date.now() - parsed.fetchedAt < CACHE_TTL_MS) {
        return parsed.holidays
      }
    }
  } catch {
    // 캐시 파싱 실패 시 무시
  }

  // 2) API 키가 없으면 빈 배열 반환 (수동 입력 모드)
  if (!SERVICE_KEY) {
    console.warn('[holidays] VITE_DATA_GO_KR_API_KEY 미설정 → 공휴일 API 비활성')
    return []
  }

  // 3) API 호출
  // data.go.kr: serviceKey는 URLSearchParams 인코딩 없이 직접 붙여야 함 (이중 인코딩 방지)
  const otherParams = new URLSearchParams({
    solYear: String(year),
    _type: 'json',
    numOfRows: '100',
  })

  try {
    const res = await fetch(`${HOLIDAY_API_BASE}?serviceKey=${SERVICE_KEY}&${otherParams.toString()}`)
    if (!res.ok) {
      console.error(`[holidays] API 응답 오류: ${res.status}`)
      return []
    }

    const json: HolidayApiResponse = await res.json()
    const body = json.response?.body

    if (!body || !body.items || body.items === '') {
      return []
    }

    const rawItems = body.items.item
    const items: HolidayApiItem[] = Array.isArray(rawItems) ? rawItems : [rawItems]

    const holidays: HolidayEntry[] = items
      .filter((item) => item.isHoliday === 'Y')
      .map((item) => ({
        date: locdateToString(item.locdate),
        name: item.dateName,
      }))

    // 4) 캐시 저장
    try {
      const cacheData: CachedHolidays = { holidays, fetchedAt: Date.now() }
      localStorage.setItem(cacheKey, JSON.stringify(cacheData))
    } catch {
      // 스토리지 quota 초과 등 무시
    }

    return holidays
  } catch (err) {
    console.error('[holidays] API 호출 실패:', err)
    return []
  }
}

/**
 * 특정 월의 공휴일 날짜 목록 (YYYY-MM-DD[])
 */
export async function getHolidaysForMonth(year: number, month: number): Promise<string[]> {
  const holidays = await fetchHolidaysForYear(year)
  const prefix = `${year}-${String(month).padStart(2, '0')}`
  return holidays.filter((h) => h.date.startsWith(prefix)).map((h) => h.date)
}

/**
 * 커스텀 휴무일 관리 (localStorage 기반)
 */
const CUSTOM_HOLIDAYS_KEY = 'smbiz_custom_holidays_v2'
const LEGACY_CUSTOM_KEY = 'smbiz_custom_holidays'

export interface CustomHolidayEntry {
  date: string  // YYYY-MM-DD
  name: string
}

export function getCustomHolidayEntries(): CustomHolidayEntry[] {
  try {
    const raw = localStorage.getItem(CUSTOM_HOLIDAYS_KEY)
    if (raw) return JSON.parse(raw)

    // 레거시 마이그레이션 (날짜만 저장된 경우)
    const legacy = localStorage.getItem(LEGACY_CUSTOM_KEY)
    if (legacy) {
      const dates: string[] = JSON.parse(legacy)
      const migrated = dates.map((d) => ({ date: d, name: '커스텀 휴무' }))
      localStorage.setItem(CUSTOM_HOLIDAYS_KEY, JSON.stringify(migrated))
      return migrated
    }
  } catch {
    // ignore
  }
  return []
}

export function getCustomHolidays(): string[] {
  return getCustomHolidayEntries().map((e) => e.date)
}

export function setCustomHolidayEntries(entries: CustomHolidayEntry[]): void {
  localStorage.setItem(CUSTOM_HOLIDAYS_KEY, JSON.stringify(entries))
}

export function addCustomHoliday(date: string, name = '커스텀 휴무'): void {
  const current = getCustomHolidayEntries()
  if (!current.some((e) => e.date === date)) {
    current.push({ date, name })
    current.sort((a, b) => a.date.localeCompare(b.date))
    setCustomHolidayEntries(current)
  }
}

export function removeCustomHoliday(date: string): void {
  const current = getCustomHolidayEntries().filter((e) => e.date !== date)
  setCustomHolidayEntries(current)
}

/**
 * API 캐시 삭제 (강제 새로고침용)
 */
export function clearHolidayCache(year?: number): void {
  if (year) {
    localStorage.removeItem(`${CACHE_PREFIX}${year}`)
  } else {
    // 전체 캐시 삭제
    for (let y = 2020; y <= 2035; y++) {
      localStorage.removeItem(`${CACHE_PREFIX}${y}`)
    }
  }
}

/**
 * 공휴일 API + 커스텀 휴무일을 합쳐서 월별 영업일 수 계산
 */
export async function getOperatingDaysForMonth(year: number, month: number): Promise<number> {
  const apiHolidays = await getHolidaysForMonth(year, month)
  const customHolidays = getCustomHolidays()

  const prefix = `${year}-${String(month).padStart(2, '0')}`
  const monthCustom = customHolidays.filter((d) => d.startsWith(prefix))

  const allHolidays = [...new Set([...apiHolidays, ...monthCustom])]

  // dateUtils의 getBusinessDaysInMonth 로직과 동일
  const endDay = new Date(year, month, 0).getDate()
  const holidaySet = new Set(allHolidays)
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
