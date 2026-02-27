import { useState, useEffect, useCallback } from 'react'
import { useOutletContext } from 'react-router-dom'
import { format } from 'date-fns'
import TimelineView from '../components/TimelineView'
import Modal from '../components/Modal'
import ReservationForm, { RESERVATION_FORM_ID } from '../components/ReservationForm'
import { api } from '../lib/supabase'
import { useToast } from '../components/Toast'
import { EQUIPMENT_TYPES } from '../constants'
import type { ReservationWithDetails } from '../types'

const MainPage = () => {
  const { selectedDate } = useOutletContext<{ selectedDate: Date; setSelectedDate: (date: Date) => void }>()
  const toast = useToast()
  const [reservations, setReservations] = useState<ReservationWithDetails[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [refreshing, setRefreshing] = useState<boolean>(false)
  const [showReservationModal, setShowReservationModal] = useState<boolean>(false)
  const [formLoading, setFormLoading] = useState<boolean>(false)

  const fetchReservations = useCallback(async (showRefreshState = false): Promise<void> => {
    if (showRefreshState) setRefreshing(true)
    else setLoading(true)

    const dateStr = format(selectedDate, 'yyyy-MM-dd')
    const { data, error } = await api.reservations.getByDate(dateStr)

    if (error) {
      toast.error('예약 조회 실패 : ' + error.message)
    } else {
      setReservations(data || [])
    }
    setLoading(false)
    setRefreshing(false)
  }, [selectedDate, toast])

  useEffect(() => {
    fetchReservations(false)
  }, [fetchReservations])

  const handleReservationSave = (): void => {
    setShowReservationModal(false)
    fetchReservations(false)
  }

  return (
    <div className="h-full flex flex-col bg-bg-primary overflow-hidden">
      {/* Header */}
      <header className="border-b border-border bg-bg-secondary/60 backdrop-blur-xl flex-shrink-0 z-10">
        <div className="px-4 py-3 md:px-6 md:py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-lg md:text-xl font-bold text-text-primary">예약 타임라인</h1>
              <p className="text-xs text-text-tertiary mt-0.5 hidden md:block">장비별 예약 현황</p>
            </div>
            <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
              {/* 통계 */}
              <div className="flex items-center gap-2 md:gap-3">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] md:text-xs text-text-tertiary">총</span>
                  <span className="text-xs md:text-sm font-bold text-text-primary">{reservations.length}</span>
                </div>
                <div className="w-px h-3 bg-border hidden md:block"></div>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-success"></div>
                  <span className="text-xs font-semibold text-text-primary">
                    {reservations.filter(r => r.time_slot === 'morning').length}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-warning"></div>
                  <span className="text-xs font-semibold text-text-primary">
                    {reservations.filter(r => r.time_slot === 'afternoon').length}
                  </span>
                </div>
              </div>
              {/* 버튼들 */}
              <div className="flex items-center gap-1.5 md:gap-2">
                <button
                  onClick={() => fetchReservations(true)}
                  disabled={refreshing}
                  aria-label="새로고침"
                  className="p-1.5 md:px-3 md:py-1.5 text-sm font-medium bg-bg-secondary/60 hover:bg-bg-secondary border border-border/60 rounded-lg transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={refreshing ? 'animate-spin' : ''}>
                    <polyline points="23 4 23 10 17 10"/>
                    <polyline points="1 20 1 14 7 14"/>
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                  </svg>
                  <span className="text-text-primary hidden md:inline">{refreshing ? '로딩...' : '새로고침'}</span>
                </button>
                <button
                  onClick={() => setShowReservationModal(true)}
                  className="p-1.5 md:px-3 md:py-1.5 text-sm font-medium bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 rounded-lg transition-all flex items-center gap-2"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="16"/>
                    <line x1="8" y1="12" x2="16" y2="12"/>
                  </svg>
                  <span className="hidden md:inline">예약 추가</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Timeline Main Content - No scroll, fill height */}
      <div className="flex-1 min-h-0">
        <TimelineView
          reservations={reservations}
          equipmentTypes={EQUIPMENT_TYPES}
          loading={loading}
        />
      </div>
      {/* Reservation Modal */}
      <Modal
        isOpen={showReservationModal}
        onClose={() => setShowReservationModal(false)}
        title="예약 추가"
        size="lg"
        footer={
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowReservationModal(false)} className="btn btn-ghost" disabled={formLoading}>취소</button>
            <button type="submit" form={RESERVATION_FORM_ID} className="btn btn-primary" disabled={formLoading}>
              {formLoading ? '저장 중...' : '추가'}
            </button>
          </div>
        }
      >
        <ReservationForm
          defaultDate={selectedDate}
          onSave={handleReservationSave}
          onLoadingChange={setFormLoading}
        />
      </Modal>
    </div>
  )
}

export default MainPage
