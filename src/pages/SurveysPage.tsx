import { useState, useEffect, useMemo, useCallback, useRef, type ReactElement } from 'react'
import { api, type FlatReservation } from '../lib/supabase'
import { getDefaultDateRange } from '../lib/dateUtils'
import { useToast } from '../components/Toast'
import { fmtNum } from '../lib/utils'
import { RESERVATION_STATUS } from '../constants'
import Modal from '../components/Modal'
import SurveySubmissionForm, { type SurveyReservationOption } from '../components/SurveySubmissionForm'
import type { ReservationStatus } from '../types'

type SortField = 'date' | 'company' | 'status'
type SortOrder = 'asc' | 'desc'
type SurveyFilter = 'all' | 'pending' | 'completed'

const STATUS_OPTIONS: { value: ReservationStatus; label: string }[] = [
  { value: 'confirmed', label: '확정' },
  { value: 'pending', label: '대기' },
  { value: 'completed', label: '완료' },
  { value: 'cancelled', label: '취소' },
  { value: 'no_show', label: '노쇼' },
]

const SURVEY_FORM_ID = 'survey-admin-form'
const PAGE_SIZE = 20

const SurveysPage = (): ReactElement => {
  const toast = useToast()
  const defaultRange = useMemo(() => getDefaultDateRange(), [])

  // Table data
  const [data, setData] = useState<FlatReservation[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)

  // Filters
  const DEFAULT_STATUSES: ReservationStatus[] = ['confirmed', 'completed']
  const [selectedStatuses, setSelectedStatuses] = useState<ReservationStatus[]>(DEFAULT_STATUSES)
  const [startDate, setStartDate] = useState(defaultRange.startDate)
  const [endDate, setEndDate] = useState(defaultRange.endDate)
  const [surveyFilter, setSurveyFilter] = useState<SurveyFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Survey modal
  const [surveyModalOpen, setSurveyModalOpen] = useState(false)
  const [surveyTarget, setSurveyTarget] = useState<FlatReservation | null>(null)
  const [surveyOptions, setSurveyOptions] = useState<SurveyReservationOption[]>([])
  const [surveyTableNotConfigured, setSurveyTableNotConfigured] = useState(false)
  const [surveySubmitting, setSurveySubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Cleanup
  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }
  }, [])

  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(value)
      setCurrentPage(1)
    }, 300)
  }

  const toggleStatus = (status: ReservationStatus) => {
    setSelectedStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    )
    setCurrentPage(1)
  }

  const handleResetFilters = () => {
    setSelectedStatuses(DEFAULT_STATUSES)
    setStartDate(defaultRange.startDate)
    setEndDate(defaultRange.endDate)
    setSurveyFilter('all')
    setSearchQuery('')
    setDebouncedSearch('')
    setCurrentPage(1)
  }

  const statusesChanged = selectedStatuses.length !== DEFAULT_STATUSES.length || !DEFAULT_STATUSES.every((s) => selectedStatuses.includes(s))
  const hasActiveFilters =
    statusesChanged ||
    startDate !== defaultRange.startDate ||
    endDate !== defaultRange.endDate ||
    surveyFilter !== 'all' ||
    debouncedSearch

  // Fetch table data
  const fetchData = useCallback(async () => {
    setLoading(true)
    const { data: result, error } = await api.reservations.getPaginated({
      page: currentPage,
      pageSize: PAGE_SIZE,
      statuses: selectedStatuses.length > 0 ? selectedStatuses : undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      surveyStatus: surveyFilter !== 'all' ? surveyFilter : undefined,
      search: debouncedSearch || undefined,
      sortField,
      sortOrder,
    })
    if (error) {
      setData([])
      setTotalCount(0)
    } else if (result) {
      setData(result.data)
      setTotalCount(result.totalCount)
    }
    setLoading(false)
  }, [currentPage, selectedStatuses, startDate, endDate, surveyFilter, debouncedSearch, sortField, sortOrder])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Pagination
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const getPageNumbers = (): number[] => {
    const pages: number[] = []
    let start = Math.max(1, currentPage - 2)
    const end = Math.min(totalPages, start + 4)
    start = Math.max(1, end - 4)
    for (let i = start; i <= end; i++) pages.push(i)
    return pages
  }

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortOrder('desc') }
    setCurrentPage(1)
  }

  const sortIcon = (field: SortField) => {
    if (sortField !== field) return ''
    return sortOrder === 'asc' ? ' \u2191' : ' \u2193'
  }

  // ─── Survey modal ────────────────────────────────────

  const existingSurvey = surveyOptions[0]?.survey ?? null

  const closeSurveyModal = () => {
    setSurveyModalOpen(false)
    setSurveyTarget(null)
    setConfirmDelete(false)
  }

  const handleOpenSurvey = async (r: FlatReservation) => {
    setSurveyTarget(r)
    setConfirmDelete(false)

    const result = await api.surveys.getByReservationIds([r.id])
    const existing = result.data?.find((s) => s.reservation_id === r.id) || null
    setSurveyTableNotConfigured(Boolean(result.notConfigured))

    setSurveyOptions([{
      reservationId: r.id,
      label: `${r.reservation_date} · ${r.time_slot === 'morning' ? '오전' : '오후'} · ${r.company_name || '-'}`,
      survey: existing,
    }])
    setSurveyModalOpen(true)
  }

  const handleSurveySubmitted = () => {
    closeSurveyModal()
    fetchData()
  }

  const handleDeleteSurvey = async () => {
    if (!existingSurvey) return

    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }

    setDeleting(true)
    const result = await api.surveys.delete(existingSurvey.id)
    if (result.error) {
      toast.error(`삭제 실패 : ${result.error.message}`)
    } else {
      toast.success('만족도조사 내역을 삭제했습니다.')
      closeSurveyModal()
      fetchData()
    }
    setDeleting(false)
  }

  return (
    <div className="h-full flex flex-col bg-bg-primary overflow-hidden">
      {/* Header */}
      <header className="border-b border-border bg-bg-secondary/60 backdrop-blur-xl flex-shrink-0 z-10">
        <div className="px-4 py-3 md:px-6 md:py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-lg md:text-xl font-bold text-text-primary">만족도 관리</h1>
              <p className="text-xs text-text-tertiary mt-0.5">
                총 {fmtNum(totalCount, 0)}건
                {hasActiveFilters && ' · 필터 적용됨'}
              </p>
            </div>
            <button className="btn btn-ghost text-sm p-1.5 md:py-1.5 md:px-3 flex items-center gap-1.5" onClick={fetchData} aria-label="새로고침">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10"/>
                <polyline points="1 20 1 14 7 14"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
              <span className="hidden md:inline">새로고침</span>
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="px-4 md:px-6 py-2.5 border-t border-border/50 flex flex-wrap items-center gap-2 md:gap-3">
          <div className="flex items-center gap-1.5">
            <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1) }} className="input text-xs py-1 px-2 w-[130px]" />
            <span className="text-text-tertiary text-xs">~</span>
            <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1) }} className="input text-xs py-1 px-2 w-[130px]" />
          </div>

          <div className="relative">
            <input type="text" placeholder="기업명, 업종, 대표자..." value={searchQuery} onChange={(e) => handleSearchChange(e.target.value)} className="input text-xs py-1 pl-7 pr-2 w-40 md:w-48" />
            <svg className="absolute left-2 top-1/2 -translate-y-1/2 text-text-tertiary" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>

          <div className="flex items-center gap-1">
            {STATUS_OPTIONS.map((opt) => {
              const isActive = selectedStatuses.includes(opt.value)
              return (
                <button key={opt.value} type="button" onClick={() => toggleStatus(opt.value)}
                  className={`px-2 py-0.5 text-[11px] rounded-full border transition-all ${
                    isActive ? 'bg-primary/20 text-primary border-primary/40 font-medium' : 'bg-transparent text-text-tertiary border-border hover:text-text-secondary hover:border-border-hover'
                  }`}
                >{opt.label}</button>
              )
            })}
          </div>

          <select value={surveyFilter} onChange={(e) => { setSurveyFilter(e.target.value as SurveyFilter); setCurrentPage(1) }} className="input text-xs py-1 px-2">
            <option value="all">만족도 전체</option>
            <option value="pending">미완료</option>
            <option value="completed">완료</option>
          </select>

          {hasActiveFilters && (
            <button type="button" onClick={handleResetFilters} className="text-[11px] text-text-tertiary hover:text-text-primary transition-colors flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
              초기화
            </button>
          )}
        </div>
      </header>

      {/* Content area */}
      <div className="flex-1 p-3 md:p-6 pb-0 flex flex-col min-h-0 overflow-hidden">
        {/* Scrollable table */}
        <div className="flex-1 overflow-auto min-h-0">
          {loading ? (
            <div className="p-8 text-center"><div className="skeleton h-64 w-full" /></div>
          ) : (
            <table className="table text-sm w-full">
              <thead className="sticky top-0 z-10 bg-bg-primary">
                <tr>
                  <th className="col-left text-xs whitespace-nowrap">번호</th>
                  <th className="col-left cursor-pointer select-none text-xs whitespace-nowrap" onClick={() => toggleSort('date')}>예약일{sortIcon('date')}</th>
                  <th className="col-center text-xs whitespace-nowrap">시간</th>
                  <th className="col-left cursor-pointer select-none text-xs" onClick={() => toggleSort('company')}>기업명{sortIcon('company')}</th>
                  <th className="col-left text-xs">장비</th>
                  <th className="col-center cursor-pointer select-none text-xs whitespace-nowrap" onClick={() => toggleSort('status')}>상태{sortIcon('status')}</th>
                  <th className="col-center text-xs whitespace-nowrap">만족도</th>
                </tr>
              </thead>
              <tbody>
                {data.map((r) => {
                  const sc = RESERVATION_STATUS[r.status as ReservationStatus]
                  const startHour = r.time_slot === 'morning' ? 9 : 13
                  const slotStart = new Date(`${r.reservation_date}T${String(startHour).padStart(2, '0')}:00:00`)
                  const isPast = slotStart <= new Date()
                  return (
                    <tr key={r.id} className="cursor-pointer hover:bg-bg-tertiary/40 transition-colors" onClick={() => handleOpenSurvey(r)}>
                      <td className="col-left font-mono text-[10px] text-text-tertiary whitespace-nowrap">{r.reserve_idx || '-'}</td>
                      <td className="col-left font-mono text-xs whitespace-nowrap">{r.reservation_date}</td>
                      <td className="col-center whitespace-nowrap">
                        <span className={`badge text-[10px] ${r.time_slot === 'morning' ? 'badge-primary' : 'badge-success'}`}>
                          {r.time_slot === 'morning' ? '오전' : '오후'}
                        </span>
                      </td>
                      <td className="col-left font-medium" title={r.company_name || ''}>{r.company_name || '-'}</td>
                      <td className="col-left">
                        <div className="flex flex-wrap gap-0.5">
                          {(r.equipment_types || []).slice(0, 2).map((eq: string, i: number) => (
                            <span key={i} className="text-[10px] bg-bg-tertiary px-1.5 py-0.5 rounded whitespace-nowrap">{eq}</span>
                          ))}
                          {(r.equipment_types || []).length > 2 && (
                            <span className="text-[10px] text-text-tertiary">+{r.equipment_types.length - 2}</span>
                          )}
                        </div>
                      </td>
                      <td className="col-center whitespace-nowrap">
                        <span className={`badge text-[10px] ${sc?.class || 'badge-primary'}`}>{sc?.label || r.status}</span>
                      </td>
                      <td className="col-center whitespace-nowrap">
                        {!isPast ? (
                          <span className="text-text-tertiary text-xs">-</span>
                        ) : r.has_survey ? (
                          <span className="badge text-[10px] badge-success">완료</span>
                        ) : (
                          <span className="badge text-[10px] badge-muted">미완료</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
          {!loading && data.length === 0 && (
            <div className="text-center py-16 text-text-tertiary">
              {hasActiveFilters ? '조건에 맞는 예약이 없습니다.' : '예약 데이터가 없습니다.'}
            </div>
          )}
        </div>

        {/* Pagination — fixed outside scroll area */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between px-2 pt-3 pb-3 flex-shrink-0 border-t border-border/30">
            <span className="text-xs text-text-tertiary">
              {totalCount}건 중 {(currentPage - 1) * PAGE_SIZE + 1}-{Math.min(currentPage * PAGE_SIZE, totalCount)}
            </span>
            <div className="flex items-center gap-1">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="w-7 h-7 flex items-center justify-center rounded-md text-text-secondary hover:bg-bg-tertiary disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              {getPageNumbers().map((p) => (
                <button key={p} onClick={() => setCurrentPage(p)} className={`w-7 h-7 flex items-center justify-center rounded-md text-xs font-medium transition-colors ${p === currentPage ? 'bg-primary/20 text-primary' : 'text-text-secondary hover:bg-bg-tertiary'}`}>{p}</button>
              ))}
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="w-7 h-7 flex items-center justify-center rounded-md text-text-secondary hover:bg-bg-tertiary disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Survey Modal (3-section: header / scrollable form / footer) ─── */}
      <Modal
        isOpen={surveyModalOpen}
        onClose={closeSurveyModal}
        title={
          surveyTarget ? (
            <>
              만족도조사{existingSurvey ? ' 수정' : ' 입력'}
              <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm font-normal">
                <div className="text-text-secondary">
                  <span className="text-text-tertiary">예약일 </span>
                  {surveyTarget.reservation_date}
                </div>
                <div className="text-text-secondary">
                  <span className="text-text-tertiary">시간 </span>
                  <span className={`badge text-[10px] ${surveyTarget.time_slot === 'morning' ? 'badge-primary' : 'badge-success'}`}>
                    {surveyTarget.time_slot === 'morning' ? '오전' : '오후'}
                  </span>
                </div>
                <div className="text-text-secondary">
                  <span className="text-text-tertiary">기업 </span>
                  {surveyTarget.company_name || '-'}
                </div>
                <div className="text-text-secondary">
                  <span className="text-text-tertiary">장비 </span>
                  {(surveyTarget.equipment_types || []).join(', ') || '-'}
                </div>
              </div>
            </>
          ) : '만족도조사'
        }
        size="lg"
        footer={
          <div className="flex items-center justify-between">
            {/* 좌측: 삭제 */}
            <div>
              {existingSurvey && (
                confirmDelete ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-danger">정말 삭제하시겠습니까?</span>
                    <button
                      type="button"
                      onClick={handleDeleteSurvey}
                      disabled={deleting}
                      className="btn text-xs py-1 px-3 bg-danger/20 text-danger border border-danger/30 hover:bg-danger/30"
                    >
                      {deleting ? '삭제 중...' : '확인'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="btn btn-ghost text-xs py-1 px-2"
                    >
                      취소
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleDeleteSurvey}
                    className="btn btn-ghost text-xs py-1.5 px-3 text-danger hover:bg-danger/10"
                  >
                    삭제
                  </button>
                )
              )}
            </div>

            {/* 우측: 닫기 + 제출 */}
            <div className="flex items-center gap-2">
              <button type="button" onClick={closeSurveyModal} className="btn btn-ghost text-sm">
                닫기
              </button>
              <button
                type="submit"
                form={SURVEY_FORM_ID}
                disabled={surveySubmitting}
                className="btn btn-primary text-sm"
              >
                {surveySubmitting ? '저장 중...' : (existingSurvey ? '수정' : '제출')}
              </button>
            </div>
          </div>
        }
      >
        {/* 중앙: 스크롤 가능한 설문 폼 */}
        <div className="p-4 md:p-6">
          <SurveySubmissionForm
            embedded
            formId={SURVEY_FORM_ID}
            options={surveyOptions}
            surveyTableNotConfigured={surveyTableNotConfigured}
            onSubmitted={handleSurveySubmitted}
            onSubmittingChange={setSurveySubmitting}
          />
        </div>
      </Modal>
    </div>
  )
}

export default SurveysPage
