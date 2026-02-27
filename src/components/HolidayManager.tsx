import { useState, useEffect, useMemo, type FormEvent } from 'react'
import {
  fetchHolidaysForYear,
  getCustomHolidayEntries,
  addCustomHoliday,
  removeCustomHoliday,
  clearHolidayCache,
  type HolidayEntry,
  type CustomHolidayEntry,
} from '../lib/holidays'
import { getBusinessDaysInMonth } from '../lib/dateUtils'
import { getOperatingDaysForMonth } from '../lib/holidays'
import { useToast } from './Toast'
import Modal from './Modal'

const WEEKDAY_NAMES = ['일', '월', '화', '수', '목', '금', '토']

const todayString = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface MonthSummary {
  month: number
  label: string
  basicDays: number
  operatingDays: number
  holidayCount: number
}

const HolidayManager = () => {
  const toast = useToast()
  const currentYear = new Date().getFullYear()

  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [apiHolidays, setApiHolidays] = useState<HolidayEntry[]>([])
  const [customHolidays, setCustomHolidays] = useState<CustomHolidayEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [filterText, setFilterText] = useState('')

  // 추가 모달
  const [showAddModal, setShowAddModal] = useState(false)
  const [newDate, setNewDate] = useState('')
  const [newName, setNewName] = useState('')

  // 월별 영업일 요약
  const [monthlySummary, setMonthlySummary] = useState<MonthSummary[]>([])

  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 1 + i)

  const loadHolidays = async (forceRefresh = false) => {
    setLoading(true)
    setApiError(null)

    if (forceRefresh) {
      clearHolidayCache(selectedYear)
    }

    try {
      const holidays = await fetchHolidaysForYear(selectedYear)
      setApiHolidays(holidays)

      if (holidays.length === 0) {
        setApiError('API 키 미설정 또는 데이터 없음')
      }
    } catch {
      setApiError('API 호출 실패')
    }

    setLoading(false)
  }

  const loadCustom = () => {
    setCustomHolidays(getCustomHolidayEntries())
  }

  const loadMonthlySummary = async () => {
    const summaries: MonthSummary[] = []
    for (let m = 1; m <= 12; m++) {
      const basicDays = getBusinessDaysInMonth(selectedYear, m)
      const operatingDays = await getOperatingDaysForMonth(selectedYear, m)

      const prefix = `${selectedYear}-${String(m).padStart(2, '0')}`
      const monthApiCount = apiHolidays.filter((h) => h.date.startsWith(prefix)).length
      const monthCustomCount = customHolidays.filter((c) => c.date.startsWith(prefix)).length

      summaries.push({
        month: m,
        label: `${m}월`,
        basicDays,
        operatingDays,
        holidayCount: monthApiCount + monthCustomCount,
      })
    }
    setMonthlySummary(summaries)
  }

  useEffect(() => {
    loadHolidays()
    loadCustom()
  }, [selectedYear])

  useEffect(() => {
    if (!loading) {
      loadMonthlySummary()
    }
  }, [apiHolidays, customHolidays, loading])

  const yearCustomHolidays = useMemo(
    () => customHolidays.filter((c) => c.date.startsWith(String(selectedYear))),
    [customHolidays, selectedYear]
  )

  const allHolidays = useMemo(() => {
    const apiList = apiHolidays.map((h) => ({ ...h, source: 'api' as const }))
    const customList = yearCustomHolidays.map((c) => ({ date: c.date, name: c.name, source: 'custom' as const }))

    const map = new Map<string, typeof apiList[number]>()
    for (const item of [...customList, ...apiList]) {
      map.set(item.date, item)
    }

    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date))
  }, [apiHolidays, yearCustomHolidays])

  const filteredHolidays = useMemo(() => {
    if (!filterText.trim()) return allHolidays
    const q = filterText.trim().toLowerCase()
    return allHolidays.filter(
      (h) => h.date.includes(q) || h.name.toLowerCase().includes(q)
    )
  }, [allHolidays, filterText])

  const handleAdd = (e: FormEvent) => {
    e.preventDefault()
    if (!newDate) {
      toast.error('날짜를 선택해주세요.')
      return
    }

    const name = newName.trim() || '지정 휴무'

    if (allHolidays.some((h) => h.date === newDate)) {
      toast.error('이미 등록된 날짜입니다.')
      return
    }

    addCustomHoliday(newDate, name)
    loadCustom()
    setNewDate('')
    setNewName('')
    setShowAddModal(false)
    toast.success(`${newDate} (${name}) 추가됨`)
  }

  const handleRemove = (date: string) => {
    removeCustomHoliday(date)
    loadCustom()
    toast.success(`${date} 삭제됨`)
  }

  const handleRefresh = () => {
    loadHolidays(true)
    toast.success('공휴일 캐시를 갱신했습니다.')
  }

  const openAddModal = () => {
    setNewDate(todayString())
    setNewName('')
    setShowAddModal(true)
  }

  const getDayOfWeek = (dateStr: string): string => {
    const d = new Date(dateStr)
    return WEEKDAY_NAMES[d.getDay()]
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* 상단 바 */}
      <div className="flex items-center justify-between gap-3 mb-4 shrink-0">
        <div className="flex items-center gap-3">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="input text-sm py-1.5 px-3"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>{y}년</option>
            ))}
          </select>
          <button
            onClick={handleRefresh}
            className="text-xs py-1.5 px-3 rounded-lg border border-border bg-white/90 text-gray-800 hover:bg-white transition-colors"
          >
            API 캐시 갱신
          </button>
          {apiError && (
            <span className="text-xs text-warning">{apiError}</span>
          )}
          {!apiError && apiHolidays.length > 0 && (
            <span className="text-xs text-text-tertiary">
              법정공휴일 {apiHolidays.length}건
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={openAddModal} className="btn btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            휴무일 추가
          </button>
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="날짜·명칭 검색"
              className="input text-sm py-1.5 pl-8 pr-3 w-40"
            />
          </div>
        </div>
      </div>

      {/* 메인 그리드 */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-6 flex-1 min-h-0">
        {/* 왼쪽: 월별 영업일 요약 */}
        <div className="flex flex-col min-h-0">
          <div className="flex items-center gap-1.5 mb-3 shrink-0">
            <h4 className="text-sm font-semibold text-text-primary">
              {selectedYear}년 월별 영업일
            </h4>
            <div className="relative group">
              <button
                type="button"
                className="w-4 h-4 rounded-full border border-text-muted/40 text-text-muted text-[10px] font-semibold leading-none flex items-center justify-center hover:border-text-secondary hover:text-text-secondary transition-colors"
              >
                i
              </button>
              <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 w-56 px-3 py-2 rounded-lg bg-bg-primary border border-border shadow-lg text-[11px] text-text-secondary leading-relaxed opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-20">
                <p>기본 = 주말(토/일) 제외 일수</p>
                <p>영업일 = 기본 - 공휴일 - 지정휴무</p>
                <p className="mt-1 text-text-muted">통계 페이지 가동률에 자동 반영</p>
              </div>
            </div>
          </div>
          {/* 헤더 */}
          <table className="table text-sm w-full shrink-0">
            <thead>
              <tr>
                <th className="col-left">월</th>
                <th className="col-right">기본</th>
                <th className="col-right">휴일</th>
                <th className="col-right">영업일</th>
              </tr>
            </thead>
          </table>
          {/* 스크롤 바디 */}
          <div className="flex-1 overflow-auto min-h-0">
            <table className="table text-sm w-full">
              <tbody>
                {monthlySummary.map((row) => {
                  const diff = row.basicDays - row.operatingDays
                  return (
                    <tr key={row.month}>
                      <td className="col-left font-medium">{row.label}</td>
                      <td className="col-right tabular-nums">{row.basicDays}</td>
                      <td className="col-right tabular-nums">
                        {diff > 0 ? (
                          <span className="text-danger">-{diff}</span>
                        ) : (
                          <span className="text-text-muted">0</span>
                        )}
                      </td>
                      <td className="col-right tabular-nums font-semibold">{row.operatingDays}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {/* 합계 (하단 고정) */}
          {monthlySummary.length > 0 && (
            <table className="table text-sm w-full shrink-0 border-t-2 border-border">
              <tbody>
                <tr className="font-semibold">
                  <td className="col-left">합계</td>
                  <td className="col-right tabular-nums">
                    {monthlySummary.reduce((s, r) => s + r.basicDays, 0)}
                  </td>
                  <td className="col-right tabular-nums text-danger">
                    -{monthlySummary.reduce((s, r) => s + (r.basicDays - r.operatingDays), 0)}
                  </td>
                  <td className="col-right tabular-nums">
                    {monthlySummary.reduce((s, r) => s + r.operatingDays, 0)}
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </div>

        {/* 오른쪽: 휴일 목록 */}
        <div className="flex flex-col min-h-0">
          <h4 className="text-sm font-semibold text-text-primary mb-3 shrink-0">
            {selectedYear}년 휴일 목록
            <span className="text-text-tertiary font-normal ml-1">
              ({filteredHolidays.length}{filterText ? `/${allHolidays.length}` : ''}건)
            </span>
          </h4>
          <div className="flex-1 overflow-auto min-h-0">
            {loading ? (
              <div className="text-center py-8">
                <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-2" />
                <p className="text-sm text-text-tertiary">공휴일 조회 중...</p>
              </div>
            ) : (
              <table className="table text-sm w-full">
                <thead className="sticky top-0 z-10 bg-bg-secondary">
                  <tr>
                    <th className="col-left">날짜</th>
                    <th className="col-center">요일</th>
                    <th className="col-left">명칭</th>
                    <th className="col-center">구분</th>
                    <th className="col-center">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHolidays.map((h) => (
                    <tr key={h.date}>
                      <td className="col-left font-mono text-xs">{h.date}</td>
                      <td className="col-center text-xs">{getDayOfWeek(h.date)}</td>
                      <td className="col-left">{h.name}</td>
                      <td className="col-center">
                        <span className={`badge text-[10px] ${
                          h.source === 'api' ? 'badge-primary' : 'badge-warning'
                        }`}>
                          {h.source === 'api' ? '법정' : '지정'}
                        </span>
                      </td>
                      <td className="col-center">
                        {h.source === 'custom' ? (
                          <button
                            onClick={() => handleRemove(h.date)}
                            className="btn-ghost text-xs px-2 py-1 text-danger"
                          >
                            삭제
                          </button>
                        ) : (
                          <span className="text-[10px] text-text-muted">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredHolidays.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-text-tertiary">
                        {filterText ? '검색 결과가 없습니다.' : '등록된 휴일이 없습니다.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* 휴무일 추가 모달 */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="휴무일 추가"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-ghost text-sm py-2 px-4">
              취소
            </button>
            <button type="submit" form="holiday-add-form" className="btn btn-primary text-sm py-2 px-4">
              추가
            </button>
          </div>
        }
      >
        <form id="holiday-add-form" onSubmit={handleAdd} className="space-y-4 p-6">
          <div>
            <label className="text-xs text-text-tertiary block mb-1.5">날짜</label>
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              min={`${selectedYear}-01-01`}
              max={`${selectedYear}-12-31`}
              className="input text-sm py-2 px-3 w-full"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs text-text-tertiary block mb-1.5">명칭</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="예: 임시공휴일, 창립기념일"
              className="input text-sm py-2 px-3 w-full"
            />
            <p className="text-[11px] text-text-muted mt-1">미입력 시 &quot;지정 휴무&quot;로 저장됩니다.</p>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default HolidayManager
