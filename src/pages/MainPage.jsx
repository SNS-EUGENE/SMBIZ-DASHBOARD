import { useState, useEffect } from 'react'
import { useOutletContext } from 'react-router-dom'
import { format } from 'date-fns'
import TimelineView from '../components/TimelineView'
import { api } from '../lib/supabase'

const MainPage = () => {
  const { selectedDate } = useOutletContext()
  const [reservations, setReservations] = useState([])
  const [loading, setLoading] = useState(true)

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

  return (
    <div className="h-full flex flex-col bg-bg-primary overflow-hidden">
      {/* Stats Summary Bar - Compact */}
      <div className="px-6 py-2 border-b border-border/50 bg-bg-secondary/20 flex-shrink-0">
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
    </div>
  )
}

export default MainPage
