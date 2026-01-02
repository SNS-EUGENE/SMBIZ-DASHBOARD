import { useState, useEffect } from 'react'
import { useOutletContext } from 'react-router-dom'
import { format } from 'date-fns'
import TimelineView from '../components/TimelineView'
import Modal from '../components/Modal'
import ReservationForm from '../components/ReservationForm'
import { api } from '../lib/supabase'

const MainPage = () => {
  const { selectedDate } = useOutletContext()
  const [reservations, setReservations] = useState([])
  const [loading, setLoading] = useState(true)
  const [showReservationModal, setShowReservationModal] = useState(false)

  useEffect(() => {
    fetchReservations()
  }, [selectedDate])

  const fetchReservations = async () => {
    setLoading(true)
    const dateStr = format(selectedDate, 'yyyy-MM-dd')
    const { data, error } = await api.reservations.getByDate(dateStr)

    if (error) {
      console.error('Failed to fetch reservations:', error)
    } else {
      setReservations(data || [])
    }
    setLoading(false)
  }

  const equipmentTypes = ['AS360', 'MICRO', 'XL', 'XXL', '알파데스크', '알파테이블', 'Compact']

  const handleReservationSave = () => {
    setShowReservationModal(false)
    fetchReservations()
  }

  return (
    <div className="h-full flex flex-col bg-bg-primary overflow-hidden">
      {/* Header - 통계/관리자 페이지 스타일 통일 */}
      <header className="border-b border-border bg-bg-secondary/60 backdrop-blur-xl flex-shrink-0 z-10">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-text-primary">예약 타임라인</h1>
              <p className="text-xs text-text-tertiary mt-0.5">
                장비별 예약 현황
              </p>
            </div>
            <div className="flex items-center gap-4">
              {/* 통계 */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-text-tertiary">총 예약</span>
                  <span className="text-sm font-bold text-text-primary">{reservations.length}</span>
                </div>
                <div className="w-px h-4 bg-border"></div>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-success"></div>
                  <span className="text-xs text-text-tertiary">오전</span>
                  <span className="text-xs font-semibold text-text-primary">
                    {reservations.filter(r => r.time_slot === 'morning').length}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-warning"></div>
                  <span className="text-xs text-text-tertiary">오후</span>
                  <span className="text-xs font-semibold text-text-primary">
                    {reservations.filter(r => r.time_slot === 'afternoon').length}
                  </span>
                </div>
              </div>
              {/* 버튼들 */}
              <div className="flex items-center gap-2">
                <button
                  onClick={fetchReservations}
                  className="px-3 py-1.5 text-sm font-medium bg-bg-secondary/60 hover:bg-bg-secondary border border-border/60 rounded-lg transition-all flex items-center gap-2"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 4 23 10 17 10"/>
                    <polyline points="1 20 1 14 7 14"/>
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                  </svg>
                  <span className="text-text-primary">새로고침</span>
                </button>
                <button
                  onClick={() => setShowReservationModal(true)}
                  className="px-3 py-1.5 text-sm font-medium bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 rounded-lg transition-all flex items-center gap-2"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="16"/>
                    <line x1="8" y1="12" x2="16" y2="12"/>
                  </svg>
                  <span>예약 추가</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Timeline Main Content - No scroll, fill height */}
      <div className="flex-1 min-h-0">
        <TimelineView
          date={selectedDate}
          reservations={reservations}
          equipmentTypes={equipmentTypes}
          loading={loading}
          onRefresh={fetchReservations}
        />
      </div>
      {/* Reservation Modal */}
      <Modal
        isOpen={showReservationModal}
        onClose={() => setShowReservationModal(false)}
        title="예약 추가"
        size="lg"
      >
        <ReservationForm
          defaultDate={selectedDate}
          onSave={handleReservationSave}
          onCancel={() => setShowReservationModal(false)}
        />
      </Modal>
    </div>
  )
}

export default MainPage
