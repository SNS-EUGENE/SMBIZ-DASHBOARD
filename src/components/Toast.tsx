import { useState, useEffect, useMemo, createContext, useContext, useCallback } from 'react'
import { createPortal } from 'react-dom'
import type { ToastType, ToastItem } from '../types'

interface ToastContextValue {
  success: (message: string) => number
  error: (message: string) => number
  warning: (message: string) => number
  info: (message: string) => number
}

const ToastContext = createContext<ToastContextValue | null>(null)

export const useToast = (): ToastContextValue => {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

interface ToastProps {
  id: number
  type: ToastType
  message: string
  onClose: (id: number) => void
}

const Toast = ({ id, type, message, onClose }: ToastProps) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(id)
    }, 3000)

    return () => clearTimeout(timer)
  }, [id, onClose])

  const typeConfig = {
    success: {
      bg: 'bg-success/20',
      border: 'border-success/30',
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M13.5 4.5L6 12L2.5 8.5" stroke="#00D9A5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
    },
    error: {
      bg: 'bg-danger/20',
      border: 'border-danger/30',
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M12 4L4 12M4 4L12 12" stroke="#FF6B6B" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      ),
    },
    warning: {
      bg: 'bg-warning/20',
      border: 'border-warning/30',
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 5V8M8 11H8.01M14 8C14 11.3137 11.3137 14 8 14C4.68629 14 2 11.3137 2 8C2 4.68629 4.68629 2 8 2C11.3137 2 14 4.68629 14 8Z" stroke="#FFB84D" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      ),
    },
    info: {
      bg: 'bg-primary/20',
      border: 'border-primary/30',
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 7V11M8 5H8.01M14 8C14 11.3137 11.3137 14 8 14C4.68629 14 2 11.3137 2 8C2 4.68629 4.68629 2 8 2C11.3137 2 14 4.68629 14 8Z" stroke="#FF6363" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      ),
    },
  }

  const config = typeConfig[type] || typeConfig.info

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 ${config.bg} backdrop-blur-xl border ${config.border} rounded-xl shadow-lg animate-slide-in`}
    >
      <div className="flex-shrink-0">{config.icon}</div>
      <p className="text-sm text-text-primary flex-1">{message}</p>
      <button
        onClick={() => onClose(id)}
        className="flex-shrink-0 p-1 hover:bg-bg-tertiary/50 rounded-md transition-colors"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M9 3L3 9M3 3L9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  )
}

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const addToast = useCallback((type: ToastType, message: string): number => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, type, message }])
    return id
  }, [])

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const toast = useMemo<ToastContextValue>(() => ({
    success: (message: string) => addToast('success', message),
    error: (message: string) => addToast('error', message),
    warning: (message: string) => addToast('warning', message),
    info: (message: string) => addToast('info', message),
  }), [addToast])

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {createPortal(
        <div className="fixed top-4 right-4 z-[99999] flex flex-col gap-2 max-w-sm">
          {toasts.map(t => (
            <Toast
              key={t.id}
              id={t.id}
              type={t.type}
              message={t.message}
              onClose={removeToast}
            />
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  )
}

export default Toast
