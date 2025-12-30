import { useState, useEffect } from 'react'
import { format, addDays, subDays } from 'date-fns'
import { ko } from 'date-fns/locale'
import Calendar from '../components/Calendar'
import TimelineView from '../components/TimelineView'
import { api } from '../lib/supabase'

const MainPage = () => {
  const [selectedDate, setSelectedDate] = useState(new Date())
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

  const handleDateChange = (direction) => {
    if (direction === 'prev') {
      setSelectedDate(subDays(selectedDate, 1))
    } else if (direction === 'next') {
      setSelectedDate(addDays(selectedDate, 1))
    } else if (direction === 'today') {
      setSelectedDate(new Date())
    }
  }

  const equipmentTypes = ['AS360', 'MICRO', 'XL', 'XXL', '알파데스크', '알파테이블', 'Compact']

  return (
    <div className="h-screen flex flex-col bg-bg-primary">
      {/* Header */}
      <header className="border-b border-border bg-bg-secondary">
        <div className="px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-text-primary">예약 현황</h1>
              <p className="text-sm text-text-tertiary mt-1">
                장비별 예약 타임라인
              </p>
            </div>

            {/* Date Navigation */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => handleDateChange('prev')}
                className="btn btn-ghost p-2"
                aria-label="이전 날짜"
              >
                ←
              </button>

              <div className="text-center min-w-[200px]">
                <div className="text-lg font-semibold text-text-primary">
                  {format(selectedDate, 'yyyy년 M월 d일', { locale: ko })}
                </div>
                <div className="text-sm text-text-tertiary">
                  {format(selectedDate, 'EEEE', { locale: ko })}
                </div>
              </div>

              <button
                onClick={() => handleDateChange('next')}
                className="btn btn-ghost p-2"
                aria-label="다음 날짜"
              >
                →
              </button>

              <button
                onClick={() => handleDateChange('today')}
                className="btn btn-secondary ml-4"
              >
                오늘
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Calendar Sidebar */}
        <aside className="w-80 border-r border-border bg-bg-secondary overflow-y-auto">
          <div className="p-6">
            <Calendar
              selectedDate={selectedDate}
              onDateSelect={setSelectedDate}
            />

            {/* Quick Stats */}
            <div className="mt-6 space-y-3">
              <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">
                오늘의 통계
              </h3>

              <div className="card p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-secondary">총 예약</span>
                  <span className="text-xl font-bold text-text-primary">
                    {reservations.length}
                  </span>
                </div>
              </div>

              <div className="card p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-secondary">오전 예약</span>
                  <span className="text-xl font-bold text-text-primary">
                    {reservations.filter(r => r.time_slot === 'morning').length}
                  </span>
                </div>
              </div>

              <div className="card p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-secondary">오후 예약</span>
                  <span className="text-xl font-bold text-text-primary">
                    {reservations.filter(r => r.time_slot === 'afternoon').length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Timeline Main Content */}
        <main className="flex-1 overflow-auto">
          <TimelineView
            date={selectedDate}
            reservations={reservations}
            equipmentTypes={equipmentTypes}
            loading={loading}
            onRefresh={fetchReservations}
          />
        </main>
      </div>
    </div>
  )
}

export default MainPage
