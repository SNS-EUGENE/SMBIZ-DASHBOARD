import { Outlet, NavLink } from 'react-router-dom'
import { useState, useEffect } from 'react'

const Layout = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true)

  const navLinks = [
    { path: '/main', label: '예약 현황', icon: '📅' },
    { path: '/stats', label: '통계', icon: '📊' },
    { path: '/admin', label: '관리', icon: '⚙️' },
  ]

  return (
    <div className="min-h-screen flex">
      {/* Sidebar - Enhanced macOS glassmorphism */}
      <aside
        className={`bg-bg-secondary/50 backdrop-blur-2xl border-r border-border flex flex-col transition-all duration-300 shadow-sm ${
          isSidebarCollapsed ? 'w-16' : 'w-64'
        }`}
      >
        {/* Logo */}
        <div className="px-4 py-5 border-b border-border flex items-center justify-between">
          {!isSidebarCollapsed && (
            <div>
              <h1 className="text-lg font-bold text-text-primary tracking-tight">
                SMBIZ
              </h1>
              <p className="text-xs text-text-tertiary mt-0.5">디지털 콘텐츠 제작실</p>
            </div>
          )}
          {isSidebarCollapsed && (
            <div className="text-center w-full">
              <h1 className="text-base font-bold text-text-primary">S</h1>
            </div>
          )}
        </div>

        {/* Toggle Button */}
        <button
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="mx-2 my-2 p-2 hover:bg-bg-tertiary rounded-md transition-all text-text-secondary hover:text-text-primary"
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
        <nav className="flex-1 p-2 space-y-0.5">
          {navLinks.map((link) => (
            <NavLink
              key={link.path}
              to={link.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-200
                ${isActive
                  ? 'bg-primary/15 text-primary shadow-sm'
                  : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
                }
                ${isSidebarCollapsed ? 'justify-center' : ''}`
              }
              title={isSidebarCollapsed ? link.label : ''}
            >
              <span className="text-base">{link.icon}</span>
              {!isSidebarCollapsed && <span className="font-medium text-sm">{link.label}</span>}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}

export default Layout
