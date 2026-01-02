import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { useState, useEffect, memo, useRef } from 'react'
import { format, addDays, subDays } from 'date-fns'
import { ko } from 'date-fns/locale'
import Calendar from './Calendar'
import Portal from './Portal'

// 시계 컴포넌트 - 리렌더링 격리
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
      <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse"></div>
      <span className="text-xs text-text-tertiary font-medium">현재</span>
      <span className="text-sm text-text-primary tracking-tight font-mono-num">
        {formatTime(currentTime)}
      </span>
    </div>
  )
})

CurrentTimeClock.displayName = 'CurrentTimeClock'

const Layout = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true)
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [showCalendar, setShowCalendar] = useState(false)
  const [calendarPosition, setCalendarPosition] = useState({ top: 0, left: 0 })
  const dateButtonRef = useRef(null)
  const location = useLocation()

  const navLinks = [
    { path: '/main', label: '예약 현황', icon: '📅' },
    { path: '/stats', label: '통계', icon: '📊' },
    { path: '/admin', label: '관리', icon: '⚙️' },
  ]

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

  // 메인 페이지인지 확인
  const isMainPage = location.pathname === '/main' || location.pathname === '/'

  return (
    <div className="min-h-screen flex flex-col bg-bg-primary">
      {/* Global Top Bar */}
      <header className="h-14 border-b border-border bg-bg-secondary/60 backdrop-blur-2xl shadow-sm flex-shrink-0 z-50">
        <div className="h-full px-6 flex items-center justify-between">
          {/* Left: Logo */}
          <div className="flex items-center gap-3">
            <h1 className="text-base font-bold text-text-primary tracking-tight">
              SMBIZ
            </h1>
            <span className="text-sm text-text-tertiary">디지털콘텐츠제작실</span>
          </div>

          {/* Right: Date Navigation & Time (only on main page) */}
          {isMainPage && (
            <div className="flex items-center gap-5">
              {/* Date Navigation */}
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
                    className="px-4 py-1.5 hover:bg-bg-tertiary rounded-lg transition-all text-center min-w-[150px]"
                  >
                    <div className="text-sm font-semibold text-text-primary">
                      {format(selectedDate, 'yyyy년 M월 d일', { locale: ko })}
                    </div>
                    <div className="text-xs text-text-tertiary">
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
            </div>
          )}
        </div>
      </header>

      {/* Main Content Area: Sidebar + Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside
          className={`bg-bg-secondary/30 backdrop-blur-xl border-r border-border flex flex-col transition-all duration-300 flex-shrink-0 ${
            isSidebarCollapsed ? 'w-14' : 'w-56'
          }`}
        >
          {/* Toggle Button */}
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="mx-2 my-3 p-2 hover:bg-bg-tertiary rounded-md transition-all text-text-secondary hover:text-text-primary"
            aria-label={isSidebarCollapsed ? '사이드바 펼치기' : '사이드바 접기'}
          >
            {isSidebarCollapsed ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>

          {/* Navigation */}
          <nav className="flex-1 px-2 space-y-1">
            {navLinks.map((link) => (
              <NavLink
                key={link.path}
                to={link.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200
                  ${isActive
                    ? 'bg-primary/15 text-primary'
                    : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
                  }
                  ${isSidebarCollapsed ? 'justify-center' : ''}`
                }
                title={isSidebarCollapsed ? link.label : ''}
              >
                <span className="text-base flex-shrink-0">{link.icon}</span>
                <span className={`font-medium text-sm whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
                  {link.label}
                </span>
              </NavLink>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          <Outlet context={{ selectedDate, setSelectedDate }} />
        </main>
      </div>

      {/* Calendar Portal */}
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

export default Layout
