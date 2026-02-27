import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { format } from 'date-fns'
import { Check } from 'lucide-react'
import { api } from '../lib/supabase'
import { useToast } from './Toast'
import Modal from './Modal'
import { getWeekCountInMonth, getWeekdaysForWeek } from '../lib/dateUtils'
import { getHolidaysForMonth, getCustomHolidays } from '../lib/holidays'
import { INSPECTION_EQUIPMENT, EQUIPMENT_CHECK_CRITERIA } from '../constants/inspections'
import { notifyEquipmentInspection } from '../lib/notifications'
import type { EquipmentInspection } from '../types'

interface Props {
  year: number
  month: number
}

const DAY_HEADERS = ['일', '월', '화', '수', '목', '금', '토']
const WEEKDAY_SHORT = ['일', '월', '화', '수', '목', '금', '토']

const EQUIP_COLORS = [
  'bg-blue-400',
  'bg-indigo-400',
  'bg-teal-400',
  'bg-emerald-400',
  'bg-amber-400',
  'bg-rose-400',
  'bg-violet-400',
]

const EquipmentInspectionTab = ({ year, month }: Props) => {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [inspections, setInspections] = useState<Map<number, EquipmentInspection>>(new Map())
  const [inspector, setInspector] = useState('')
  const [modalWeek, setModalWeek] = useState<number | null>(null)
  const [modalNotes, setModalNotes] = useState('')
  const [hoveredWeek, setHoveredWeek] = useState<number | null>(null)
  const [holidays, setHolidays] = useState<Set<string>>(new Set())
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const modalNotesRef = useRef('')

  const weekCount = getWeekCountInMonth(year, month)
  const weeks = Array.from({ length: weekCount }, (_, i) => i + 1)
  const totalComponents = INSPECTION_EQUIPMENT.reduce((sum, eq) => sum + eq.components.length, 0)

  const todayStr = format(new Date(), 'yyyy-MM-dd')

  // Load holidays
  useEffect(() => {
    const load = async () => {
      const apiH = await getHolidaysForMonth(year, month)
      const custom = getCustomHolidays()
      const prefix = `${year}-${String(month).padStart(2, '0')}`
      const monthCustom = custom.filter((d) => d.startsWith(prefix))
      setHolidays(new Set([...apiH, ...monthCustom]))
    }
    load()
  }, [year, month])

  // Current week
  const currentWeek = useMemo(() => {
    const now = new Date()
    if (now.getFullYear() !== year || now.getMonth() + 1 !== month) return null
    const today = format(now, 'yyyy-MM-dd')
    for (let w = 1; w <= weekCount; w++) {
      const dates = getWeekdaysForWeek(year, month, w)
      if (dates.includes(today)) return w
    }
    return null
  }, [year, month, weekCount])

  // Calendar grid
  const calendarGrid = useMemo(() => {
    const daysInMonth = new Date(year, month, 0).getDate()
    const firstDow = new Date(year, month - 1, 1).getDay()
    const grid: (number | null)[] = []
    for (let i = 0; i < firstDow; i++) grid.push(null)
    for (let d = 1; d <= daysInMonth; d++) grid.push(d)
    while (grid.length % 7 !== 0) grid.push(null)
    return grid
  }, [year, month])

  const rowCount = Math.ceil(calendarGrid.length / 7)

  // Map each weekday → week info
  const weekInfo = useMemo(() => {
    const info = new Map<string, { weekNum: number; isFirst: boolean; isLast: boolean }>()
    for (let w = 1; w <= weekCount; w++) {
      const dates = getWeekdaysForWeek(year, month, w)
      dates.forEach((d, i) => {
        info.set(d, { weekNum: w, isFirst: i === 0, isLast: i === dates.length - 1 })
      })
    }
    return info
  }, [year, month, weekCount])

  const toDateStr = (day: number) =>
    `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

  // Week date range helper (extends to full Mon-Fri even across months)
  const getWeekDateRange = useCallback((weekNum: number) => {
    const dates = getWeekdaysForWeek(year, month, weekNum)
    if (dates.length === 0) return ''
    const parse = (s: string) => {
      const [y, m, d] = s.split('-').map(Number)
      return new Date(y, m - 1, d)
    }
    const first = parse(dates[0])
    const last = parse(dates[dates.length - 1])

    // Extend to Monday of the week
    const monday = new Date(first)
    while (monday.getDay() !== 1) monday.setDate(monday.getDate() - 1)
    // Extend to Friday of the week
    const friday = new Date(last)
    while (friday.getDay() !== 5) friday.setDate(friday.getDate() + 1)

    const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAY_SHORT[d.getDay()]})`
    return `${fmt(monday)} ~ ${fmt(friday)}`
  }, [year, month])

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true)
    const { data, error } = await api.inspections.getEquipmentByMonth(year, month)
    if (error) {
      toast.error('장비 점검 조회 실패 : ' + error.message)
    } else {
      const map = new Map<number, EquipmentInspection>()
      data?.forEach((item) => {
        map.set(item.week_number, item)
        if (!inspector && item.inspector) setInspector(item.inspector)
      })
      setInspections(map)
    }
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month])

  useEffect(() => { fetchData() }, [fetchData])

  // Helpers
  const getCompletionForWeek = (week: number) => {
    const record = inspections.get(week)
    if (!record) return 0
    return INSPECTION_EQUIPMENT.reduce((sum, eq) =>
      sum + eq.components.filter((comp) => record.checks?.[`${eq.key}/${comp.key}`]).length, 0
    )
  }

  const getEquipCompletion = (week: number, equipKey: string) => {
    const equip = INSPECTION_EQUIPMENT.find((e) => e.key === equipKey)
    if (!equip) return { done: 0, total: 0 }
    const record = inspections.get(week)
    const done = equip.components.filter((comp) => record?.checks?.[`${equip.key}/${comp.key}`]).length
    return { done, total: equip.components.length }
  }

  const completedWeeks = weeks.filter((w) => getCompletionForWeek(w) === totalComponents).length

  // Modal open
  const openModal = (week: number) => {
    const record = inspections.get(week)
    const n = record?.notes || ''
    setModalNotes(n)
    modalNotesRef.current = n
    setModalWeek(week)
  }

  const handleModalNotesChange = (value: string) => {
    setModalNotes(value)
    modalNotesRef.current = value
  }

  // Actions
  const performInspection = async (week: number) => {
    const allChecks: Record<string, boolean> = {}
    INSPECTION_EQUIPMENT.forEach((eq) => {
      eq.components.forEach((comp) => { allChecks[`${eq.key}/${comp.key}`] = true })
    })
    const record = inspections.get(week)
    const newRecord: EquipmentInspection = {
      id: record?.id || '', year, month, week_number: week, checks: allChecks,
      inspector: inspector || null, notes: modalNotesRef.current || null,
      created_at: record?.created_at || '', updated_at: '',
    }
    setInspections((prev) => new Map(prev).set(week, newRecord))

    setSaveStatus('saving')
    const { error } = await api.inspections.upsertEquipmentCheck(year, month, week, allChecks, inspector || null, modalNotesRef.current || null)
    if (error) { toast.error('저장 실패 : ' + error.message); setSaveStatus('idle') }
    else { setSaveStatus('saved'); setTimeout(() => setSaveStatus('idle'), 1500) }
  }

  const cancelInspection = async (week: number) => {
    const record = inspections.get(week)
    const emptyChecks: Record<string, boolean> = {}
    const newRecord: EquipmentInspection = {
      id: record?.id || '', year, month, week_number: week, checks: emptyChecks,
      inspector: inspector || null, notes: modalNotesRef.current || null,
      created_at: record?.created_at || '', updated_at: '',
    }
    setInspections((prev) => new Map(prev).set(week, newRecord))

    setSaveStatus('saving')
    const { error } = await api.inspections.upsertEquipmentCheck(year, month, week, emptyChecks, inspector || null, modalNotesRef.current || null)
    if (error) { toast.error('취소 실패 : ' + error.message); setSaveStatus('idle') }
    else { setSaveStatus('saved'); setTimeout(() => setSaveStatus('idle'), 1500) }
  }

  const toggleCheck = (week: number, equipKey: string, compKey: string) => {
    const checkKey = `${equipKey}/${compKey}`
    const record = inspections.get(week)
    const current = record?.checks?.[checkKey] ?? false
    const newChecks = { ...(record?.checks || {}), [checkKey]: !current }
    const newRecord: EquipmentInspection = {
      id: record?.id || '', year, month, week_number: week, checks: newChecks,
      inspector: inspector || null, notes: modalNotesRef.current || null,
      created_at: record?.created_at || '', updated_at: '',
    }
    setInspections((prev) => new Map(prev).set(week, newRecord))

    if (debounceRef.current) clearTimeout(debounceRef.current)
    setSaveStatus('saving')
    debounceRef.current = setTimeout(async () => {
      const { error } = await api.inspections.upsertEquipmentCheck(year, month, week, newChecks, inspector || null, modalNotesRef.current || null)
      if (error) { toast.error('저장 실패 : ' + error.message); setSaveStatus('idle') }
      else { setSaveStatus('saved'); setTimeout(() => setSaveStatus('idle'), 1500) }
    }, 300)
  }

  const handleSubmit = async () => {
    if (!modalWeek) return
    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null }
    const record = inspections.get(modalWeek)
    setSaveStatus('saving')
    const { error } = await api.inspections.upsertEquipmentCheck(
      year, month, modalWeek, record?.checks || {}, inspector || null, modalNotesRef.current || null
    )
    if (error) {
      toast.error('저장 실패 : ' + error.message)
      setSaveStatus('idle')
      return
    }
    if (record) {
      const updated = { ...record, notes: modalNotesRef.current || null, inspector: inspector || null }
      setInspections((prev) => new Map(prev).set(modalWeek, updated))
    }
    setSaveStatus('saved')
    setTimeout(() => setSaveStatus('idle'), 1500)
    toast.success('저장 완료')

    // 카카오워크 알림
    const weekRange = getWeekDateRange(modalWeek)
    notifyEquipmentInspection({
      weekLabel: `${year}년 ${month}월 ${modalWeek}주차 (${weekRange})`,
      issues: modalNotesRef.current || null,
      inspector: inspector || '-',
    })

    setModalWeek(null)
  }

  const modalCompleted = modalWeek ? getCompletionForWeek(modalWeek) : 0

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border/50 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-tertiary">주간 점검 · {EQUIPMENT_CHECK_CRITERIA}</span>
          <span className="text-sm font-semibold text-text-primary">
            {completedWeeks}<span className="text-text-tertiary font-normal">/{weeks.length}주</span>
          </span>
          {completedWeeks === weeks.length && weeks.length > 0 && (
            <span className="text-[11px] text-success font-medium px-2 py-0.5 bg-success/10 rounded-full">이번 달 완료</span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 text-[11px] text-text-tertiary">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-success" /> 완료
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-warning" /> 부분
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-border/50" /> 미시행
            </span>
          </div>
          {saveStatus === 'saving' && <span className="text-xs text-warning">저장 중...</span>}
          {saveStatus === 'saved' && <span className="text-xs text-success">저장 완료</span>}
        </div>
      </div>

      {/* Calendar - fills remaining space */}
      <div className="flex-1 overflow-hidden min-h-0 flex flex-col px-5 py-6">
        {loading ? (
          <div className="flex items-center justify-center flex-1 text-text-tertiary text-sm">로딩 중...</div>
        ) : (
          <div
            className="grid grid-cols-7 gap-px bg-border/15 rounded-xl overflow-hidden flex-1 min-h-0"
            style={{ gridTemplateRows: `auto repeat(${rowCount}, 1fr)` }}
          >
            {/* Day headers (first row) */}
            {DAY_HEADERS.map((d, i) => (
              <div
                key={d}
                className={`bg-bg-primary flex items-center justify-center py-2.5 text-xs font-semibold ${
                  i === 0 ? 'text-danger/60' : i === 6 ? 'text-blue-400/60' : 'text-text-tertiary'
                }`}
              >
                {d}
              </div>
            ))}

            {/* Calendar cells */}
            {calendarGrid.map((day, i) => {
              if (!day) return <div key={i} className="bg-bg-primary" />

              const dateStr = toDateStr(day)
              const cellDow = new Date(year, month - 1, day).getDay()
              const isWeekend = cellDow === 0 || cellDow === 6
              const isHoliday = holidays.has(dateStr)
              const isToday = dateStr === todayStr
              const info = weekInfo.get(dateStr)
              const isBusinessDay = !!info && !isHoliday
              const weekNum = info?.weekNum ?? 0
              const isCurrent = weekNum === currentWeek
              const isHovered = isBusinessDay && weekNum === hoveredWeek

              // Week completion (same for all days in a week)
              const completed = weekNum > 0 ? getCompletionForWeek(weekNum) : 0
              const isComplete = weekNum > 0 && completed === totalComponents
              const isPartial = weekNum > 0 && completed > 0 && !isComplete

              return (
                <div
                  key={i}
                  className={`relative flex flex-col p-2.5 transition-all bg-bg-primary ${
                    isBusinessDay ? 'cursor-pointer' : ''
                  } ${
                    isHovered ? 'bg-bg-tertiary/25' : ''
                  } ${
                    isToday && isBusinessDay
                      ? 'ring-1.5 ring-inset ring-primary bg-primary/5'
                      : isCurrent && isBusinessDay
                        ? 'ring-1 ring-inset ring-primary/20'
                        : ''
                  }`}
                  onClick={() => isBusinessDay && openModal(weekNum)}
                  onMouseEnter={() => isBusinessDay && setHoveredWeek(weekNum)}
                  onMouseLeave={() => setHoveredWeek(null)}
                >
                  {/* Status dot (top-right) */}
                  {isBusinessDay && (
                    <span className={`absolute top-2 right-2 w-2 h-2 rounded-full ${
                      isComplete ? 'bg-success' : isPartial ? 'bg-warning' : 'bg-border/50'
                    }`} />
                  )}

                  <span className={`text-base leading-none ${
                    isToday && isBusinessDay
                      ? 'font-bold text-primary'
                      : isComplete
                        ? 'font-semibold text-success'
                        : isWeekend || isHoliday
                          ? 'text-text-tertiary/40'
                          : isBusinessDay
                            ? 'text-text-primary'
                            : 'text-text-tertiary/40'
                  }`}>
                    {day}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <Modal
        isOpen={!!modalWeek}
        onClose={() => setModalWeek(null)}
        title={
          <div>
            <div className="flex items-center gap-2.5">
              <span>{month}월 {modalWeek}주차 장비 점검</span>
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                {modalCompleted}/{totalComponents}
              </span>
            </div>
            {modalWeek && (
              <span className="text-xs text-text-tertiary font-normal">
                {getWeekDateRange(modalWeek)}
              </span>
            )}
          </div>
        }
        size="lg"
        footer={
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => { if (modalWeek) cancelInspection(modalWeek) }}
                className="px-3 py-1.5 text-xs text-text-tertiary hover:text-danger hover:bg-danger/10 rounded-lg transition-colors"
              >
                전체 해제
              </button>
              <button
                onClick={() => { if (modalWeek) performInspection(modalWeek) }}
                className="px-3 py-1.5 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors"
              >
                전체 시행
              </button>
            </div>
            <button
              onClick={handleSubmit}
              className="px-5 py-1.5 text-xs font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors"
            >
              제출하기
            </button>
          </div>
        }
      >
        {modalWeek && (
          <>
            <div className="p-5 grid grid-cols-2 gap-3">
              {INSPECTION_EQUIPMENT.map((equip, idx) => {
                const color = EQUIP_COLORS[idx % EQUIP_COLORS.length]
                const { done, total } = getEquipCompletion(modalWeek, equip.key)
                const pct = total > 0 ? (done / total) * 100 : 0

                return (
                  <div key={equip.key} className="rounded-lg border border-border/30 bg-bg-primary/50">
                    <div className="p-3.5">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-text-secondary tracking-wide">{equip.label}</span>
                        <span className="text-xs text-text-tertiary font-medium">{done}/{total}</span>
                      </div>
                      <div className="w-full h-1 bg-bg-tertiary/60 rounded-full mb-3">
                        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                      </div>
                      <div className="space-y-1">
                        {equip.components.map((comp) => {
                          const checked = inspections.get(modalWeek)?.checks?.[`${equip.key}/${comp.key}`] ?? false
                          return (
                            <label
                              key={comp.key}
                              onClick={() => toggleCheck(modalWeek, equip.key, comp.key)}
                              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs cursor-pointer transition-all ${
                                checked
                                  ? 'bg-success/10 text-success border border-success/20'
                                  : 'bg-bg-tertiary/40 text-text-tertiary border border-transparent hover:text-text-secondary hover:bg-bg-tertiary/60'
                              }`}
                            >
                              {checked ? (
                                <Check size={11} className="flex-shrink-0" />
                              ) : (
                                <span className="w-2.5 h-2.5 rounded-sm border border-current flex-shrink-0" />
                              )}
                              {comp.label}
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Notes & Inspector */}
            <div className="px-5 pb-5 space-y-3">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">고장 및 특이사항</label>
                <textarea
                  value={modalNotes}
                  onChange={(e) => handleModalNotesChange(e.target.value)}
                  placeholder="고장 내용, 특이사항 등을 입력하세요..."
                  rows={2}
                  className="input text-sm w-full resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">확인자</label>
                <input
                  type="text"
                  value={inspector}
                  onChange={(e) => setInspector(e.target.value)}
                  placeholder="이름"
                  className="input text-sm w-full"
                />
              </div>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}

export default EquipmentInspectionTab
