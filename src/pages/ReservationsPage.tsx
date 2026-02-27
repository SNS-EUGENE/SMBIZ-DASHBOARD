import { useState, useEffect, useCallback, useRef, type ReactElement } from 'react'
import { api, type FlatReservation } from '../lib/supabase'
import { useToast } from '../components/Toast'
import Modal from '../components/Modal'
import ReservationForm, { RESERVATION_FORM_ID, type ReservationFormHandle } from '../components/ReservationForm'
import { fmtNum } from '../lib/utils'
import { getDefaultDateRange } from '../lib/dateUtils'
import ReservationDetailModal, { type ReservationDetail } from '../components/ReservationDetailModal'
import { RESERVATION_STATUS } from '../constants'
import { notifyReservationCancelled } from '../lib/notifications'
import type { ReservationStatus } from '../types'

type SortField = 'date' | 'company' | 'status'
type SortOrder = 'asc' | 'desc'
type SurveyFilter = 'all' | 'pending' | 'completed'

interface ConfirmState {
  show: boolean
  title: string
  message: string
  type: 'warning' | 'danger'
  onConfirm: (() => Promise<void>) | null
}

const STATUS_OPTIONS: { value: ReservationStatus; label: string }[] = [
  { value: 'confirmed', label: '확정' },
  { value: 'pending', label: '대기' },
  { value: 'completed', label: '완료' },
  { value: 'cancelled', label: '취소' },
  { value: 'no_show', label: '노쇼' },
]

const PAGE_SIZE = 20

