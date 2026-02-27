import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { useState, useEffect, memo, useRef } from 'react'
import { format, addDays, subDays } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Calendar as CalendarIcon, BarChart3, Settings2, ChevronLeft, ChevronRight, ClipboardList, ClipboardCheck, Building2, Wrench, FileText, LogOut } from 'lucide-react'
import { cn } from '../lib/utils'
import CalendarPicker from './Calendar'
import Portal from './Portal'
import { useAuth } from './AuthProvider'

interface NavLinkItem {
  path: string
  label: string
  /** 모바일 하단탭에서 표시할 짧은 라벨 (생략 시 label 사용) */
  shortLabel?: string
  icon: React.FC<{ size?: number }>
}

interface CalendarPosition {
  top: number
  left: number
}

type DateDirection = 'prev' | 'next' | 'today'

// 시계 컴포넌트 - 리렌더링 격리
const CurrentTimeClock = memo(() => {
  const [currentTime, setCurrentTime] = useState<Date>(new Date())

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const formatTime = (date: Date): string => {
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
  const { user, signOut } = useAuth()
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [showCalendar, setShowCalendar] = useState<boolean>(false)
  const [calendarPosition, setCalendarPosition] = useState<CalendarPosition>({ top: 0, left: 0 })
  const dateButtonRef = useRef<HTMLButtonElement>(null)
  const location = useLocation()

  const navLinks: NavLinkItem[] = [
    { path: '/main', label: '예약 현황', shortLabel: '현황', icon: CalendarIcon },
    { path: '/reservations', label: '예약 관리', shortLabel: '예약', icon: ClipboardList },
    { path: '/stats', label: '통계', icon: BarChart3 },
    { path: '/companies', label: '기업 관리', shortLabel: '기업', icon: Building2 },
    { path: '/equipment', label: '장비 관리', shortLabel: '장비', icon: Wrench },
    { path: '/inspections', label: '점검 관리', shortLabel: '점검', icon: ClipboardCheck },
    { path: '/surveys', label: '만족도 관리', shortLabel: '만족도', icon: FileText },
    { path: '/settings', label: '설정', icon: Settings2 },
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

  const handleDateChange = (direction: DateDirection): void => {
    if (direction === 'prev') {
      setSelectedDate(subDays(selectedDate, 1))
    } else if (direction === 'next') {
      setSelectedDate(addDays(selectedDate, 1))
    } else if (direction === 'today') {
      setSelectedDate(new Date())
    }
  }

  const handleShowCalendar = (e: React.MouseEvent<HTMLButtonElement>): void => {
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
      <header className="h-12 md:h-14 border-b border-border bg-bg-secondary/60 backdrop-blur-2xl shadow-sm flex-shrink-0 z-50">
        <div className="h-full px-4 md:px-6 flex items-center justify-between">
          {/* Left: Logo */}
          <div className="flex items-center gap-2 md:gap-3">
            <h1 className="text-sm md:text-base font-bold text-text-primary tracking-tight">
              SMBIZ
            </h1>
            <span className="text-xs md:text-sm text-text-tertiary hidden sm:inline">디지털콘텐츠제작실</span>

            {/* Mobile logout button */}
            <button
              onClick={signOut}
              className="md:hidden ml-1 w-7 h-7 flex items-center justify-center rounded-md hover:bg-bg-tertiary text-text-tertiary hover:text-text-primary transition-all"
              aria-label="로그아웃"
            >
              <LogOut size={14} />
            </button>
          </div>

          {/* Right: Date Navigation & Time (only on main page) */}
          {isMainPage && (
            <div className="flex items-center gap-2 md:gap-5">
              {/* Date Navigation */}
              <div className="flex items-center gap-0">
                <button
                  onClick={() => handleDateChange('prev')}
                  className="w-7 h-7 md:w-8 md:h-8 flex items-center justify-center rounded-md hover:bg-bg-tertiary text-text-secondary hover:text-text-primary transition-all flex-shrink-0"
                  aria-label="이전 날짜"
                >
                  <ChevronLeft size={16} />
                </button>

                <div className="relative">
                  <button
                    ref={dateButtonRef}
                    onClick={handleShowCalendar}
                    className="px-1.5 md:px-4 py-1.5 hover:bg-bg-tertiary rounded-lg transition-all text-center"
                  >
                    <div className="text-xs md:text-sm font-semibold text-text-primary whitespace-nowrap">
                      {format(selectedDate, 'yyyy년 M월 d일', { locale: ko })}
                    </div>
                    <div className="text-[10px] md:text-xs text-text-tertiary">
                      {format(selectedDate, 'EEEE', { locale: ko })}
                    </div>
                  </button>
                </div>

                <button
                  onClick={() => handleDateChange('next')}
                  className="w-7 h-7 md:w-8 md:h-8 flex items-center justify-center rounded-md hover:bg-bg-tertiary text-text-secondary hover:text-text-primary transition-all flex-shrink-0"
                  aria-label="다음 날짜"
                >
                  <ChevronRight size={16} />
                </button>

                <button
                  onClick={() => handleDateChange('today')}
                  className="ml-0.5 md:ml-1 px-2 md:px-3 py-1 md:py-1.5 text-[10px] md:text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 rounded-md transition-all flex-shrink-0"
                >
                  오늘
                </button>
              </div>

              {/* Current Time - hidden on mobile */}
              <div className="hidden md:block">
                <CurrentTimeClock />
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Content Area: Sidebar + Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - desktop only */}
        <aside className="hidden md:flex w-44 bg-bg-secondary/30 backdrop-blur-xl border-r border-border flex-col flex-shrink-0">
          <nav className="flex-1 px-2 pt-3 space-y-1">
            {navLinks.map((link) => {
              const IconComponent = link.icon
              return (
                <NavLink
                  key={link.path}
                  to={link.path}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center px-3 gap-3 py-2.5 rounded-lg transition-all duration-200',
                      isActive
                        ? 'bg-primary/15 text-primary'
                        : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
                    )
                  }
                >
                  <span className="flex-shrink-0 flex items-center justify-center">
                    <IconComponent size={18} />
                  </span>
                  <span className="font-medium text-sm whitespace-nowrap">
                    {link.label}
                  </span>
                </NavLink>
              )
            })}
          </nav>

          {/* User & Logout */}
          <div className="px-2 pb-3 border-t border-border pt-3">
            {user && (
              <p className="text-[11px] text-text-tertiary truncate px-3 mb-1.5" title={user.email}>
                {user.email}
              </p>
            )}
            <button
              onClick={signOut}
              className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-all duration-200"
            >
              <LogOut size={18} />
              <span className="font-medium text-sm">로그아웃</span>
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto pb-14 md:pb-0">
          <Outlet context={{ selectedDate, setSelectedDate }} />
        </main>
      </div>

      {/* Bottom Tab Bar - mobile only */}
      <nav className="flex md:hidden fixed bottom-0 left-0 right-0 h-14 bg-bg-secondary/90 backdrop-blur-xl border-t border-border z-50">
        {navLinks.map((link) => {
          const IconComponent = link.icon
          return (
            <NavLink
              key={link.path}
              to={link.path}
              className={({ isActive }) =>
                cn(
                  'flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors min-w-0',
                  isActive
                    ? 'text-primary'
                    : 'text-text-tertiary'
                )
              }
            >
              <IconComponent size={18} />
              <span className="text-[9px] leading-none font-medium whitespace-nowrap">{link.shortLabel || link.label}</span>
            </NavLink>
          )
        })}
      </nav>

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
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <CalendarPicker
              selectedDate={selectedDate}
              onDateSelect={(date: Date) => {
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
