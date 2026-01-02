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

  // SVG 아이콘 컴포넌트
  const CalendarIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  )

  const ChartIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  )

  const SettingsIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  )

  const navLinks = [
    { path: '/main', label: '예약 현황', icon: CalendarIcon },
    { path: '/stats', label: '통계', icon: ChartIcon },
    { path: '/admin', label: '관리', icon: SettingsIcon },
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
    <div className="h-screen flex flex-col bg-bg-primary overflow-hidden">
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
            {navLinks.map((link) => {
              const IconComponent = link.icon
              return (
                <NavLink
                  key={link.path}
                  to={link.path}
                  className={({ isActive }) =>
                    `flex items-center py-2.5 rounded-lg transition-all duration-200
                    ${isActive
                      ? 'bg-primary/15 text-primary'
                      : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
                    }
                    ${isSidebarCollapsed ? 'justify-center' : 'px-3 gap-3'}`
                  }
                  title={isSidebarCollapsed ? link.label : ''}
                >
                  <span className="flex-shrink-0 flex items-center justify-center">
                    <IconComponent />
                  </span>
                  {!isSidebarCollapsed && (
                    <span className="font-medium text-sm whitespace-nowrap">
                      {link.label}
                    </span>
                  )}
                </NavLink>
              )
            })}
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
