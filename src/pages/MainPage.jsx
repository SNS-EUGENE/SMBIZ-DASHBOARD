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
      {/* Stats Summary Bar - Compact */}
      <div className="px-6 py-2 border-b border-border/50 bg-bg-secondary/20 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-text-tertiary">총 예약</span>
              <span className="text-sm font-bold text-text-primary">{reservations.length}</span>
            </div>
            <div className="w-px h-4 bg-border"></div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-success"></div>
              <span className="text-[10px] text-text-tertiary">오전</span>
              <span className="text-xs font-semibold text-text-primary">
                {reservations.filter(r => r.time_slot === 'morning').length}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-warning"></div>
              <span className="text-[10px] text-text-tertiary">오후</span>
              <span className="text-xs font-semibold text-text-primary">
                {reservations.filter(r => r.time_slot === 'afternoon').length}
              </span>
            </div>
          </div>
          <button
            onClick={() => setShowReservationModal(true)}
            className="btn btn-primary btn-sm flex items-center gap-1.5"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 2V12M2 7H12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <span>예약 추가</span>
          </button>
        </div>
      </div>

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
