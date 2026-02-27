import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { format, parseISO } from 'date-fns'
import { Check } from 'lucide-react'
import { api } from '../lib/supabase'
import { useToast } from './Toast'
import Modal from './Modal'
import { getHolidaysForMonth, getCustomHolidays } from '../lib/holidays'
import { FACILITY_CHECK_CATEGORIES, ALL_FACILITY_CHECK_ITEMS } from '../constants/inspections'
import { notifyFacilityInspection } from '../lib/notifications'
import type { FacilityInspection } from '../types'

interface Props {
  year: number
  month: number
}

const DAY_HEADERS = ['일', '월', '화', '수', '목', '금', '토']
const WEEKDAY_SHORT = ['일', '월', '화', '수', '목', '금', '토']

const CATEGORY_COLORS: Record<string, string> = {
  led: 'bg-amber-400',
  orbitview: 'bg-blue-400',
  office: 'bg-emerald-400',
  storage: 'bg-violet-400',
}

const FacilityInspectionTab = ({ year, month }: Props) => {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [inspections, setInspections] = useState<Map<string, FacilityInspection>>(new Map())
  const [inspector, setInspector] = useState('')
  const [holidays, setHolidays] = useState<Set<string>>(new Set())
  const [modalDate, setModalDate] = useState<string | null>(null)
  const [modalNotes, setModalNotes] = useState('')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const modalNotesRef = useRef('')

  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const totalItems = ALL_FACILITY_CHECK_ITEMS.length

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

  const toDateStr = (day: number) =>
    `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

  // Business days
  const businessDays = useMemo(() => {
    const endDay = new Date(year, month, 0).getDate()
    const days: string[] = []
    for (let d = 1; d <= endDay; d++) {
      const date = new Date(year, month - 1, d)
      const dow = date.getDay()
      if (dow === 0 || dow === 6) continue
      const key = toDateStr(d)
      if (holidays.has(key)) continue
      days.push(key)
    }
    return days
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, holidays])

  // Fetch
  const fetchData = useCallback(async () => {
    setLoading(true)
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endDay = new Date(year, month, 0).getDate()
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`
    const { data, error } = await api.inspections.getFacilityByDateRange(startDate, endDate)
    if (error) {
      toast.error('시설 점검 조회 실패 : ' + error.message)
    } else {
      const map = new Map<string, FacilityInspection>()
      data?.forEach((item) => {
        map.set(item.inspection_date, item)
        if (!inspector && item.inspector) setInspector(item.inspector)
      })
      setInspections(map)
    }
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month])

  useEffect(() => { fetchData() }, [fetchData])

  // Completion helpers
  const getCompletionForDate = (date: string) => {
    const record = inspections.get(date)
    if (!record) return 0
    return ALL_FACILITY_CHECK_ITEMS.filter((item) => record.checks?.[item.key]).length
  }

  const completedDays = businessDays.filter((d) => getCompletionForDate(d) === totalItems).length

  const getCategoryCompletion = (date: string, categoryId: string) => {
    const cat = FACILITY_CHECK_CATEGORIES.find((c) => c.id === categoryId)
    if (!cat) return { done: 0, total: 0 }
    const record = inspections.get(date)
    const done = cat.items.filter((item) => record?.checks?.[item.key]).length
    return { done, total: cat.items.length }
  }

  // Modal open
  const openModal = (date: string) => {
    const record = inspections.get(date)
    const n = record?.notes || ''
    setModalNotes(n)
    modalNotesRef.current = n
    setModalDate(date)
  }

  const handleModalNotesChange = (value: string) => {
    setModalNotes(value)
    modalNotesRef.current = value
  }

  // Actions
  const performInspection = async (date: string) => {
    const allChecks: Record<string, boolean> = {}
    ALL_FACILITY_CHECK_ITEMS.forEach((item) => { allChecks[item.key] = true })
    const record = inspections.get(date)
    const newRecord: FacilityInspection = {
      id: record?.id || '', inspection_date: date, checks: allChecks,
      inspector: inspector || null, notes: modalNotesRef.current || null,
      created_at: record?.created_at || '', updated_at: '',
    }
    setInspections((prev) => new Map(prev).set(date, newRecord))
    setSaveStatus('saving')
    const { error } = await api.inspections.upsertFacilityCheck(date, allChecks, inspector || null, modalNotesRef.current || null)
    if (error) { toast.error('저장 실패 : ' + error.message); setSaveStatus('idle') }
    else { setSaveStatus('saved'); setTimeout(() => setSaveStatus('idle'), 1500) }
  }

  const cancelInspection = async (date: string) => {
    const record = inspections.get(date)
    const emptyChecks: Record<string, boolean> = {}
    const newRecord: FacilityInspection = {
      id: record?.id || '', inspection_date: date, checks: emptyChecks,
      inspector: inspector || null, notes: modalNotesRef.current || null,
      created_at: record?.created_at || '', updated_at: '',
    }
    setInspections((prev) => new Map(prev).set(date, newRecord))
    setSaveStatus('saving')
    const { error } = await api.inspections.upsertFacilityCheck(date, emptyChecks, inspector || null, modalNotesRef.current || null)
    if (error) { toast.error('취소 실패 : ' + error.message); setSaveStatus('idle') }
    else { setSaveStatus('saved'); setTimeout(() => setSaveStatus('idle'), 1500) }
  }

  const toggleCheck = (date: string, itemKey: string) => {
    const record = inspections.get(date)
    const current = record?.checks?.[itemKey] ?? false
    const newChecks = { ...(record?.checks || {}), [itemKey]: !current }
    const newRecord: FacilityInspection = {
      id: record?.id || '', inspection_date: date, checks: newChecks,
      inspector: inspector || null, notes: modalNotesRef.current || null,
      created_at: record?.created_at || '', updated_at: '',
    }
    setInspections((prev) => new Map(prev).set(date, newRecord))
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setSaveStatus('saving')
    debounceRef.current = setTimeout(async () => {
      const { error } = await api.inspections.upsertFacilityCheck(date, newChecks, inspector || null, modalNotesRef.current || null)
      if (error) { toast.error('저장 실패 : ' + error.message); setSaveStatus('idle') }
      else { setSaveStatus('saved'); setTimeout(() => setSaveStatus('idle'), 1500) }
    }, 300)
  }

  const handleSubmit = async () => {
    if (!modalDate) return
    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null }
    const record = inspections.get(modalDate)
    setSaveStatus('saving')
    const { error } = await api.inspections.upsertFacilityCheck(
      modalDate, record?.checks || {}, inspector || null, modalNotesRef.current || null
    )
    if (error) {
      toast.error('저장 실패 : ' + error.message)
      setSaveStatus('idle')
      return
    }
    if (record) {
      const updated = { ...record, notes: modalNotesRef.current || null, inspector: inspector || null }
      setInspections((prev) => new Map(prev).set(modalDate, updated))
    }
    setSaveStatus('saved')
    setTimeout(() => setSaveStatus('idle'), 1500)
    toast.success('저장 완료')

    // 카카오워크 알림
    notifyFacilityInspection({
      date: modalDate,
      issues: modalNotesRef.current || null,
      inspector: inspector || '-',
    })

    setModalDate(null)
  }

  // Modal helpers
  const modalTitle = modalDate
    ? `${format(parseISO(modalDate), 'M월 d일')} (${WEEKDAY_SHORT[parseISO(modalDate).getDay()]}) 시설 점검`
    : ''
  const modalCompleted = modalDate ? getCompletionForDate(modalDate) : 0

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border/50 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-tertiary">운영일 점검</span>
          <span className="text-sm font-semibold text-text-primary">
            {completedDays}<span className="text-text-tertiary font-normal">/{businessDays.length}일</span>
          </span>
          {completedDays === businessDays.length && businessDays.length > 0 && (
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
              const isBusinessDay = !isWeekend && !isHoliday
              const isToday = dateStr === todayStr
              const completed = isBusinessDay ? getCompletionForDate(dateStr) : 0
              const isComplete = isBusinessDay && completed === totalItems
              const isPartial = isBusinessDay && completed > 0 && !isComplete

              return (
                <div
                  key={i}
                  className={`relative bg-bg-primary flex flex-col p-2.5 transition-all ${
                    isBusinessDay ? 'cursor-pointer hover:bg-bg-tertiary/20' : ''
                  } ${
                    isToday
                      ? 'ring-1.5 ring-inset ring-primary bg-primary/5'
                      : isComplete
                        ? 'bg-success/5'
                        : ''
                  }`}
                  onClick={() => isBusinessDay && openModal(dateStr)}
                >
                  {/* Status dot (top-right) */}
                  {isBusinessDay && (
                    <span className={`absolute top-2 right-2 w-2 h-2 rounded-full ${
                      isComplete ? 'bg-success' : isPartial ? 'bg-warning' : 'bg-border/50'
                    }`} />
                  )}

                  <span className={`text-base leading-none ${
                    isToday
                      ? 'font-bold text-primary'
                      : isComplete
                        ? 'font-semibold text-success'
                        : isWeekend || isHoliday
                          ? 'text-text-tertiary/40'
                          : 'text-text-primary'
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
        isOpen={!!modalDate}
        onClose={() => setModalDate(null)}
        title={
          <span className="flex items-center gap-2.5">
            {modalTitle}
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
              {modalCompleted}/{totalItems}
            </span>
          </span>
        }
        size="lg"
        footer={
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => { if (modalDate) cancelInspection(modalDate) }}
                className="px-3 py-1.5 text-xs text-text-tertiary hover:text-danger hover:bg-danger/10 rounded-lg transition-colors"
              >
                전체 해제
              </button>
              <button
                onClick={() => { if (modalDate) performInspection(modalDate) }}
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
        {modalDate && (
          <>
            <div className="p-5 grid grid-cols-2 gap-3">
              {FACILITY_CHECK_CATEGORIES.map((category) => {
                const color = CATEGORY_COLORS[category.id] || CATEGORY_COLORS.led
                const { done, total } = getCategoryCompletion(modalDate, category.id)
                const pct = total > 0 ? (done / total) * 100 : 0

                return (
                  <div key={category.id} className="rounded-lg border border-border/30 bg-bg-primary/50">
                    <div className="p-3.5">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-text-secondary tracking-wide">{category.label}</span>
                        <span className="text-xs text-text-tertiary font-medium">{done}/{total}</span>
                      </div>
                      <div className="w-full h-1 bg-bg-tertiary/60 rounded-full mb-3">
                        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {category.items.map((item) => {
                          const checked = inspections.get(modalDate)?.checks?.[item.key] ?? false
                          return (
                            <label
                              key={item.key}
                              onClick={() => toggleCheck(modalDate, item.key)}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs cursor-pointer transition-all ${
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
                              {item.label}
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
                <label className="block text-xs font-medium text-text-secondary mb-1">고장 및 수리 사항</label>
                <textarea
                  value={modalNotes}
                  onChange={(e) => handleModalNotesChange(e.target.value)}
                  placeholder="고장 내용, 수리 필요 사항 등을 입력하세요..."
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

export default FacilityInspectionTab
