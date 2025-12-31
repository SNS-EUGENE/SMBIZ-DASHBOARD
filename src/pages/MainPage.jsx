import { useState, useEffect, memo, useRef } from 'react'
import { format, addDays, subDays } from 'date-fns'
import { ko } from 'date-fns/locale'
import Calendar from '../components/Calendar'
import TimelineView from '../components/TimelineView'
import Portal from '../components/Portal'
import { api } from '../lib/supabase'

// 시계 컴포넌트를 별도로 분리해서 리렌더링 격리
const CurrentTimeClock = memo(() => {
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const formatTime = (date) => {
    return date.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    })
  }

  return (
    <div className="flex items-center gap-2.5 px-3.5 py-2 bg-bg-tertiary/60 rounded-lg backdrop-blur-sm">
      <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
      <span className="text-xs text-text-tertiary font-medium">현재</span>
      <span className="text-sm font-mono font-semibold text-text-primary tracking-tight">
        {formatTime(currentTime)}
      </span>
    </div>
  )
})

CurrentTimeClock.displayName = 'CurrentTimeClock'

const MainPage = () => {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [reservations, setReservations] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCalendar, setShowCalendar] = useState(false)
  const [calendarPosition, setCalendarPosition] = useState({ top: 0, left: 0 })
  const dateButtonRef = useRef(null)

  useEffect(() => {
    fetchReservations()
  }, [selectedDate])

  // Close calendar when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setShowCalendar(false)
    }

    if (showCalendar) {
      document.addEventListener('click', handleClickOutside)
    }

    return () => {
      document.removeEventListener('click', handleClickOutside)
    }
  }, [showCalendar])

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

  const handleShowCalendar = (e) => {
    e.stopPropagation()
    if (dateButtonRef.current) {
      const rect = dateButtonRef.current.getBoundingClientRect()
      setCalendarPosition({
        top: rect.bottom + 8,
        left: rect.left
      })
    }
    setShowCalendar(!showCalendar)
  }

  const equipmentTypes = ['AS360', 'MICRO', 'XL', 'XXL', '알파데스크', '알파테이블', 'Compact']

  return (
    <div className="h-screen flex flex-col bg-bg-primary">
      {/* Top Bar - Enhanced macOS glassmorphism */}
      <header className="border-b border-border bg-bg-secondary/60 backdrop-blur-2xl shadow-sm">
        <div className="px-8 py-3.5">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold text-text-primary">예약 현황</h1>

            <div className="flex items-center gap-5">
              {/* Date Navigation with Dropdown */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDateChange('prev')}
                  className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-bg-tertiary text-text-secondary hover:text-text-primary transition-all"
                  aria-label="이전 날짜"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>

                <div className="relative">
                  <button
                    ref={dateButtonRef}
                    onClick={handleShowCalendar}
                    className="px-4 py-2 hover:bg-bg-tertiary rounded-lg transition-all text-center min-w-[160px]"
                  >
                    <div className="text-sm font-semibold text-text-primary">
                      {format(selectedDate, 'yyyy년 M월 d일', { locale: ko })}
                    </div>
                    <div className="text-xs text-text-tertiary mt-0.5">
                      {format(selectedDate, 'EEEE', { locale: ko })}
                    </div>
                  </button>
                </div>

                <button
                  onClick={() => handleDateChange('next')}
                  className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-bg-tertiary text-text-secondary hover:text-text-primary transition-all"
                  aria-label="다음 날짜"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>

                <button
                  onClick={() => handleDateChange('today')}
                  className="px-3 py-1.5 text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 rounded-md transition-all"
                >
                  오늘
                </button>
              </div>

              {/* Current Time */}
              <CurrentTimeClock />

              {/* Stats Summary */}
              <div className="flex items-center gap-3 px-3.5 py-2 bg-bg-tertiary/40 rounded-lg text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-text-tertiary font-medium">총</span>
                  <span className="font-bold text-text-primary text-sm">{reservations.length}</span>
                </div>
                <div className="w-px h-4 bg-border"></div>
                <div className="flex items-center gap-1.5">
                  <span className="text-text-tertiary font-medium">오전</span>
                  <span className="font-bold text-success text-sm">
                    {reservations.filter(r => r.time_slot === 'morning').length}
                  </span>
                </div>
                <div className="w-px h-4 bg-border"></div>
                <div className="flex items-center gap-1.5">
                  <span className="text-text-tertiary font-medium">오후</span>
                  <span className="font-bold text-warning text-sm">
                    {reservations.filter(r => r.time_slot === 'afternoon').length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Timeline Main Content (Full Width) */}
      <main className="flex-1 overflow-x-hidden overflow-y-auto">
        <TimelineView
          date={selectedDate}
          reservations={reservations}
          equipmentTypes={equipmentTypes}
          loading={loading}
          onRefresh={fetchReservations}
        />
      </main>

      {/* Calendar Portal - Enhanced glassmorphism */}
      {showCalendar && (
        <Portal>
          <div
            className="fixed bg-bg-elevated/95 backdrop-blur-2xl border border-border rounded-2xl shadow-xl"
            style={{
              top: `${calendarPosition.top}px`,
              left: `${calendarPosition.left}px`,
              zIndex: 999999
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <Calendar
              selectedDate={selectedDate}
              onDateSelect={(date) => {
                setSelectedDate(date)
                setShowCalendar(false)
              }}
            />
          </div>
        </Portal>
      )}
    </div>
  )
}

export default MainPage