const ReservationsPage = (): ReactElement => {
  const toast = useToast()

  // Server-side paginated data
  const [data, setData] = useState<FlatReservation[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)

  // Filters & sort
  const DEFAULT_STATUSES: ReservationStatus[] = ['confirmed', 'completed']
  const [selectedStatuses, setSelectedStatuses] = useState<ReservationStatus[]>(DEFAULT_STATUSES)
  const defaultRange = getDefaultDateRange()
  const [startDate, setStartDate] = useState(defaultRange.startDate)
  const [endDate, setEndDate] = useState(defaultRange.endDate)
  const [surveyFilter, setSurveyFilter] = useState<SurveyFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Modal states
  const [showFormModal, setShowFormModal] = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const formRef = useRef<ReservationFormHandle>(null)
  const [editingReservation, setEditingReservation] = useState<FlatReservation | null>(null)
  const [detailReservation, setDetailReservation] = useState<ReservationDetail | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [confirmModal, setConfirmModal] = useState<ConfirmState>({
    show: false, title: '', message: '', type: 'warning', onConfirm: null,
  })

  // Cleanup search timer
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
      prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status]
    )
    setCurrentPage(1)
  }

  const handleResetFilters = () => {
    const range = getDefaultDateRange()
    setSelectedStatuses(DEFAULT_STATUSES)
    setStartDate(range.startDate)
    setEndDate(range.endDate)
    setSurveyFilter('all')
    setSearchQuery('')
    setDebouncedSearch('')
    setCurrentPage(1)
  }

  const statusesChanged = selectedStatuses.length !== DEFAULT_STATUSES.length || !DEFAULT_STATUSES.every((s) => selectedStatuses.includes(s))
  const hasActiveFilters = statusesChanged || startDate !== defaultRange.startDate || endDate !== defaultRange.endDate || surveyFilter !== 'all' || debouncedSearch

  // Server-side fetch
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
      toast.error('예약 목록 조회 실패 : ' + error.message)
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
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('desc')
    }
    setCurrentPage(1)
  }

  const sortIcon = (field: SortField) => {
    if (sortField !== field) return ''
    return sortOrder === 'asc' ? ' \u2191' : ' \u2193'
  }

  // Handlers
  const handleAdd = () => {
    setEditingReservation(null)
    setShowFormModal(true)
  }

  const handleEdit = (r: FlatReservation) => {
    setEditingReservation(r)
    setShowFormModal(true)
  }

  const handleSaved = () => {
    setShowFormModal(false)
    setEditingReservation(null)
    fetchData()
  }

  const handleViewDetail = (r: FlatReservation) => {
    setDetailReservation({
      id: r.id,
      company_id: r.company_id,
      reservation_date: r.reservation_date,
      time_slot: r.time_slot,
      status: r.status,
      attendees: r.attendees,
      is_training: r.is_training,
      is_seminar: r.is_seminar,
      work_2d: r.work_2d,
      work_3d: r.work_3d,
      work_video: r.work_video,
      notes: r.notes,
      company_name: r.company_name || '',
      industry: r.industry || '',
      representative: r.representative || '',
      contact: r.contact || '',
      district: r.district ?? undefined,
      equipment_types: r.equipment_types || [],
      reserve_idx: r.reserve_idx ?? null,
      end_date: r.end_date ?? null,
      start_time: r.start_time ?? null,
      end_time: r.end_time ?? null,
      request_notes: r.request_notes ?? null,
      business_license_url: r.business_license_url ?? null,
      small_biz_cert_url: r.small_biz_cert_url ?? null,
      business_number: r.business_number ?? null,
      company_size: r.company_size ?? null,
    })
    setShowDetailModal(true)
  }

  const handleCancel = (id: string) => {
    setConfirmModal({
      show: true,
      title: '예약 취소',
      message: '이 예약을 취소하시겠습니까?',
      type: 'warning',
      onConfirm: async () => {
        const { error } = await api.reservations.cancel(id)
        if (error) {
          toast.error('취소 실패 : ' + error.message)
        } else {
          toast.success('예약이 취소되었습니다.')
          const row = data.find(r => r.id === id)
          if (row) {
            notifyReservationCancelled({
              date: row.reservation_date,
              timeSlot: row.time_slot,
              equipment: row.equipment_types || [],
              companyName: row.company_name || '(미상)',
            })
          }
          fetchData()
        }
        setConfirmModal((p) => ({ ...p, show: false }))
      },
    })
  }

  const handleNoShow = (id: string, companyId: string | undefined) => {
    if (!companyId) { toast.error('기업 정보를 찾을 수 없습니다.'); return }
    setConfirmModal({
      show: true,
      title: '노쇼 처리',
      message: '이 예약을 노쇼 처리하시겠습니까?\n해당 기업은 1주일간 예약이 제한됩니다.',
      type: 'danger',
      onConfirm: async () => {
        const { error } = await api.reservations.markNoShow(id, companyId)
        if (error) toast.error('노쇼 처리 실패 : ' + error.message)
        else { toast.warning('노쇼 처리 완료'); fetchData() }
        setConfirmModal((p) => ({ ...p, show: false }))
      },
    })
  }

  const handleDelete = (id: string) => {
    setConfirmModal({
      show: true,
      title: '예약 삭제',
      message: '이 예약을 완전히 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.',
      type: 'danger',
      onConfirm: async () => {
        const { error } = await api.reservations.delete(id)
        if (error) toast.error('삭제 실패 : ' + error.message)
        else { toast.success('예약이 삭제되었습니다.'); fetchData() }
        setConfirmModal((p) => ({ ...p, show: false }))
      },
    })
  }

  return (
    <div className="h-full flex flex-col bg-bg-primary overflow-hidden">
      {/* Header */}
      <header className="border-b border-border bg-bg-secondary/60 backdrop-blur-xl flex-shrink-0 z-10">
        <div className="px-4 py-3 md:px-6 md:py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-lg md:text-xl font-bold text-text-primary">예약 관리</h1>
              <p className="text-xs text-text-tertiary mt-0.5">
                총 {fmtNum(totalCount, 0)}건
                {hasActiveFilters && ' · 필터 적용됨'}
              </p>
            </div>

            <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
              <button className="btn btn-ghost text-sm p-1.5 md:py-1.5 md:px-3 flex items-center gap-1.5" onClick={fetchData} aria-label="새로고침">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10"/>
                  <polyline points="1 20 1 14 7 14"/>
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                </svg>
                <span className="hidden md:inline">새로고침</span>
              </button>
              <button onClick={handleAdd} className="btn btn-primary text-sm p-1.5 md:py-1.5 md:px-3 flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M7 2V12M2 7H12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <span className="hidden md:inline">예약 추가</span>
              </button>
            </div>
          </div>
        </div>

        {/* Filter bar */}
        <div className="px-4 md:px-6 py-2.5 border-t border-border/50 flex flex-wrap items-center gap-2 md:gap-3">
          {/* Date range */}
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1) }}
              className="input text-xs py-1 px-2 w-[130px]"
              placeholder="시작일"
            />
            <span className="text-text-tertiary text-xs">~</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1) }}
              className="input text-xs py-1 px-2 w-[130px]"
              placeholder="종료일"
            />
          </div>

          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="기업명, 업종, 대표자..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="input text-xs py-1 pl-7 pr-2 w-40 md:w-48"
            />
            <svg className="absolute left-2 top-1/2 -translate-y-1/2 text-text-tertiary" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>

          {/* Status chips */}
          <div className="flex items-center gap-1">
            {STATUS_OPTIONS.map((opt) => {
              const isActive = selectedStatuses.includes(opt.value)
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleStatus(opt.value)}
                  className={`px-2 py-0.5 text-[11px] rounded-full border transition-all ${
                    isActive
                      ? 'bg-primary/20 text-primary border-primary/40 font-medium'
                      : 'bg-transparent text-text-tertiary border-border hover:text-text-secondary hover:border-border-hover'
                  }`}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>

          {/* Survey filter */}
          <select
            value={surveyFilter}
            onChange={(e) => { setSurveyFilter(e.target.value as SurveyFilter); setCurrentPage(1) }}
            className="input text-xs py-1 px-2"
          >
            <option value="all">만족도 전체</option>
            <option value="pending">미완료</option>
            <option value="completed">완료</option>
          </select>

          {/* Reset */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-[11px] text-text-tertiary hover:text-text-primary transition-colors flex items-center gap-1"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
              초기화
            </button>
          )}
        </div>
      </header>

      {/* Table */}
      <div className="flex-1 p-3 md:p-6 flex flex-col min-h-0 overflow-hidden">
        <div className="flex-1 overflow-auto min-h-0">
          {loading ? (
            <div className="p-8 text-center">
              <div className="skeleton h-64 w-full" />
            </div>
          ) : (
            <table className="table text-sm w-full">
              <thead className="sticky top-0 z-10 bg-bg-secondary">
                <tr>
                  <th className="col-left text-xs whitespace-nowrap">번호</th>
                  <th className="col-left cursor-pointer select-none text-xs whitespace-nowrap" onClick={() => toggleSort('date')}>
                    예약일{sortIcon('date')}
                  </th>
                  <th className="col-center text-xs whitespace-nowrap">시간</th>
                  <th className="col-left cursor-pointer select-none text-xs" onClick={() => toggleSort('company')}>
                    기업명{sortIcon('company')}
                  </th>
                  <th className="col-left text-xs">업종</th>
                  <th className="col-left text-xs">대표자</th>
                  <th className="col-left text-xs">장비</th>
                  <th className="col-center cursor-pointer select-none text-xs whitespace-nowrap" onClick={() => toggleSort('status')}>
                    상태{sortIcon('status')}
                  </th>
                  <th className="col-center text-xs whitespace-nowrap">만족도</th>
                  <th className="col-center text-xs whitespace-nowrap">작업</th>
                </tr>
              </thead>
              <tbody>
                {data.map((r) => {
                  const sc = RESERVATION_STATUS[r.status as ReservationStatus]
                  return (
                    <tr
                      key={r.id}
                      className={`cursor-pointer hover:bg-bg-tertiary/40 transition-colors ${
                        r.status === 'no_show' ? 'bg-red-900/5' : ''
                      }`}
                      onClick={() => handleViewDetail(r)}
                    >
                      <td className="col-left font-mono text-[10px] text-text-tertiary whitespace-nowrap">{r.reserve_idx || '-'}</td>
                      <td className="col-left font-mono text-xs whitespace-nowrap">{r.reservation_date}</td>
                      <td className="col-center whitespace-nowrap">
                        <span className={`badge text-[10px] ${r.time_slot === 'morning' ? 'badge-primary' : 'badge-success'}`}>
                          {r.time_slot === 'morning' ? '오전' : '오후'}
                        </span>
                      </td>
                      <td className="col-left font-medium" title={r.company_name || ''}>{r.company_name || '-'}</td>
                      <td className="col-left text-text-secondary text-xs" title={r.industry || ''}>{r.industry || '-'}</td>
                      <td className="col-left text-text-secondary text-xs whitespace-nowrap">{r.representative || '-'}</td>
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
                        {(() => {
                          const startHour = r.time_slot === 'morning' ? 9 : 13
                          const slotStart = new Date(`${r.reservation_date}T${String(startHour).padStart(2, '0')}:00:00`)
                          const isPast = slotStart <= new Date()
                          if (!isPast) return <span className="text-text-tertiary">-</span>
                          return r.has_survey
                            ? <span className="badge text-[10px] badge-success">완료</span>
                            : <span className="badge text-[10px] badge-muted">미완료</span>
                        })()}
                      </td>
                      <td className="col-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => handleEdit(r)} className="btn-ghost text-xs px-1.5 py-1">수정</button>
                          {r.status === 'confirmed' && (
                            <button onClick={() => handleNoShow(r.id, r.company_id)} className="btn-ghost text-xs px-1.5 py-1 text-warning">노쇼</button>
                          )}
                          {r.status !== 'cancelled' && r.status !== 'no_show' && (
                            <button onClick={() => handleCancel(r.id)} className="btn-ghost text-xs px-1.5 py-1 text-danger">취소</button>
                          )}
                          <button onClick={() => handleDelete(r.id)} className="btn-ghost text-xs px-1.5 py-1 text-danger/60">삭제</button>
                        </div>
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

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between px-2 pt-3 flex-shrink-0 border-t border-border/30">
            <span className="text-xs text-text-tertiary">
              {totalCount}건 중 {(currentPage - 1) * PAGE_SIZE + 1}-{Math.min(currentPage * PAGE_SIZE, totalCount)}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="w-7 h-7 flex items-center justify-center rounded-md text-text-secondary hover:bg-bg-tertiary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
              </button>
              {getPageNumbers().map((p) => (
                <button
                  key={p}
                  onClick={() => setCurrentPage(p)}
                  className={`w-7 h-7 flex items-center justify-center rounded-md text-xs font-medium transition-colors ${
                    p === currentPage
                      ? 'bg-primary/20 text-primary'
                      : 'text-text-secondary hover:bg-bg-tertiary'
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="w-7 h-7 flex items-center justify-center rounded-md text-text-secondary hover:bg-bg-tertiary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Reservation Form Modal */}
      <Modal
        isOpen={showFormModal}
        onClose={() => { setShowFormModal(false); setEditingReservation(null) }}
        title={editingReservation ? '예약 수정' : '새 예약 추가'}
        size="lg"
        footer={
          <div className="flex items-center justify-between gap-3">
            {!editingReservation ? (
              <button
                type="button"
                onClick={() => formRef.current?.pasteFromClipboard()}
                className="flex items-center gap-1.5 text-xs text-text-tertiary hover:text-primary transition-colors"
                disabled={formLoading}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
                SMBIZ 붙여넣기
              </button>
            ) : <span />}
            <div className="flex gap-3">
              <button type="button" onClick={() => { setShowFormModal(false); setEditingReservation(null) }} className="btn btn-ghost" disabled={formLoading}>취소</button>
              <button type="submit" form={RESERVATION_FORM_ID} className="btn btn-primary" disabled={formLoading}>
                {formLoading ? '저장 중...' : (editingReservation ? '수정' : '추가')}
              </button>
            </div>
          </div>
        }
      >
        <ReservationForm
          ref={formRef}
          reservation={editingReservation}
          onSave={handleSaved}
          onLoadingChange={setFormLoading}
        />
      </Modal>

      {/* Reservation Detail Modal */}
      <ReservationDetailModal
        isOpen={showDetailModal}
        onClose={() => { setShowDetailModal(false); setDetailReservation(null) }}
        reservation={detailReservation}
      />

      {/* Confirm Modal */}
      <Modal
        isOpen={confirmModal.show}
        onClose={() => setConfirmModal((p) => ({ ...p, show: false }))}
        title={confirmModal.title}
        size="sm"
        footer={
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setConfirmModal((p) => ({ ...p, show: false }))}
              className="px-4 py-2 text-sm bg-bg-tertiary hover:bg-bg-secondary border border-border rounded-lg"
            >
              취소
            </button>
            <button
              onClick={confirmModal.onConfirm ?? undefined}
              className={`px-4 py-2 text-sm rounded-lg ${
                confirmModal.type === 'danger'
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
                  : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/30'
              }`}
            >
              확인
            </button>
          </div>
        }
      >
        <div className="p-6">
          <p className="text-sm text-text-secondary whitespace-pre-line">{confirmModal.message}</p>
        </div>
      </Modal>
    </div>
  )
}

export default ReservationsPage
