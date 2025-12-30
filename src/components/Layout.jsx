import { Outlet, NavLink } from 'react-router-dom'
import { useState } from 'react'

const Layout = () => {
  const [currentTime, setCurrentTime] = useState(new Date())

  // Update time every second
  useState(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const formatTime = (date) => {
    return date.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const navLinks = [
    { path: '/main', label: '예약 현황', icon: '📅' },
    { path: '/stats', label: '통계', icon: '📊' },
    { path: '/admin', label: '관리', icon: '⚙️' },
  ]

  return (
    <div className="min-h-screen flex">
      {/* Sidebar - Raycast Style */}
      <aside className="w-64 bg-bg-secondary border-r border-border flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-border">
          <h1 className="text-xl font-bold text-text-primary">
            SMBIZ
          </h1>
          <p className="text-xs text-text-tertiary mt-1">디지털 콘텐츠 제작실</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navLinks.map((link) => (
            <NavLink
              key={link.path}
              to={link.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200
                ${isActive
                  ? 'bg-primary text-white shadow-md'
                  : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
                }`
              }
            >
              <span className="text-lg">{link.icon}</span>
              <span className="font-medium">{link.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Footer Info */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center justify-between text-xs text-text-tertiary">
            <span>{new Date().toLocaleDateString('ko-KR')}</span>
            <span className="font-mono">{formatTime(currentTime)}</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}

export default Layout
